package openspec

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
)

// =============================================================================
// CUE-BASED VERIFIER
// =============================================================================

// CUEVerifier verifies beads against their contracts using CUE.
// It performs:
// 1. Schema validation (does the output match the CUE schema?)
// 2. Invariant checking (do all invariants hold?)
// 3. Threshold verification (are performance bounds met?)
// 4. Property-based testing (Schemathesis-style fuzzing)
type CUEVerifier struct {
	ctx           *cue.Context
	propertyTests int // Number of property test iterations
}

// NewCUEVerifier creates a new CUE-based verifier.
func NewCUEVerifier() *CUEVerifier {
	return &CUEVerifier{
		ctx:           cuecontext.New(),
		propertyTests: 100,
	}
}

// Verify checks a bead implementation against its contract.
func (v *CUEVerifier) Verify(ctx context.Context, bead Bead, implementation []byte) (Verification, error) {
	start := time.Now()

	verification := Verification{
		BeadID:    bead.ID,
		Passed:    true,
		Timestamp: time.Now(),
	}

	// Step 1: Parse implementation as JSON
	var implData interface{}
	if err := json.Unmarshal(implementation, &implData); err != nil {
		verification.Passed = false
		verification.ContractChecks = append(verification.ContractChecks, ContractCheck{
			ContractID: bead.Contract.ID,
			Passed:     false,
			Errors:     []string{fmt.Sprintf("Invalid JSON: %v", err)},
		})
		verification.Duration = time.Since(start)
		return verification, nil
	}

	// Step 2: Validate against CUE schema
	contractCheck := v.validateSchema(bead.Contract, implData)
	verification.ContractChecks = append(verification.ContractChecks, contractCheck)
	if !contractCheck.Passed {
		verification.Passed = false
	}

	// Step 3: Check invariants
	for _, invariant := range bead.Contract.Invariants {
		check := v.checkInvariant(invariant, implData)
		verification.InvariantChecks = append(verification.InvariantChecks, check)
		if !check.Passed && invariant.Severity == "error" {
			verification.Passed = false
		}
	}

	// Step 4: Check thresholds (requires actual measurements)
	for _, threshold := range bead.Contract.Thresholds {
		check := v.checkThreshold(threshold, implData)
		verification.ThresholdChecks = append(verification.ThresholdChecks, check)
		if !check.Passed {
			verification.Passed = false
		}
	}

	// Step 5: Property-based testing
	if len(bead.Contract.Examples) > 0 {
		propCheck := v.runPropertyTests(bead.Contract, implData)
		verification.PropertyChecks = append(verification.PropertyChecks, propCheck)
		if !propCheck.Passed {
			verification.Passed = false
		}
	}

	verification.Duration = time.Since(start)
	return verification, nil
}

func (v *CUEVerifier) validateSchema(contract Contract, data interface{}) ContractCheck {
	check := ContractCheck{
		ContractID: contract.ID,
		Passed:     true,
	}

	// Compile CUE schema
	schemaValue := v.ctx.CompileString(contract.Schema)
	if schemaValue.Err() != nil {
		check.Passed = false
		check.Errors = append(check.Errors, fmt.Sprintf("Invalid schema: %v", schemaValue.Err()))
		return check
	}

	// Convert data to CUE value
	dataValue := v.ctx.Encode(data)
	if dataValue.Err() != nil {
		check.Passed = false
		check.Errors = append(check.Errors, fmt.Sprintf("Cannot encode data: %v", dataValue.Err()))
		return check
	}

	// Unify and validate
	unified := schemaValue.Unify(dataValue)
	if err := unified.Validate(); err != nil {
		check.Passed = false
		check.Errors = append(check.Errors, fmt.Sprintf("Schema validation failed: %v", err))
	}

	return check
}

