package openspec

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// =============================================================================
// OPENSPEC ENGINE
// =============================================================================

// Engine is the main OpenSpec orchestrator.
// It transforms human intent into verified, working code through:
//   Intent → Contracts → Beads → Verification → Assembly
type Engine struct {
	compiler   *ContractCompiler
	decomposer *BeadDecomposer
	executor   *BeadExecutor
	verifier   *CUEVerifier
	store      Store
}

// NewEngine creates a new OpenSpec engine.
func NewEngine(ai AIClient, store Store) *Engine {
	verifier := NewCUEVerifier()
	return &Engine{
		compiler:   NewContractCompiler(ai),
		decomposer: NewBeadDecomposer(ai),
		executor:   NewBeadExecutor(ai, verifier, store),
		verifier:   verifier,
		store:      store,
	}
}

// =============================================================================
// THE MAIN FLOW
// =============================================================================

// SpecResult is the result of the spec phase.
type SpecResult struct {
	Spec       Spec
	Contracts  []Contract
	Beads      []Bead
	NeedsClarification bool
	Questions  []string
}

// ExecuteResult is the result of the execute phase.
type ExecuteResult struct {
	Results    []BeadResult
	AllPassed  bool
	Failures   []BeadFailure
}

// BeadFailure describes a failed bead.
type BeadFailure struct {
	Bead         Bead
	Verification Verification
	Message      string
}

// Spec transforms intent into a complete specification with contracts and beads.
func (e *Engine) Spec(ctx context.Context, raw string) (*SpecResult, error) {
	// Create intent
	intent := Intent{
		ID:        uuid.New().String(),
		Raw:       raw,
		CreatedAt: time.Now(),
	}

	// Save intent
	if err := e.store.SaveIntent(ctx, intent); err != nil {
		return nil, fmt.Errorf("save intent: %w", err)
	}

	// Step 1: Compile intent into contracts
	contracts, err := e.compiler.Compile(ctx, intent)
	if err != nil {
		return nil, fmt.Errorf("compile contracts: %w", err)
	}

	// Step 2: Decompose contracts into beads
	beads, err := e.decomposer.Decompose(ctx, contracts)
	if err != nil {
		return nil, fmt.Errorf("decompose beads: %w", err)
	}

	// Create the spec
	beadOrder := make([]string, len(beads))
	for i, b := range beads {
		beadOrder[i] = b.ID
	}

	spec := Spec{
		ID:        uuid.New().String(),
		IntentID:  intent.ID,
		Contracts: contracts,
		Beads:     beads,
		Order:     beadOrder,
		CreatedAt: time.Now(),
	}

	// Save spec
	if err := e.store.SaveSpec(ctx, spec); err != nil {
		return nil, fmt.Errorf("save spec: %w", err)
	}

	// Save beads
	for _, bead := range beads {
		if err := e.store.SaveBead(ctx, bead); err != nil {
			return nil, fmt.Errorf("save bead: %w", err)
		}
	}

	return &SpecResult{
		Spec:      spec,
		Contracts: contracts,
		Beads:     beads,
	}, nil
}

// Execute implements all beads in a spec, verifying each.
func (e *Engine) Execute(ctx context.Context, specID string) (*ExecuteResult, error) {
	// Load spec
	spec, err := e.store.GetSpec(ctx, specID)
	if err != nil {
		return nil, fmt.Errorf("load spec: %w", err)
	}

	// Load beads in order
	beads := make([]Bead, len(spec.Order))
	for i, beadID := range spec.Order {
		bead, err := e.store.GetBead(ctx, beadID)
		if err != nil {
			return nil, fmt.Errorf("load bead %s: %w", beadID, err)
		}
		beads[i] = bead
	}

	// Execute all beads
	results, err := e.executor.ExecuteAll(ctx, beads)
	if err != nil {
		return nil, fmt.Errorf("execute beads: %w", err)
	}

	// Collect results
	execResult := &ExecuteResult{
		Results:   results,
		AllPassed: true,
	}

	for _, r := range results {
		if !r.Verification.Passed {
			execResult.AllPassed = false
			execResult.Failures = append(execResult.Failures, BeadFailure{
				Bead:         r.Bead,
				Verification: r.Verification,
				Message:      summarizeFailure(r.Verification),
			})
		}
	}

	return execResult, nil
}

// Run does the complete flow: Spec → Execute → Assemble
func (e *Engine) Run(ctx context.Context, raw string) (*RunResult, error) {
	// Phase 1: Spec
	specResult, err := e.Spec(ctx, raw)
	if err != nil {
		return nil, fmt.Errorf("spec phase: %w", err)
	}

	// Phase 2: Execute
	execResult, err := e.Execute(ctx, specResult.Spec.ID)
	if err != nil {
		return nil, fmt.Errorf("execute phase: %w", err)
	}

	return &RunResult{
		Spec:      specResult.Spec,
		Contracts: specResult.Contracts,
		Beads:     specResult.Beads,
		Results:   execResult.Results,
		AllPassed: execResult.AllPassed,
		Failures:  execResult.Failures,
	}, nil
}

// RunResult is the complete result of an OpenSpec run.
type RunResult struct {
	Spec      Spec
	Contracts []Contract
	Beads     []Bead
	Results   []BeadResult
	AllPassed bool
	Failures  []BeadFailure
}

func summarizeFailure(v Verification) string {
	if len(v.ContractChecks) > 0 {
		for _, c := range v.ContractChecks {
			if !c.Passed && len(c.Errors) > 0 {
				return fmt.Sprintf("Contract: %s", c.Errors[0])
			}
		}
	}

	if len(v.InvariantChecks) > 0 {
		for _, c := range v.InvariantChecks {
			if !c.Passed {
				return fmt.Sprintf("Invariant %s: %s", c.Expression, c.Message)
			}
		}
	}

	if len(v.ThresholdChecks) > 0 {
		for _, c := range v.ThresholdChecks {
			if !c.Passed {
				return fmt.Sprintf("Threshold: expected %v%s, got %v%s",
					c.Expected, c.Unit, c.Actual, c.Unit)
			}
		}
	}

	return "Unknown failure"
}

// =============================================================================
// DISPLAY HELPERS
// =============================================================================

// Summary returns a human-readable summary of the run.
func (r *RunResult) Summary() string {
	s := fmt.Sprintf("OpenSpec Run Summary\n")
	s += fmt.Sprintf("====================\n\n")

	s += fmt.Sprintf("Contracts: %d\n", len(r.Contracts))
	for _, c := range r.Contracts {
		s += fmt.Sprintf("  - %s: %d invariants, %d thresholds\n",
			c.Name, len(c.Invariants), len(c.Thresholds))
	}

	s += fmt.Sprintf("\nBeads: %d\n", len(r.Beads))
	for _, b := range r.Beads {
		status := "?"
		for _, res := range r.Results {
			if res.Bead.ID == b.ID {
				if res.Verification.Passed {
					status = "✓"
				} else {
					status = "✗"
				}
				break
			}
		}
		s += fmt.Sprintf("  [%s] %s (%s)\n", status, b.Name, b.Size)
	}

	s += fmt.Sprintf("\nResult: ")
	if r.AllPassed {
		s += "ALL PASSED\n"
	} else {
		s += fmt.Sprintf("%d FAILURES\n", len(r.Failures))
		for _, f := range r.Failures {
			s += fmt.Sprintf("  - %s: %s\n", f.Bead.Name, f.Message)
		}
	}

	return s
}
