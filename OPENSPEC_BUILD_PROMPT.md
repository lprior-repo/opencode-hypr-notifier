# BUILD PROMPT: OpenSpec

## What You Are Building

**OpenSpec** - A Go tool that transforms human intent into verified working code through contracts and tiny verified beads.

```
Intent → Contracts → Beads → Verification → Assembly
```

**Not** generate-and-test. **Contracts first**, then tiny verified work units.

---

## The Philosophy

### Contracts, Not Tests

Tests ask: "Does this specific case pass?"
Contracts ask: "What must ALWAYS be true?"

```
// Test (specific)
assert(createUser("test@email.com").success == true)

// Contract (universal)
#User: {
    email: =~"^[^@]+@[^@]+$"
    id: string & len(id) > 0
    createdAt: time.Time
}

// Invariant: Every user has a valid email
_valid: email =~ "^[^@]+@[^@]+$"
```

### Beads, Not Tasks

Tasks can be "mostly done" or "partially working."
Beads are binary: **verified** or **failed**.

```
Bead properties:
- Size XS or S only (< 30 lines)
- One contract to satisfy
- Invariants that must hold
- Thresholds to meet
- Clear inputs/outputs
- No partial success
```

### The Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         HUMAN INTENT                            │
│  "Add user authentication with email and password"              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CONTRACT COMPILER                           │
│                                                                 │
│  Extracts entities:  User, Session, Credentials                 │
│  Generates schemas:  CUE definitions for each                   │
│  Defines invariants: "password never stored plain text"         │
│  Sets thresholds:    "auth < 100ms p99"                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BEAD DECOMPOSER                             │
│                                                                 │
│  Breaks contracts into minimal beads:                           │
│    - validate_email (xs)                                        │
│    - hash_password (xs)                                         │
│    - create_user_record (s)                                     │
│    - generate_session (xs)                                      │
│    - verify_credentials (s)                                     │
│                                                                 │
│  Each bead: one thing, one contract, verifiable                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BEAD EXECUTOR                               │
│                                                                 │
│  For each bead (in dependency order):                           │
│    1. Generate N implementations (parallel)                     │
│    2. Verify each against contract                              │
│    3. Check invariants hold                                     │
│    4. Measure against thresholds                                │
│    5. Pick first that passes ALL checks                         │
│                                                                 │
│  No partial success. Verified or failed.                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        ASSEMBLY                                 │
│                                                                 │
│  All beads verified → combine into complete implementation      │
│  Any bead failed → report exactly what failed and why           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Types

```go
// Contract defines what must be true
type Contract struct {
    ID          string
    Name        string
    Schema      string      // CUE schema
    Invariants  []Invariant // Must ALWAYS hold
    Thresholds  []Threshold // Performance bounds
    Examples    []Example   // Valid instances
}

// Invariant is an inviolable truth
type Invariant struct {
    Name       string
    Expression string // CUE: "len(password) >= 8"
    Severity   string // "error" | "warning"
    Message    string // Human explanation when violated
}

// Threshold is a measurable bound
type Threshold struct {
    Metric   string  // "latency_p99" | "memory_mb"
    Operator string  // "<" | "<=" | ">" | ">="
    Value    float64 // The bound
    Unit     string  // "ms" | "mb" | "percent"
}

// Bead is the smallest unit of verified work
type Bead struct {
    ID          string
    Name        string
    Contract    Contract   // What this bead satisfies
    Requires    []string   // Dependencies (other bead IDs)
    Produces    []string   // What this outputs
    Size        BeadSize   // XS or S only
    Status      BeadStatus // verified | failed
}

type BeadSize string
const (
    BeadXS BeadSize = "xs" // < 10 lines
    BeadS  BeadSize = "s"  // 10-30 lines
)

// Verification is the result of checking a bead
type Verification struct {
    BeadID          string
    Passed          bool
    ContractChecks  []ContractCheck
    InvariantChecks []InvariantCheck
    ThresholdChecks []ThresholdCheck
    PropertyChecks  []PropertyCheck // Schemathesis-style
}
```

---

## The CUE Verifier

Uses CUE for schema validation and invariant checking:

```go
// Validate against schema
func (v *CUEVerifier) validateSchema(contract Contract, data interface{}) ContractCheck {
    schemaValue := v.ctx.CompileString(contract.Schema)
    dataValue := v.ctx.Encode(data)
    unified := schemaValue.Unify(dataValue)

    if err := unified.Validate(); err != nil {
        return ContractCheck{Passed: false, Errors: []string{err.Error()}}
    }
    return ContractCheck{Passed: true}
}

// Check invariant holds
func (v *CUEVerifier) checkInvariant(inv Invariant, data interface{}) InvariantCheck {
    // Evaluate CUE expression against data
    // Expression must evaluate to true
}

// Property-based testing (Schemathesis-style)
func (v *CUEVerifier) runPropertyTests(contract Contract) PropertyCheck {
    // Generate random valid instances
    // Verify they satisfy all invariants
    // Find counterexamples
}
```

---

## Bead Decomposition Rules

When breaking contracts into beads:

1. **One thing only**: Each bead does exactly one operation
2. **Size limit**: XS (< 10 lines) or S (10-30 lines) only
3. **Clear contract**: Subset of parent contract it satisfies
4. **Dependencies explicit**: List what it needs from other beads
5. **Outputs explicit**: List what it produces
6. **Independently verifiable**: Can be tested in isolation