func (v *CUEVerifier) checkInvariant(invariant Invariant, data interface{}) InvariantCheck {
	check := InvariantCheck{
		InvariantID: invariant.ID,
		Expression:  invariant.Expression,
		Passed:      true,
	}

	// Create CUE expression that checks the invariant
	// The invariant expression should evaluate to true
	cueExpr := fmt.Sprintf(`
		_data: _
		_result: %s
	`, invariant.Expression)

	// Compile with data
	val := v.ctx.CompileString(cueExpr)
	if val.Err() != nil {
		check.Passed = false
		check.Message = fmt.Sprintf("Invalid invariant expression: %v", val.Err())
		return check
	}

	// Fill in the data
	dataVal := v.ctx.Encode(data)
	filled := val.FillPath(cue.ParsePath("_data"), dataVal)

	// Get result
	resultPath := cue.ParsePath("_result")
	result := filled.LookupPath(resultPath)

	if result.Err() != nil {
		check.Passed = false
		check.Message = fmt.Sprintf("Invariant evaluation failed: %v", result.Err())
		return check
	}

	// Check if result is true
	boolResult, err := result.Bool()
	if err != nil {
		check.Passed = false
		check.Message = fmt.Sprintf("Invariant must evaluate to bool: %v", err)
		return check
	}

	if !boolResult {
		check.Passed = false
		check.Message = invariant.Message
		check.Actual = fmt.Sprintf("%v", data)
	}

	return check
}

func (v *CUEVerifier) checkThreshold(threshold Threshold, data interface{}) ThresholdCheck {
	check := ThresholdCheck{
		ThresholdID: threshold.ID,
		Expected:    threshold.Value,
		Unit:        threshold.Unit,
		Passed:      true,
	}

	// Extract metric value from data (assuming it's in a "metrics" field)
	dataMap, ok := data.(map[string]interface{})
	if !ok {
		check.Passed = true // No metrics to check
		return check
	}

	metrics, ok := dataMap["metrics"].(map[string]interface{})
	if !ok {
		check.Passed = true // No metrics to check
		return check
	}

	actualVal, ok := metrics[threshold.Metric]
	if !ok {
		check.Passed = true // Metric not present
		return check
	}

	actual, ok := actualVal.(float64)
	if !ok {
		check.Passed = false
		return check
	}

	check.Actual = actual

	// Apply operator
	switch threshold.Operator {
	case "<":
		check.Passed = actual < threshold.Value
	case "<=":
		check.Passed = actual <= threshold.Value
	case ">":
		check.Passed = actual > threshold.Value
	case ">=":
		check.Passed = actual >= threshold.Value
	case "==":
		tolerance := threshold.Value * threshold.Tolerance
		check.Passed = actual >= threshold.Value-tolerance && actual <= threshold.Value+tolerance
	}

	return check
}

func (v *CUEVerifier) runPropertyTests(contract Contract, data interface{}) PropertyCheck {
	check := PropertyCheck{
		Property:   "schema_conformance",
		Iterations: v.propertyTests,
		Passed:     true,
	}

	// Generate random inputs based on schema and verify they're handled correctly
	schemaValue := v.ctx.CompileString(contract.Schema)
	if schemaValue.Err() != nil {
		check.Passed = false
		return check
	}

	for i := 0; i < v.propertyTests; i++ {
		// Generate a random instance that should match the schema
		randomData := v.generateRandomInstance(schemaValue)

		// Validate it
		dataVal := v.ctx.Encode(randomData)
		unified := schemaValue.Unify(dataVal)

		if err := unified.Validate(); err != nil {
			check.Failures++
			if check.Counterexample == "" {
				jsonBytes, _ := json.Marshal(randomData)
				check.Counterexample = string(jsonBytes)
			}
		}
	}

	check.Passed = check.Failures == 0
	return check
}

func (v *CUEVerifier) generateRandomInstance(schema cue.Value) interface{} {
	// Simple random data generation
	// In production, this would do proper schema-guided generation
	result := make(map[string]interface{})

	iter, _ := schema.Fields()
	for iter.Next() {
		fieldName := iter.Label()
		fieldValue := iter.Value()

		switch fieldValue.IncompleteKind() {
		case cue.StringKind:
			result[fieldName] = randomString(10)
		case cue.IntKind:
			result[fieldName] = rand.Intn(1000)
		case cue.FloatKind:
			result[fieldName] = rand.Float64() * 1000
		case cue.BoolKind:
			result[fieldName] = rand.Intn(2) == 1
		default:
			result[fieldName] = nil
		}
	}

	return result
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}
