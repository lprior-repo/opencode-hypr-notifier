// Package openspec - Contract-first development with verified beads
//
// OpenSpec transforms human intent into formal contracts, then breaks
// work into tiny, verified beads. Each bead has contracts, invariants,
// and thresholds that must be satisfied.
//
// Flow:
//   Intent → Contracts → Beads → Verification → Assembly
//
// Unlike test-based approaches, OpenSpec uses formal specifications
// (CUE-style) that can be verified statically and at runtime.
package openspec

import (
	"context"
	"time"
)

// =============================================================================
// THE LANGUAGE OF CONTRACTS
// =============================================================================

// Contract defines what must be true. Not a test, but a formal specification.
// Contracts are written in CUE and can be verified statically.
type Contract struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Schema      string            `json:"schema"`      // CUE schema
	Invariants  []Invariant       `json:"invariants"`  // Must always hold
	Thresholds  []Threshold       `json:"thresholds"`  // Performance bounds
	Examples    []Example         `json:"examples"`    // Valid instances
	Metadata    map[string]string `json:"metadata"`
}

// Invariant is something that must ALWAYS be true.
// Written as a CUE constraint expression.
type Invariant struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Expression string `json:"expression"` // CUE expression: "len(users) >= 0"
	Severity   string `json:"severity"`   // "error" | "warning"
	Message    string `json:"message"`    // Human explanation when violated
}

// Threshold defines acceptable bounds for non-functional requirements.
type Threshold struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Metric    string  `json:"metric"`    // "latency_p99" | "memory_mb" | "error_rate"
	Operator  string  `json:"operator"`  // "<" | "<=" | ">" | ">=" | "=="
	Value     float64 `json:"value"`     // The threshold value
	Unit      string  `json:"unit"`      // "ms" | "mb" | "percent"
	Tolerance float64 `json:"tolerance"` // Acceptable deviation (0.0-1.0)
}

// Example is a concrete instance that satisfies the contract.
// Used for documentation and property-based test generation.
type Example struct {
	Name   string `json:"name"`
	Input  string `json:"input"`  // JSON
	Output string `json:"output"` // JSON
	Valid  bool   `json:"valid"`  // Should this pass or fail?
}

// =============================================================================
// THE LANGUAGE OF BEADS
// =============================================================================