If a bead seems too large, **split it further**.

---

## AI Prompts

### Prompt 1: Extract Entities

```
Extract entities from this intent.

Intent: {raw_intent}

Return JSON array:
[{
  "name": "User",
  "description": "A person who uses the system",
  "operations": ["create", "authenticate"],
  "properties": ["id", "email", "password_hash"]
}]

Only include entities that need formal contracts.
```

### Prompt 2: Generate Contract

```
Generate a CUE contract for this entity.

Entity: {entity_name}
Operations: {operations}
Properties: {properties}

Return JSON:
{
  "schema": "CUE schema definition",
  "invariants": [{
    "name": "password_not_plain",
    "expression": "password_hash != password",
    "severity": "error",
    "message": "Password must be hashed"
  }],
  "thresholds": [{
    "metric": "latency_p99",
    "operator": "<",
    "value": 100,
    "unit": "ms"
  }]
}
```

### Prompt 3: Decompose to Beads

```
Decompose this contract into minimal beads.

Contract: {contract_name}
Schema: {cue_schema}
Invariants: {invariants}

A bead must:
- Do exactly ONE thing
- Be < 30 lines
- Be independently verifiable
- Have a clear contract subset

Return JSON array of beads.
Err on the side of MORE, SMALLER beads.
```

### Prompt 4: Implement Bead

```
Implement this bead.

Bead: {bead_name}
Contract Schema: {cue_schema}
Invariants: {invariants}
Thresholds: {thresholds}
Dependencies: {deps}

Return valid JSON that:
1. Satisfies the schema exactly
2. Maintains all invariants
3. Meets threshold requirements

Return ONLY JSON, no explanation.
```

---

## Project Structure

```
openspec/
├── go.mod
├── spec.go           # Core types
├── compiler.go       # Intent → Contracts
├── decomposer.go     # Contracts → Beads
├── verifier.go       # CUE-based verification
├── executor.go       # Parallel bead execution
├── openspec.go       # Main engine
├── store.go          # SQLite persistence
└── cmd/
    └── openspec/
        └── main.go   # CLI entry point
```

---

## Database Schema

```sql
CREATE TABLE intents (
    id TEXT PRIMARY KEY,
    raw TEXT NOT NULL,
    goal TEXT,
    constraints TEXT,  -- JSON
    created_at INTEGER
);

CREATE TABLE specs (
    id TEXT PRIMARY KEY,
    intent_id TEXT,
    contracts TEXT,    -- JSON
    beads TEXT,        -- JSON
    bead_order TEXT,   -- JSON
    created_at INTEGER
);

CREATE TABLE beads (
    id TEXT PRIMARY KEY,
    name TEXT,
    contract TEXT,     -- JSON
    requires TEXT,     -- JSON
    produces TEXT,     -- JSON
    size TEXT,
    status TEXT,
    created_at INTEGER
);

CREATE TABLE verifications (
    id TEXT PRIMARY KEY,
    bead_id TEXT,
    passed INTEGER,
    contract_checks TEXT,   -- JSON
    invariant_checks TEXT,  -- JSON
    threshold_checks TEXT,  -- JSON
    property_checks TEXT,   -- JSON
    duration_ns INTEGER,
    timestamp INTEGER
);
```

---

## Usage

```bash
# Build
cd openspec && go build ./cmd/openspec

# Run
openspec "Add user authentication with email and password"
```

Output:
```
OpenSpec: Contract-First Development
=====================================

Intent: Add user authentication with email and password

Phase 1: Compiling contracts...
  Generated 2 contracts
    - User (3 invariants)
    - Session (2 invariants)

  Decomposed into 5 beads
    - validate_email (xs)
    - hash_password (xs)
    - create_user_record (s)
    - generate_session (xs)
    - verify_credentials (s)

Phase 2: Executing beads...

  [✓] validate_email (attempt 1/5)
  [✓] hash_password (attempt 2/5)
  [✓] create_user_record (attempt 1/5)
  [✓] generate_session (attempt 1/5)
  [✓] verify_credentials (attempt 3/5)

Result: ALL BEADS VERIFIED ✓
```

---

## The Key Insight

> Beads are so small that they're **trivially correct** or **obviously wrong**.
>
> No "it mostly works."
> No "just needs a few fixes."
> No partial success.
>
> Verified. Or failed.

---

## Implementation Order

1. **Core types** (spec.go) - The vocabulary
2. **CUE verifier** (verifier.go) - Schema + invariant checking
3. **Contract compiler** (compiler.go) - Intent → Contracts
4. **Bead decomposer** (decomposer.go) - Contracts → Beads
5. **Executor** (executor.go) - Parallel implementation
6. **Store** (store.go) - SQLite persistence
7. **Engine** (openspec.go) - Orchestration
8. **CLI** (main.go) - Entry point

---

## Success Criteria

1. `go build ./...` succeeds
2. `go test ./...` passes
3. Running `openspec "Add auth"` produces:
   - Contracts with CUE schemas
   - Beads of size XS or S only
   - Verification results for each bead
   - Clear pass/fail for the whole run
4. Failed beads explain exactly why they failed
5. The code is clear enough to understand at a glance

---

**Build contracts first. Break into beads. Verify everything. No partial success.**
