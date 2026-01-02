package openspec

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

// =============================================================================
// BEAD EXECUTOR
// =============================================================================

// BeadExecutor implements beads and verifies them.
type BeadExecutor struct {
	ai        AIClient
	verifier  *CUEVerifier
	store     Store
	parallel  int
}

// NewBeadExecutor creates a new executor.
func NewBeadExecutor(ai AIClient, verifier *CUEVerifier, store Store) *BeadExecutor {
	return &BeadExecutor{
		ai:       ai,
		verifier: verifier,
		store:    store,
		parallel: 5, // Parallel implementations per bead
	}
}

// ExecuteAll implements all beads in order, verifying each.
func (e *BeadExecutor) ExecuteAll(ctx context.Context, beads []Bead) ([]BeadResult, error) {
	results := make([]BeadResult, len(beads))
	completed := make(map[string][]byte) // Bead ID -> output

	for i, bead := range beads {
		// Check if dependencies are satisfied
		for _, dep := range bead.Requires {
			if _, ok := completed[dep]; !ok {
				return nil, fmt.Errorf("bead %s requires %s which is not complete", bead.Name, dep)
			}
		}

		// Update status
		if err := e.store.UpdateBeadStatus(ctx, bead.ID, BeadInProgress); err != nil {
			return nil, err
		}

		// Execute and verify
		result, err := e.executeBead(ctx, bead, completed)
		if err != nil {
			return nil, fmt.Errorf("execute %s: %w", bead.Name, err)
		}

		results[i] = result

		if result.Verification.Passed {
			completed[bead.ID] = result.Implementation
			if err := e.store.UpdateBeadStatus(ctx, bead.ID, BeadVerified); err != nil {
				return nil, err
			}
		} else {
			if err := e.store.UpdateBeadStatus(ctx, bead.ID, BeadFailed); err != nil {
				return nil, err
			}
			// Don't fail immediately - collect all results
		}
	}

	return results, nil
}

// BeadResult is the result of executing a bead.
type BeadResult struct {
	Bead           Bead
	Implementation []byte
	Verification   Verification
	Attempts       int
	SuccessfulIdx  int // Which attempt succeeded (-1 if none)
}

func (e *BeadExecutor) executeBead(
	ctx context.Context,
	bead Bead,
	dependencies map[string][]byte,
) (BeadResult, error) {
	result := BeadResult{
		Bead:          bead,
		SuccessfulIdx: -1,
	}

	// Update status to verifying
	if err := e.store.UpdateBeadStatus(ctx, bead.ID, BeadVerifying); err != nil {
		return result, err
	}

	// Generate multiple implementations in parallel
	type attemptResult struct {
		idx            int
		implementation []byte
		verification   Verification
		err            error
	}

	results := make(chan attemptResult, e.parallel)
	var wg sync.WaitGroup

	for i := 0; i < e.parallel; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()

			impl, err := e.generateImplementation(ctx, bead, dependencies, idx)
			if err != nil {
				results <- attemptResult{idx: idx, err: err}
				return
			}

			verification, err := e.verifier.Verify(ctx, bead, impl)
			if err != nil {
				results <- attemptResult{idx: idx, err: err}
				return
			}

			results <- attemptResult{
				idx:            idx,
				implementation: impl,
				verification:   verification,
			}
		}(i)
	}

	// Wait for all attempts
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results, pick first passing
	result.Attempts = 0
	for res := range results {
		result.Attempts++
		if res.err != nil {
			continue
		}

		if res.verification.Passed && result.SuccessfulIdx < 0 {
			result.Implementation = res.implementation
			result.Verification = res.verification
			result.SuccessfulIdx = res.idx
		}
	}

	// If none passed, use the last verification for diagnostics
	if result.SuccessfulIdx < 0 && result.Verification.BeadID == "" {
		result.Verification = Verification{
			BeadID: bead.ID,
			Passed: false,
		}
	}

	return result, nil
}

func (e *BeadExecutor) generateImplementation(
	ctx context.Context,
	bead Bead,
	dependencies map[string][]byte,
	attemptIdx int,
) ([]byte, error) {
	// Build dependency context
	depContext := make(map[string]interface{})
	for id, data := range dependencies {
		var parsed interface{}
		if err := json.Unmarshal(data, &parsed); err == nil {
			depContext[id] = parsed
		}
	}

	depJSON, _ := json.MarshalIndent(depContext, "", "  ")

	prompt := fmt.Sprintf(`Implement this bead.

Bead: %s
Description: %s

Contract Schema (CUE):
%s

Invariants that must hold:
%s

Thresholds:
%s

Dependencies (already implemented):
%s

Attempt #%d - Try a %s approach.

Return valid JSON that:
1. Satisfies the schema exactly
2. Maintains all invariants
3. Meets threshold requirements

Return ONLY the JSON output, no explanation.`,
		bead.Name,
		bead.Description,
		bead.Contract.Schema,
		formatInvariantsForPrompt(bead.Contract.Invariants),
		formatThresholdsForPrompt(bead.Contract.Thresholds),
		string(depJSON),
		attemptIdx+1,
		getApproach(attemptIdx))

	response, err := e.ai.Complete(ctx, prompt)
	if err != nil {
		return nil, err
	}

	// Validate it's valid JSON
	var parsed interface{}
	if err := json.Unmarshal([]byte(response), &parsed); err != nil {
		return nil, fmt.Errorf("invalid JSON response: %w", err)
	}

	// Re-marshal for consistent formatting
	return json.MarshalIndent(parsed, "", "  ")
}

func getApproach(idx int) string {
	approaches := []string{
		"straightforward",
		"minimal",
		"defensive",
		"alternative",
		"creative",
	}
	if idx < len(approaches) {
		return approaches[idx]
	}
	return "experimental"
}

func formatInvariantsForPrompt(invariants []Invariant) string {
	if len(invariants) == 0 {
		return "(none)"
	}
	result := ""
	for _, inv := range invariants {
		result += fmt.Sprintf("- %s: %s\n  Message if violated: %s\n",
			inv.Name, inv.Expression, inv.Message)
	}
	return result
}

func formatThresholdsForPrompt(thresholds []Threshold) string {
	if len(thresholds) == 0 {
		return "(none)"
	}
	result := ""
	for _, t := range thresholds {
		result += fmt.Sprintf("- %s: %s %s %v%s\n",
			t.Name, t.Metric, t.Operator, t.Value, t.Unit)
	}
	return result
}