// Bead is the smallest unit of verified work.
// A bead is so small that it's either completely right or completely wrong.
// No partial success. No "it mostly works."
type Bead struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Contract    Contract   `json:"contract"`    // What this bead must satisfy
	Requires    []string   `json:"requires"`    // IDs of beads this depends on
	Produces    []string   `json:"produces"`    // What this bead outputs
	Size        BeadSize   `json:"size"`        // Estimated complexity
	Status      BeadStatus `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
}

// BeadSize indicates complexity. Beads should almost always be XS or S.
type BeadSize string

const (
	BeadXS BeadSize = "xs" // < 10 lines, single function
	BeadS  BeadSize = "s"  // 10-30 lines, single component
	BeadM  BeadSize = "m"  // 30-100 lines, should be split
	BeadL  BeadSize = "l"  // > 100 lines, must be split
)

// BeadStatus tracks where a bead is in the workflow.
type BeadStatus string

const (
	BeadDraft      BeadStatus = "draft"      // Being defined
	BeadSpecified  BeadStatus = "specified"  // Contract complete
	BeadReady      BeadStatus = "ready"      // Ready for implementation
	BeadInProgress BeadStatus = "in_progress"
	BeadVerifying  BeadStatus = "verifying"  // Running verification
	BeadVerified   BeadStatus = "verified"   // All checks passed
	BeadFailed     BeadStatus = "failed"     // Verification failed
	BeadComplete   BeadStatus = "complete"   // Integrated
)

// =============================================================================
// THE LANGUAGE OF VERIFICATION
// =============================================================================

// Verification is the result of checking a bead against its contract.
type Verification struct {
	BeadID           string              `json:"bead_id"`
	Passed           bool                `json:"passed"`
	ContractChecks   []ContractCheck     `json:"contract_checks"`
	InvariantChecks  []InvariantCheck    `json:"invariant_checks"`
	ThresholdChecks  []ThresholdCheck    `json:"threshold_checks"`
	PropertyChecks   []PropertyCheck     `json:"property_checks"`
	Duration         time.Duration       `json:"duration"`
	Timestamp        time.Time           `json:"timestamp"`
}

// ContractCheck verifies the implementation matches the schema.
type ContractCheck struct {
	ContractID string `json:"contract_id"`
	Passed     bool   `json:"passed"`
	Errors     []string `json:"errors"`
}

// InvariantCheck verifies an invariant holds.
type InvariantCheck struct {
	InvariantID string `json:"invariant_id"`
	Passed      bool   `json:"passed"`
	Expression  string `json:"expression"`
	Actual      string `json:"actual"` // What we got
	Message     string `json:"message"`
}

// ThresholdCheck verifies a threshold is met.
type ThresholdCheck struct {
	ThresholdID string  `json:"threshold_id"`
	Passed      bool    `json:"passed"`
	Expected    float64 `json:"expected"`
	Actual      float64 `json:"actual"`
	Unit        string  `json:"unit"`
}

// PropertyCheck is a property-based test result (Schemathesis-style).
type PropertyCheck struct {
	Property     string   `json:"property"`
	Passed       bool     `json:"passed"`
	Iterations   int      `json:"iterations"`
	Failures     int      `json:"failures"`
	Counterexample string `json:"counterexample,omitempty"`
}

// =============================================================================
// THE LANGUAGE OF INTENT
// =============================================================================

// Intent is what the human wants, before contracts exist.
type Intent struct {
	ID          string            `json:"id"`
	Raw         string            `json:"raw"`         // Original message
	Goal        string            `json:"goal"`        // What success looks like
	Constraints []string          `json:"constraints"` // Must/must not
	Context     map[string]string `json:"context"`     // Additional info
	CreatedAt   time.Time         `json:"created_at"`
}

// Spec is the complete specification: contracts + beads.
type Spec struct {
	ID        string     `json:"id"`
	IntentID  string     `json:"intent_id"`
	Contracts []Contract `json:"contracts"`
	Beads     []Bead     `json:"beads"`
	Order     []string   `json:"order"` // Bead IDs in execution order
	CreatedAt time.Time  `json:"created_at"`
}

// =============================================================================
// THE INTERFACES
// =============================================================================

// Compiler transforms intent into contracts.
type Compiler interface {
	// Compile transforms human intent into formal contracts.
	Compile(ctx context.Context, intent Intent) ([]Contract, error)
}

// Decomposer breaks contracts into beads.
type Decomposer interface {
	// Decompose breaks a set of contracts into minimal beads.
	Decompose(ctx context.Context, contracts []Contract) ([]Bead, error)
}

// Verifier checks beads against their contracts.
type Verifier interface {
	// Verify checks a bead implementation against its contract.
	Verify(ctx context.Context, bead Bead, implementation []byte) (Verification, error)
}

// Executor runs beads and assembles results.
type Executor interface {
	// Execute implements a bead and returns the result.
	Execute(ctx context.Context, bead Bead) ([]byte, error)
}

// Store persists specs, contracts, and beads.
type Store interface {
	SaveIntent(ctx context.Context, intent Intent) error
	GetIntent(ctx context.Context, id string) (Intent, error)

	SaveSpec(ctx context.Context, spec Spec) error
	GetSpec(ctx context.Context, id string) (Spec, error)

	SaveBead(ctx context.Context, bead Bead) error
	GetBead(ctx context.Context, id string) (Bead, error)
	UpdateBeadStatus(ctx context.Context, id string, status BeadStatus) error

	SaveVerification(ctx context.Context, v Verification) error
	GetVerification(ctx context.Context, beadID string) (Verification, error)
}
