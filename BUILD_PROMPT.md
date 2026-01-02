# BUILD PROMPT: Manifest Plugin

## What You Are Building

**Manifest** - A Gleam plugin that transforms human intent into working code through parallel generation and reality-based verification.

```
Human Intent → Specification → 50 Parallel Attempts → Reality Tests → Survivors → Human Judgment
```

---

## The Core Philosophy

### The Transcendent Loop

```
HUMAN provides:     Intent, Judgment, Redirection
AI provides:        Parallel generation, tireless iteration
REALITY provides:   Ground truth (the ONLY truth)

Human does NOT:     Iterate manually, write code, debug
AI does NOT:        Judge quality, know if it worked
Reality does NOT:   Care about intent or elegance

The loop:
  Human intends → AI produces 50 attempts → Reality tests ALL →
  Survivors surface → Human judges survivors ONLY
```

### CUPID Properties

Every design decision must pass through these five lenses:

| Property | Meaning | Implementation |
|----------|---------|----------------|
| **Composable** | Small functions that pipe together | `parse \|> compile \|> generate \|> verify \|> rank` |
| **Unix** | Each module does exactly one thing | Separate files: parse.gleam, compile.gleam, etc. |
| **Predictable** | Result types everywhere, no surprises | No exceptions, exhaustive pattern matching |
| **Idiomatic** | Feels like home in Gleam | Pipelines, use expressions, immutable data |
| **Domain-based** | Types speak the problem language | Intent, Spec, Attempt, Survivor, Judgment |

---

## Technology Stack

- **Language**: Gleam (functional, typed, joyful)
- **Target**: JavaScript (compiled from Gleam)
- **Runtime**: Bun
- **Database**: SQLite (via FFI)
- **AI Calls**: OpenAI/Anthropic API (via FFI)
- **Testing**: gleeunit

---

## The 5 Components

### 1. Intent Compiler (parse.gleam + compile.gleam)

Takes human natural language → produces executable Specification

```gleam
pub type Intent {
  Intent(
    core: String,           // One sentence essence
    must: List(String),     // Required conditions
    must_not: List(String), // Forbidden conditions
    done_when: List(String),// Testable success criteria
    unclear: List(String),  // Questions for human
  )
}

pub type Spec {
  Spec(
    assertions: List(Assertion),  // Testable assertions
    tests: String,                // Complete test file
    types: String,                // Type contract
    may_touch: List(String),      // Allowed files
    must_not_touch: List(String), // Forbidden files
  )
}
```

### 2. Generation Swarm (swarm.gleam)

Takes Spec → produces N parallel implementation Attempts

```gleam
pub type Strategy {
  Vanilla      // Straightforward
  Minimal      // Fewest lines
  Defensive    // Maximum safety
  Patterned    // Follow codebase style
  Adversarial  // Edge case hunter
}

pub type Attempt {
  Attempt(
    id: String,
    strategy: Strategy,
    changes: List(FileChange),
    approach: String,
    confidence: Float,
  )
}
```

### 3. Reality Harness (verify.gleam)

Takes Attempts + Spec → tests ALL against reality

```gleam
pub type Check {
  Passed(output: String)
  Failed(errors: List(String))
}

pub type Verification {
  Verification(
    attempt_id: String,
    typecheck: Check,
    lint: Check,
    tests: Check,
    spec_tests: Check,
  )
}

// Each attempt verified in isolated workspace:
// 1. Create temp directory
// 2. Copy codebase
// 3. Apply attempt's changes
// 4. Write spec tests
// 5. Run: typecheck → lint → tests → spec_tests
// 6. Cleanup
```

### 4. Survivor Pool (rank.gleam)

Takes verified Attempts → ranks by quality → surfaces top K

```gleam
pub type Survivor {
  Survivor(
    attempt: Attempt,
    rank: Int,
    score: Score,
  )
}

pub type Score {
  Score(
    assertions: Float,  // All passed = 1.0
    simplicity: Float,  // Fewer lines = higher
    readability: Float, // AI-assessed
    overall: Float,     // Weighted sum
  )
}
```

### 5. Human Terminal (flow.gleam)

Orchestrates flow, presents survivors, handles judgment

```gleam
pub type Judgment {
  Accept(survivor_id: String)  // Apply this one
  Refine(feedback: String)     // Try again with feedback
  Redirect(new_intent: String) // Start fresh
  Abort                        // Give up
}

pub type ManifestResult {
  NeedsClarification(questions: List(String))
  Survivors(ranked: List(Survivor))
  NoSurvivors(failures: List(FailureReport))
  Complete(applied: List(FileChange))
  Aborted
}
```

---

## Project Structure

