package openspec

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// =============================================================================
// CONTRACT COMPILER
// =============================================================================

// ContractCompiler transforms human intent into formal CUE contracts.
type ContractCompiler struct {
	ai AIClient
}

// NewContractCompiler creates a new contract compiler.
func NewContractCompiler(ai AIClient) *ContractCompiler {
	return &ContractCompiler{ai: ai}
}

// Compile transforms intent into contracts.
func (c *ContractCompiler) Compile(ctx context.Context, intent Intent) ([]Contract, error) {
	// Step 1: Extract entities and operations from intent
	entities, err := c.extractEntities(ctx, intent)
	if err != nil {
		return nil, fmt.Errorf("extract entities: %w", err)
	}

	// Step 2: Generate contract for each entity
	var contracts []Contract
	for _, entity := range entities {
		contract, err := c.generateContract(ctx, intent, entity)
		if err != nil {
			return nil, fmt.Errorf("generate contract for %s: %w", entity.Name, err)
		}
		contracts = append(contracts, contract)
	}

	// Step 3: Generate invariants across contracts
	invariants, err := c.generateCrossInvariants(ctx, contracts)
	if err != nil {
		return nil, fmt.Errorf("generate cross-invariants: %w", err)
	}

	// Add cross-cutting invariants to the first contract (or create a meta-contract)
	if len(contracts) > 0 && len(invariants) > 0 {
		contracts[0].Invariants = append(contracts[0].Invariants, invariants...)
	}

	return contracts, nil
}

// Entity represents something the system manipulates.
type Entity struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Operations  []string `json:"operations"`
	Properties  []string `json:"properties"`
}

func (c *ContractCompiler) extractEntities(ctx context.Context, intent Intent) ([]Entity, error) {
	prompt := fmt.Sprintf(`Extract entities from this intent.

Intent: %s
Goal: %s
Constraints: %s

Return JSON array of entities:
[{
  "name": "User",
  "description": "A person who uses the system",
  "operations": ["create", "authenticate", "update"],
  "properties": ["id", "email", "password_hash", "created_at"]
}]

Only include entities that need formal contracts.
Be specific about properties and their purposes.`,
		intent.Raw, intent.Goal, strings.Join(intent.Constraints, ", "))

	response, err := c.ai.Complete(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var entities []Entity
	if err := json.Unmarshal([]byte(response), &entities); err != nil {
		return nil, fmt.Errorf("parse entities: %w", err)
	}

	return entities, nil
}

func (c *ContractCompiler) generateContract(ctx context.Context, intent Intent, entity Entity) (Contract, error) {
	prompt := fmt.Sprintf(`Generate a CUE contract for this entity.

Entity: %s
Description: %s
Operations: %s
Properties: %s

Original Intent: %s

Return JSON:
{
  "schema": "CUE schema definition",
  "invariants": [
    {
      "name": "invariant name",
      "expression": "CUE constraint expression",
      "severity": "error",
      "message": "What this means when violated"
    }
  ],
  "thresholds": [
    {
      "name": "threshold name",
      "metric": "latency_p99",
      "operator": "<",
      "value": 100,
      "unit": "ms"
    }
  ],
  "examples": [
    {
      "name": "valid user",
      "input": "{}",
      "output": "{}",
      "valid": true
    }
  ]
}

CUE Schema Guidelines:
- Use CUE syntax for types and constraints
- Include field validations (string, int, etc.)
- Add regex patterns for strings where appropriate
- Include optional vs required fields
- Add bounds for numeric fields

Example CUE schema:
#User: {
    id:        string & =~"^[a-zA-Z0-9-]+$"
    email:     string & =~"^[^@]+@[^@]+$"
    name:      string & strings.MinRunes(1) & strings.MaxRunes(100)
    age?:      int & >=0 & <=150
    createdAt: string  // ISO8601
}`,
		entity.Name, entity.Description,
		strings.Join(entity.Operations, ", "),
		strings.Join(entity.Properties, ", "),
		intent.Raw)

	response, err := c.ai.Complete(ctx, prompt)
	if err != nil {
		return Contract{}, err
	}

	var result struct {
		Schema     string      `json:"schema"`
		Invariants []Invariant `json:"invariants"`
		Thresholds []Threshold `json:"thresholds"`
		Examples   []Example   `json:"examples"`
	}

	if err := json.Unmarshal([]byte(response), &result); err != nil {
		return Contract{}, fmt.Errorf("parse contract: %w", err)
	}

	// Assign IDs
	for i := range result.Invariants {
		result.Invariants[i].ID = uuid.New().String()
	}
	for i := range result.Thresholds {
		result.Thresholds[i].ID = uuid.New().String()
	}

	return Contract{
		ID:          uuid.New().String(),
		Name:        entity.Name,
		Description: entity.Description,
		Schema:      result.Schema,
		Invariants:  result.Invariants,
		Thresholds:  result.Thresholds,
		Examples:    result.Examples,
		Metadata: map[string]string{
			"intent_id":  intent.ID,
			"created_at": time.Now().Format(time.RFC3339),
		},
	}, nil
}

func (c *ContractCompiler) generateCrossInvariants(ctx context.Context, contracts []Contract) ([]Invariant, error) {
	if len(contracts) < 2 {
		return nil, nil
	}

	contractNames := make([]string, len(contracts))
	for i, c := range contracts {
		contractNames[i] = c.Name
	}

	prompt := fmt.Sprintf(`Generate cross-cutting invariants for these contracts.

Contracts: %s

These invariants should capture relationships BETWEEN contracts.
For example: "Every Order must reference a valid User"

Return JSON array:
[{
  "name": "order_user_exists",
  "expression": "order.userId in users[*].id",
  "severity": "error",
  "message": "Order must reference existing user"
}]

Only include invariants that span multiple contracts.`,
		strings.Join(contractNames, ", "))

	response, err := c.ai.Complete(ctx, prompt)
	if err != nil {
		return nil, err
	}

	var invariants []Invariant
	if err := json.Unmarshal([]byte(response), &invariants); err != nil {
		return nil, fmt.Errorf("parse invariants: %w", err)
	}

	for i := range invariants {
		invariants[i].ID = uuid.New().String()
	}

	return invariants, nil
}

// =============================================================================
// AI CLIENT INTERFACE
// =============================================================================

// AIClient interface for AI completions.
type AIClient interface {
	Complete(ctx context.Context, prompt string) (string, error)
}
