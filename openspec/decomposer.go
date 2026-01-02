package openspec

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// =============================================================================
// BEAD DECOMPOSER
// =============================================================================

// BeadDecomposer breaks contracts into minimal, verifiable beads.
// Each bead should be so small that it's trivially correct or obviously wrong.
type BeadDecomposer struct {
	ai          AIClient
	maxBeadSize BeadSize
}

// NewBeadDecomposer creates a new decomposer.
func NewBeadDecomposer(ai AIClient) *BeadDecomposer {
	return &BeadDecomposer{
		ai:          ai,
		maxBeadSize: BeadS, // Beads larger than S should be split
	}
}

// Decompose breaks contracts into beads.
func (d *BeadDecomposer) Decompose(ctx context.Context, contracts []Contract) ([]Bead, error) {
	var allBeads []Bead

	// Step 1: Generate initial beads from each contract
	for _, contract := range contracts {
		beads, err := d.decomposeContract(ctx, contract)
		if err != nil {
			return nil, fmt.Errorf("decompose %s: %w", contract.Name, err)
		}
		allBeads = append(allBeads, beads...)
	}

	// Step 2: Check sizes and split any beads that are too large
	allBeads, err := d.ensureSmallBeads(ctx, allBeads)
	if err != nil {
		return nil, fmt.Errorf("ensure small beads: %w", err)
	}

	// Step 3: Resolve dependencies and order
	allBeads, err = d.resolveDependencies(ctx, allBeads)
	if err != nil {
		return nil, fmt.Errorf("resolve dependencies: %w", err)
	}

	return allBeads, nil
}

func (d *BeadDecomposer) decomposeContract(ctx context.Context, contract Contract) ([]Bead, error) {
	prompt := fmt.Sprintf(`Decompose this contract into minimal beads.

Contract: %s
Description: %s
Schema:
%s

Invariants:
%s

A bead is the SMALLEST unit of work that can be verified.
Each bead should:
- Do exactly ONE thing
- Be < 30 lines of code
- Have clear inputs and outputs
- Be independently testable
- Have a clear contract (subset of the main contract)

Return JSON array:
[{
  "name": "create_user_validation",
  "description": "Validate user input before creation",
  "size": "xs",
  "contract": {
    "schema": "Subset of CUE schema this bead satisfies",
    "invariants": ["Relevant invariant IDs"]
  },
  "requires": [],
  "produces": ["validated_user_input"]
}]

Err on the side of MORE, SMALLER beads.
A bead that's "too small" is better than one that's "just right."`,
		contract.Name,
		contract.Description,
		contract.Schema,
		formatInvariants(contract.Invariants))

	response, err := d.ai.Complete(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var rawBeads []struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Size        string   `json:"size"`
		Contract    struct {
			Schema     string   `json:"schema"`
			Invariants []string `json:"invariants"`
		} `json:"contract"`
		Requires []string `json:"requires"`
		Produces []string `json:"produces"`
	}

	if err := json.Unmarshal([]byte(response), &rawBeads); err != nil {
		return nil, fmt.Errorf("parse beads: %w", err)
	}

	beads := make([]Bead, len(rawBeads))
	for i, raw := range rawBeads {
		// Find matching invariants
		var invariants []Invariant
		for _, invID := range raw.Contract.Invariants {
			for _, inv := range contract.Invariants {
				if inv.ID == invID || inv.Name == invID {
					invariants = append(invariants, inv)
				}
			}
		}

		beads[i] = Bead{
			ID:          uuid.New().String(),
			Name:        raw.Name,
			Description: raw.Description,
			Contract: Contract{
				ID:          uuid.New().String(),
				Name:        raw.Name + "_contract",
				Description: "Contract for " + raw.Name,
				Schema:      raw.Contract.Schema,
				Invariants:  invariants,
				Thresholds:  contract.Thresholds, // Inherit thresholds
			},
			Requires:  raw.Requires,
			Produces:  raw.Produces,
			Size:      parseBeadSize(raw.Size),
			Status:    BeadSpecified,
			CreatedAt: time.Now(),
		}
	}

	return beads, nil
}