```
manifest/
├── gleam.toml
├── src/
│   └── manifest/
│       ├── manifest.gleam      # Public API
│       │
│       ├── domain/             # Types (Domain-based)
│       │   ├── intent.gleam
│       │   ├── spec.gleam
│       │   ├── attempt.gleam
│       │   ├── verification.gleam
│       │   └── survivor.gleam
│       │
│       ├── parse.gleam         # Parse intent (Unix)
│       ├── compile.gleam       # Compile spec (Unix)
│       ├── swarm.gleam         # Generate attempts (Unix)
│       ├── verify.gleam        # Test against reality (Unix)
│       ├── rank.gleam          # Rank survivors (Unix)
│       │
│       ├── flow.gleam          # Compose pipeline (Composable)
│       ├── error.gleam         # All errors (Predictable)
│       │
│       ├── ai.gleam            # AI API calls
│       ├── db.gleam            # SQLite storage
│       ├── workspace.gleam     # Temp workspace management
│       └── shell.gleam         # Shell command execution
│
├── src/ffi/                    # JavaScript FFI
│   ├── shell_ffi.mjs
│   ├── db_ffi.mjs
│   └── ai_ffi.mjs
│
├── test/
│   └── manifest/
│       ├── parse_test.gleam
│       ├── compile_test.gleam
│       ├── swarm_test.gleam
│       ├── verify_test.gleam
│       ├── rank_test.gleam
│       └── flow_test.gleam
│
└── build/                      # Compiled JavaScript
```

---

## AI Prompts (Exact Text)

### Prompt 1: Parse Intent

```
You extract structured intent from human messages.

Human said: "{message}"

Return YAML:

core: One sentence, what they fundamentally want
must:
  - Required conditions (technologies, patterns)
must_not:
  - Forbidden conditions (what to avoid)
done_when:
  - Specific, testable success criteria
  - Each must be verifiable with a test
unclear:
  - Questions needing clarification before proceeding
```

### Prompt 2: Analyze Codebase

```
Analyze this codebase for implementing: {intent}

Files: {file_tree}

Determine:
1. Relevant files and WHY
2. Patterns to follow (naming, structure, style)
3. Interfaces to satisfy
4. Files that must NOT be modified
5. Integration points

Return YAML with these sections.
```

### Prompt 3: Generate Specification

```
Create executable specification for: {intent}

Codebase analysis: {analysis}

For each success criterion, write a Bun test:

test("{criterion}", async () => {
  // Arrange, Act, Assert
})

Return YAML:
assertions: [{ id, description, test_code, weight }]
verification_tests: Complete test file content
type_contract: TypeScript types to satisfy
allowed_files: [{ path, action: create|modify }]
forbidden_files: [{ path, reason }]
```

### Prompt 4: Generate Implementation

```
Implement according to specification.

Spec: {spec}
Strategy: {strategy}
Codebase context: {relevant_files}

Strategy instructions:
- vanilla: Straightforward, clear, standard
- minimal: Fewest lines, no abstraction
- defensive: Maximum error handling
- patterned: Match codebase style exactly
- adversarial: Satisfy tests literally, find edge cases

Return YAML:
approach: Brief description
confidence: 0.0-1.0
files:
  - path: "..."
    action: create|modify|delete
    content: |
      Complete file content
```

### Prompt 5: Score Readability

```
Score this code's readability (0-10 each):

{code}

naming: Variable/function names
structure: Organization
clarity: Logic flow
consistency: Internal patterns

Return YAML with scores and brief reasoning.
```

---

## Database Schema

```sql
CREATE TABLE intents (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  raw_message TEXT NOT NULL,
  parsed TEXT,  -- JSON
  status TEXT DEFAULT 'parsing',
  created_at INTEGER,
  updated_at INTEGER
);

CREATE TABLE specifications (
  id TEXT PRIMARY KEY,
  intent_id TEXT REFERENCES intents(id),
  assertions TEXT NOT NULL,  -- JSON
  tests TEXT NOT NULL,
  types TEXT,
  allowed_files TEXT,  -- JSON
  forbidden_files TEXT,  -- JSON
  version INTEGER DEFAULT 1,
  created_at INTEGER
);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  spec_id TEXT REFERENCES specifications(id),
  strategy TEXT NOT NULL,
  files TEXT NOT NULL,  -- JSON
  approach TEXT,
  confidence REAL,
  status TEXT DEFAULT 'pending',
  created_at INTEGER
);

CREATE TABLE verifications (
  id TEXT PRIMARY KEY,
  attempt_id TEXT REFERENCES attempts(id),
  passed INTEGER,
  typecheck TEXT,  -- JSON
  lint TEXT,  -- JSON
  tests TEXT,  -- JSON
  spec_tests TEXT,  -- JSON
  duration_ms INTEGER,
  created_at INTEGER
);

CREATE TABLE survivors (
  id TEXT PRIMARY KEY,
  attempt_id TEXT REFERENCES attempts(id),
  rank INTEGER,
  score_assertions REAL,
  score_simplicity REAL,
  score_readability REAL,
  score_overall REAL,
  created_at INTEGER
);

CREATE TABLE judgments (
  id TEXT PRIMARY KEY,
  intent_id TEXT REFERENCES intents(id),
  survivor_id TEXT,
  decision TEXT NOT NULL,
  feedback TEXT,
  created_at INTEGER
);
```