func (d *BeadDecomposer) ensureSmallBeads(ctx context.Context, beads []Bead) ([]Bead, error) {
	var result []Bead

	for _, bead := range beads {
		if bead.Size <= d.maxBeadSize {
			result = append(result, bead)
			continue
		}

		// Bead is too large, split it
		split, err := d.splitBead(ctx, bead)
		if err != nil {
			return nil, fmt.Errorf("split %s: %w", bead.Name, err)
		}
		result = append(result, split...)
	}

	return result, nil
}

func (d *BeadDecomposer) splitBead(ctx context.Context, bead Bead) ([]Bead, error) {
	prompt := fmt.Sprintf(`This bead is too large. Split it into smaller beads.

Bead: %s
Description: %s
Size: %s (should be xs or s)
Contract Schema: %s

Split into 2-4 smaller beads, each doing ONE specific thing.
Each new bead must be size "xs" or "s".

Return JSON array of smaller beads.`,
		bead.Name, bead.Description, bead.Size, bead.Contract.Schema)

	response, err := d.ai.Complete(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var rawBeads []struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Size        string `json:"size"`
		Schema      string `json:"schema"`
	}

	if err := json.Unmarshal([]byte(response), &rawBeads); err != nil {
		return nil, fmt.Errorf("parse split beads: %w", err)
	}

	result := make([]Bead, len(rawBeads))
	for i, raw := range rawBeads {
		result[i] = Bead{
			ID:          uuid.New().String(),
			Name:        raw.Name,
			Description: raw.Description,
			Contract: Contract{
				ID:          uuid.New().String(),
				Name:        raw.Name + "_contract",
				Schema:      raw.Schema,
				Invariants:  bead.Contract.Invariants, // Inherit
				Thresholds:  bead.Contract.Thresholds,
			},
			Requires:  bead.Requires,
			Produces:  bead.Produces,
			Size:      parseBeadSize(raw.Size),
			Status:    BeadSpecified,
			CreatedAt: time.Now(),
		}
	}

	return result, nil
}

func (d *BeadDecomposer) resolveDependencies(ctx context.Context, beads []Bead) ([]Bead, error) {
	// Build dependency graph
	produces := make(map[string]string) // output -> bead ID
	for _, bead := range beads {
		for _, p := range bead.Produces {
			produces[p] = bead.ID
		}
	}

	// Resolve requires to bead IDs
	for i := range beads {
		var resolved []string
		for _, req := range beads[i].Requires {
			if beadID, ok := produces[req]; ok {
				resolved = append(resolved, beadID)
			}
		}
		beads[i].Requires = resolved
	}

	// Topological sort
	return topologicalSort(beads)
}

func topologicalSort(beads []Bead) ([]Bead, error) {
	// Build adjacency and in-degree
	inDegree := make(map[string]int)
	adj := make(map[string][]string)
	beadMap := make(map[string]Bead)

	for _, bead := range beads {
		beadMap[bead.ID] = bead
		if _, ok := inDegree[bead.ID]; !ok {
			inDegree[bead.ID] = 0
		}
		for _, req := range bead.Requires {
			adj[req] = append(adj[req], bead.ID)
			inDegree[bead.ID]++
		}
	}

	// Find all beads with no dependencies
	var queue []string
	for id, degree := range inDegree {
		if degree == 0 {
			queue = append(queue, id)
		}
	}

	var result []Bead
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		result = append(result, beadMap[id])

		for _, next := range adj[id] {
			inDegree[next]--
			if inDegree[next] == 0 {
				queue = append(queue, next)
			}
		}
	}

	if len(result) != len(beads) {
		return nil, fmt.Errorf("circular dependency detected")
	}

	return result, nil
}

func parseBeadSize(s string) BeadSize {
	switch s {
	case "xs":
		return BeadXS
	case "s":
		return BeadS
	case "m":
		return BeadM
	case "l":
		return BeadL
	default:
		return BeadM
	}
}

func formatInvariants(invariants []Invariant) string {
	var lines []string
	for _, inv := range invariants {
		lines = append(lines, fmt.Sprintf("- %s: %s (%s)", inv.Name, inv.Expression, inv.Severity))
	}
	return fmt.Sprintf("[%s]", fmt.Sprintf("%v", lines))
}