---

## The Main Flow (flow.gleam)

```gleam
pub fn manifest(message: String, session_id: String) -> Result(ManifestResult, Error) {
  let raw = RawIntent(message, session_id, now())

  // The pipeline
  use intent <- result.try(parse.parse(raw))
  use <- guard_unclear(intent)
  use spec <- result.try(compile.compile(intent))

  let attempts = swarm.generate(spec, swarm.default_config())
  let verified = verify.verify_all(attempts, spec, verify.default_config())
  let survivors = rank.rank(attempts, verified, rank.default_weights())

  case survivors {
    [] -> Ok(NoSurvivors(analyze_failures(verified)))
    _ -> Ok(Survivors(list.take(survivors, 5)))
  }
}

pub fn judge(intent_id: String, judgment: Judgment) -> Result(ManifestResult, Error) {
  case judgment {
    Accept(id) -> apply_survivor(id)
    Refine(feedback) -> restart_with_feedback(intent_id, feedback)
    Redirect(new_intent) -> manifest(new_intent, get_session(intent_id))
    Abort -> Ok(Aborted)
  }
}
```

---

## JavaScript FFI Examples

### shell_ffi.mjs

```javascript
import { Ok, Error } from "./gleam.mjs";

export async function run(command, cwd, timeoutMs) {
  try {
    const proc = Bun.spawn(["sh", "-c", command], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const timeout = setTimeout(() => proc.kill(), timeoutMs);
    const exitCode = await proc.exited;
    clearTimeout(timeout);

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode === 0) {
      return new Ok(stdout);
    } else {
      return new Error({ code: exitCode, output: stderr });
    }
  } catch (e) {
    return new Error({ code: -1, output: e.message });
  }
}
```

### db_ffi.mjs

```javascript
import { Database } from "bun:sqlite";
import { Ok, Error } from "./gleam.mjs";

let db = null;

export function open(path) {
  try {
    db = new Database(path);
    db.exec("PRAGMA journal_mode = WAL");
    return new Ok(undefined);
  } catch (e) {
    return new Error(e.message);
  }
}

export function query(sql, params) {
  try {
    const stmt = db.prepare(sql);
    const rows = stmt.all(...params);
    return new Ok(rows);
  } catch (e) {
    return new Error(e.message);
  }
}

export function execute(sql, params) {
  try {
    const stmt = db.prepare(sql);
    stmt.run(...params);
    return new Ok(undefined);
  } catch (e) {
    return new Error(e.message);
  }
}
```

---

## Configuration

```json
{
  "generation": {
    "count": 50,
    "strategies": {
      "vanilla": 15,
      "minimal": 10,
      "defensive": 10,
      "patterned": 10,
      "adversarial": 5
    },
    "cost_ceiling": 10.00
  },
  "verification": {
    "timeout_ms": 30000,
    "concurrency": 10,
    "flaky_retries": 3
  },
  "ranking": {
    "top_k": 5,
    "weights": {
      "assertions": 0.5,
      "simplicity": 0.3,
      "readability": 0.2
    }
  }
}
```

---

## Build Commands

```bash
# Initialize Gleam project
gleam new manifest
cd manifest

# Add dependencies
gleam add gleam_stdlib gleam_json gleeunit

# Build to JavaScript
gleam build --target javascript

# Run tests
gleam test

# The output will be in build/dev/javascript/manifest/
```

---

## Implementation Order

Build in this sequence, testing each before moving on:

1. **Domain types** (domain/*.gleam) - The vocabulary
2. **Error types** (error.gleam) - All failure modes
3. **FFI layer** (ffi/*.mjs) - Shell, DB, AI bridges
4. **Parse module** (parse.gleam) - Intent parsing
5. **Compile module** (compile.gleam) - Spec generation
6. **Swarm module** (swarm.gleam) - Parallel generation
7. **Verify module** (verify.gleam) - Reality testing
8. **Rank module** (rank.gleam) - Survivor ranking
9. **Flow module** (flow.gleam) - Pipeline composition
10. **Main module** (manifest.gleam) - Public API

---

## Success Criteria

The implementation is complete when:

1. `gleam build --target javascript` succeeds
2. All tests pass (`gleam test`)
3. The compiled JS runs in Bun
4. A human can say "Add user authentication" and:
   - Get clarifying questions if needed
   - See a specification for approval
   - Watch 50 attempts generate
   - See 5 ranked survivors
   - Accept one and have it applied
5. The code sparks joy to read

---

## The Essence

> You don't iterate. Reality iterates.
> You don't generate. AI generates.
> You don't verify. Tests verify.
>
> You ONLY do what only you can do:
> - Know what you want
> - Recognize when you have it
> - Redirect when the whole approach is wrong

Build code that embodies this. Build code that sparks joy.
