# Manifest: A Gleam Implementation

## The Joy of Code

> "Habitability is the characteristic of source code that enables people to understand
> its construction and intentions and to change it comfortably and confidently.
> Habitability makes a place liveable, like home."
> — Richard P. Gabriel

This is not just another plugin. This is code that sparks joy.

---

## CUPID as Our North Star

Every design decision flows through these five properties:

| Property | What It Means for Manifest |
|----------|---------------------------|
| **Composable** | Small functions that pipe together beautifully |
| **Unix** | Each module does exactly one thing |
| **Predictable** | Result types everywhere, no surprises |
| **Idiomatic** | Feels like home in Gleam |
| **Domain-based** | Types speak the language of intent and manifestation |

---

## 1. THE DOMAIN LANGUAGE

Before any code, we define the words we speak.

```gleam
// ═══════════════════════════════════════════════════════════════
// THE LANGUAGE OF INTENT
// ═══════════════════════════════════════════════════════════════

/// What a human wants, in its rawest form
pub type RawIntent {
  RawIntent(
    message: String,
    session_id: String,
    received_at: Int,
  )
}

/// Intent, parsed and understood
pub type Intent {
  Intent(
    core: String,              // The essence, one sentence
    must: List(String),        // What must be true
    must_not: List(String),    // What must not happen
    done_when: List(String),   // How we know we're done
    unclear: List(String),     // What needs clarification
  )
}

/// When we need the human to clarify
pub type Clarification {
  Clarification(
    intent_id: String,
    questions: List(String),
  )
}
```

```gleam
// ═══════════════════════════════════════════════════════════════
// THE LANGUAGE OF SPECIFICATION
// ═══════════════════════════════════════════════════════════════

/// A testable assertion about success
pub type Assertion {
  Assertion(
    id: String,
    says: String,           // Human description
    test: String,           // Executable test code
    weight: Int,            // 1-10 importance
  )
}

/// The complete specification for what "done" means
pub type Spec {
  Spec(
    id: String,
    intent_id: String,
    assertions: List(Assertion),
    tests: String,              // Complete test file
    types: String,              // Type contract
    may_touch: List(String),    // Allowed files
    must_not_touch: List(String), // Forbidden files
    patterns: List(Pattern),
  )
}

/// A pattern observed in the codebase
pub type Pattern {
  Pattern(
    name: String,
    example: String,
    applies_to: List(String),
  )
}
```

```gleam
// ═══════════════════════════════════════════════════════════════
// THE LANGUAGE OF GENERATION
// ═══════════════════════════════════════════════════════════════

/// How we approach implementation
pub type Strategy {
  Vanilla        // Straightforward
  Minimal        // Fewest lines
  Defensive      // Maximum safety
  Patterned      // Follow codebase style
  Mutated        // Variation of another
  Adversarial    // Edge case hunter
}

/// A single file change
pub type FileChange {
  Create(path: String, content: String)
  Modify(path: String, content: String)
  Delete(path: String)
}

/// One attempt at implementation
pub type Attempt {
  Attempt(
    id: String,
    spec_id: String,
    strategy: Strategy,
    changes: List(FileChange),
    approach: String,
    confidence: Float,
  )
}
```

```gleam
// ═══════════════════════════════════════════════════════════════
// THE LANGUAGE OF REALITY
// ═══════════════════════════════════════════════════════════════

/// Result of a single check
pub type Check {
  Passed(output: String)
  Failed(errors: List(String))
}

/// Full verification of an attempt
pub type Verification {
  Verification(
    attempt_id: String,
    typecheck: Check,
    lint: Check,
    tests: Check,
    spec_tests: Check,
    duration_ms: Int,
  )
}

/// Did it survive reality?
pub fn survived(v: Verification) -> Bool {
  case v.typecheck, v.lint, v.tests, v.spec_tests {
    Passed(_), Passed(_), Passed(_), Passed(_) -> True
    _, _, _, _ -> False
  }
}
```

```gleam
// ═══════════════════════════════════════════════════════════════
// THE LANGUAGE OF SELECTION
// ═══════════════════════════════════════════════════════════════

/// A survivor, ranked and scored
pub type Survivor {
  Survivor(
    attempt: Attempt,
    verification: Verification,
    rank: Int,
    score: Score,
  )
}

/// How we score survivors
pub type Score {
  Score(
    assertions: Float,   // 0.0-1.0
    simplicity: Float,
    readability: Float,
    overall: Float,
  )
}

/// What the human decides
pub type Judgment {
  Accept(survivor_id: String)
  Refine(feedback: String)
  Redirect(new_intent: String)
  Abort
}
```

---

## 2. COMPOSABLE MODULES

Each module does one thing. They compose through pipelines.

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Parse  │───▶│ Compile │───▶│ Swarm   │───▶│ Verify  │───▶│  Rank   │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
  Intent          Spec        Attempts      Verified       Survivors
```

### Module: `manifest/parse`

```gleam
// manifest/parse.gleam
//
// Turns raw human messages into structured intent.
// Does ONE thing: understand what the human wants.

import gleam/result
import gleam/string
import manifest/ai
import manifest/intent.{Intent, RawIntent}

pub type ParseError {
  EmptyMessage
  AIFailure(reason: String)
  MalformedResponse(raw: String)
}

/// Parse a raw message into structured intent
pub fn parse(raw: RawIntent) -> Result(Intent, ParseError) {
  use <- guard(string.is_empty(raw.message), Error(EmptyMessage))

  raw.message
  |> ai.complete(prompt: parse_prompt())
  |> result.map_error(fn(e) { AIFailure(e.message) })
  |> result.then(decode_intent)
}

/// The prompt that teaches AI to understand intent
fn parse_prompt() -> String {
  "
  You extract structured intent from human messages.

  Return YAML:

  core: One sentence, what they want
  must:
    - Required conditions
  must_not:
    - Forbidden conditions
  done_when:
    - Testable success criteria
  unclear:
    - Questions needing clarification
  "
}

fn decode_intent(yaml: String) -> Result(Intent, ParseError) {
  // YAML parsing, returns Intent or MalformedResponse
  todo
}
```

### Module: `manifest/compile`

```gleam
// manifest/compile.gleam
//
// Turns intent into executable specification.
// Does ONE thing: define what "done" looks like.

import gleam/result
import manifest/intent.{Intent}
import manifest/spec.{Spec, Assertion}
import manifest/codebase
import manifest/ai

pub type CompileError {
  NoTestableConditions
  CodebaseUnreadable(path: String)
  AIFailure(reason: String)
}

/// Compile intent into specification
pub fn compile(intent: Intent) -> Result(Spec, CompileError) {
  use <- guard(list.is_empty(intent.done_when), Error(NoTestableConditions))

  use analysis <- result.try(analyze_codebase(intent))
  use assertions <- result.try(generate_assertions(intent, analysis))
  use tests <- result.try(generate_tests(assertions))

  Ok(Spec(
    id: uuid.v4(),
    intent_id: intent.id,
    assertions: assertions,
    tests: tests,
    types: generate_types(assertions),
    may_touch: analysis.relevant_files,
    must_not_touch: analysis.forbidden_files,
    patterns: analysis.patterns,
  ))
}

fn analyze_codebase(intent: Intent) -> Result(Analysis, CompileError) {
  codebase.read_structure()
  |> result.map_error(fn(e) { CodebaseUnreadable(e.path) })
  |> result.then(fn(structure) {
    ai.complete(analyze_prompt(intent, structure))
    |> result.map_error(fn(e) { AIFailure(e.message) })
    |> result.then(decode_analysis)
  })
}

fn generate_assertions(
  intent: Intent,
  analysis: Analysis
) -> Result(List(Assertion), CompileError) {
  intent.done_when
  |> list.map(fn(criterion) {
    ai.complete(assertion_prompt(criterion, analysis))
    |> result.map(decode_assertion)
  })
  |> result.all
  |> result.map_error(fn(_) { AIFailure("Could not generate assertions") })
}
```

### Module: `manifest/swarm`

```gleam
// manifest/swarm.gleam
//
// Generates many implementations in parallel.
// Does ONE thing: create diverse attempts.

import gleam/list
import gleam/otp/task
import manifest/spec.{Spec}
import manifest/attempt.{Attempt, Strategy}
import manifest/ai

pub type SwarmConfig {
  SwarmConfig(
    count: Int,
    strategies: List(#(Strategy, Int)),  // Strategy and count
  )
}

/// Default swarm configuration
pub fn default_config() -> SwarmConfig {
  SwarmConfig(
    count: 50,
    strategies: [
      #(Vanilla, 15),
      #(Minimal, 10),
      #(Defensive, 10),
      #(Patterned, 10),
      #(Adversarial, 5),
    ],
  )
}

/// Generate many attempts in parallel
pub fn generate(spec: Spec, config: SwarmConfig) -> List(Attempt) {
  config.strategies
  |> list.flat_map(fn(pair) {
    let #(strategy, count) = pair
    list.range(1, count)
    |> list.map(fn(_) { strategy })
  })
  |> list.map(fn(strategy) {
    task.async(fn() { generate_one(spec, strategy) })
  })
  |> list.map(task.await_forever)
  |> list.filter_map(fn(result) {
    case result {
      Ok(attempt) -> Ok(attempt)
      Error(_) -> Error(Nil)  // Log and continue
    }
  })
}

fn generate_one(spec: Spec, strategy: Strategy) -> Result(Attempt, Nil) {
  ai.complete(implementation_prompt(spec, strategy))
  |> result.then(decode_attempt)
  |> result.map(fn(changes) {
    Attempt(
      id: uuid.v4(),
      spec_id: spec.id,
      strategy: strategy,
      changes: changes,
      approach: describe_strategy(strategy),
      confidence: 0.8,
    )
  })
  |> result.map_error(fn(_) { Nil })
}
```

### Module: `manifest/verify`

```gleam
// manifest/verify.gleam
//
// Tests attempts against reality.
// Does ONE thing: determine truth.

import gleam/list
import gleam/otp/task
import manifest/attempt.{Attempt}
import manifest/spec.{Spec}
import manifest/verification.{Verification, Check, Passed, Failed}
import manifest/workspace

pub type VerifyConfig {
  VerifyConfig(
    timeout_ms: Int,
    concurrency: Int,
  )
}

pub fn default_config() -> VerifyConfig {
  VerifyConfig(timeout_ms: 30_000, concurrency: 10)
}

/// Verify all attempts against reality
pub fn verify_all(
  attempts: List(Attempt),
  spec: Spec,
  config: VerifyConfig,
) -> List(Verification) {
  attempts
  |> list.sized_chunk(config.concurrency)
  |> list.flat_map(fn(chunk) {
    chunk
    |> list.map(fn(attempt) {
      task.async(fn() { verify_one(attempt, spec, config) })
    })
    |> list.map(task.await_forever)
  })
}

/// Verify a single attempt in isolation
fn verify_one(
  attempt: Attempt,
  spec: Spec,
  config: VerifyConfig,
) -> Verification {
  let start = now_ms()

  // Create isolated workspace
  use workspace <- workspace.with_temp(attempt.id)

  // Apply changes
  let _ = workspace.apply_changes(workspace, attempt.changes)

  // Write spec tests
  let _ = workspace.write_file(
    workspace,
    "__spec__/spec.test.ts",
    spec.tests
  )

  // Run checks
  let typecheck = run_typecheck(workspace, config.timeout_ms)
  let lint = run_lint(workspace, config.timeout_ms)
  let tests = run_tests(workspace, config.timeout_ms)
  let spec_tests = run_spec_tests(workspace, config.timeout_ms)

  Verification(
    attempt_id: attempt.id,
    typecheck: typecheck,
    lint: lint,
    tests: tests,
    spec_tests: spec_tests,
    duration_ms: now_ms() - start,
  )
}

fn run_typecheck(workspace: String, timeout: Int) -> Check {
  case shell.run("bunx tsc --noEmit", in: workspace, timeout: timeout) {
    Ok(output) -> Passed(output)
    Error(e) -> Failed(parse_errors(e.output))
  }
}

fn run_lint(workspace: String, timeout: Int) -> Check {
  case shell.run("bunx biome check .", in: workspace, timeout: timeout) {
    Ok(output) -> Passed(output)
    Error(e) -> Failed(parse_errors(e.output))
  }
}

fn run_tests(workspace: String, timeout: Int) -> Check {
  case shell.run("bun test", in: workspace, timeout: timeout) {
    Ok(output) -> Passed(output)
    Error(e) -> Failed(parse_errors(e.output))
  }
}

fn run_spec_tests(workspace: String, timeout: Int) -> Check {
  case shell.run("bun test __spec__", in: workspace, timeout: timeout) {
    Ok(output) -> Passed(output)
    Error(e) -> Failed(parse_errors(e.output))
  }
}
```

### Module: `manifest/rank`

```gleam
// manifest/rank.gleam
//
// Ranks survivors by quality.
// Does ONE thing: find the best.

import gleam/list
import gleam/float
import manifest/attempt.{Attempt}
import manifest/verification.{Verification, survived}
import manifest/survivor.{Survivor, Score}

pub type Weights {
  Weights(
    assertions: Float,
    simplicity: Float,
    readability: Float,
  )
}

pub fn default_weights() -> Weights {
  Weights(
    assertions: 0.5,
    simplicity: 0.3,
    readability: 0.2,
  )
}

/// Rank verified attempts, return survivors
pub fn rank(
  attempts: List(Attempt),
  verifications: List(Verification),
  weights: Weights,
) -> List(Survivor) {
  verifications
  |> list.filter(survived)
  |> list.filter_map(fn(v) {
    list.find(attempts, fn(a) { a.id == v.attempt_id })
    |> result.map(fn(a) { #(a, v) })
  })
  |> list.map(fn(pair) {
    let #(attempt, verification) = pair
    score(attempt, verification, weights)
  })
  |> list.sort(fn(a, b) { float.compare(b.score.overall, a.score.overall) })
  |> list.index_map(fn(s, i) { Survivor(..s, rank: i + 1) })
}

fn score(
  attempt: Attempt,
  verification: Verification,
  weights: Weights,
) -> Survivor {
  let assertions = 1.0  // All passed if we got here
  let simplicity = score_simplicity(attempt)
  let readability = score_readability(attempt)

  let overall =
    assertions *. weights.assertions +.
    simplicity *. weights.simplicity +.
    readability *. weights.readability

  Survivor(
    attempt: attempt,
    verification: verification,
    rank: 0,  // Set after sorting
    score: Score(
      assertions: assertions,
      simplicity: simplicity,
      readability: readability,
      overall: overall,
    ),
  )
}

fn score_simplicity(attempt: Attempt) -> Float {
  let lines =
    attempt.changes
    |> list.map(count_lines)
    |> list.fold(0, fn(a, b) { a + b })

  // Fewer lines = higher score, normalized
  float.max(0.0, 1.0 -. int.to_float(lines) /. 500.0)
}

fn score_readability(attempt: Attempt) -> Float {
  // Simple heuristics for now
  // TODO: AI-assisted readability scoring
  0.7
}

fn count_lines(change: FileChange) -> Int {
  case change {
    Create(_, content) -> string.split(content, "\n") |> list.length
    Modify(_, content) -> string.split(content, "\n") |> list.length
    Delete(_) -> 0
  }
}
```

---

## 3. THE PIPELINE

The manifest flow as a single, readable pipeline:

```gleam
// manifest/flow.gleam
//
// The complete manifest pipeline.
// Composes all modules into a single flow.

import gleam/result
import manifest/parse
import manifest/compile
import manifest/swarm
import manifest/verify
import manifest/rank
import manifest/present

pub type ManifestResult {
  NeedsClarification(questions: List(String))
  Survivors(ranked: List(Survivor))
  NoSurvivors(failures: List(FailureReport))
  Complete(applied: List(FileChange))
  Aborted
}

/// The complete manifest pipeline
pub fn manifest(
  message: String,
  session_id: String,
) -> Result(ManifestResult, ManifestError) {
  let raw = RawIntent(message, session_id, now())

  // Parse → Check clarity → Compile → Generate → Verify → Rank → Present
  use intent <- result.try(parse.parse(raw))

  // If unclear, ask for clarification
  use <- guard_unclear(intent)

  use spec <- result.try(compile.compile(intent))

  let attempts = swarm.generate(spec, swarm.default_config())
  let verifications = verify.verify_all(attempts, spec, verify.default_config())
  let survivors = rank.rank(attempts, verifications, rank.default_weights())

  case survivors {
    [] -> Ok(NoSurvivors(analyze_failures(verifications)))
    _ -> Ok(Survivors(list.take(survivors, 5)))
  }
}

/// Handle human judgment
pub fn judge(
  intent_id: String,
  judgment: Judgment,
) -> Result(ManifestResult, ManifestError) {
  case judgment {
    Accept(survivor_id) -> {
      use survivor <- result.try(db.get_survivor(survivor_id))
      use _ <- result.try(apply_changes(survivor.attempt.changes))
      Ok(Complete(survivor.attempt.changes))
    }

    Refine(feedback) -> {
      use intent <- result.try(db.get_intent(intent_id))
      manifest(intent.message <> "\n\n" <> feedback, intent.session_id)
    }

    Redirect(new_intent) -> {
      use intent <- result.try(db.get_intent(intent_id))
      manifest(new_intent, intent.session_id)
    }

    Abort -> Ok(Aborted)
  }
}

fn guard_unclear(intent: Intent) -> fn() -> Result(ManifestResult, e) {
  fn(continue) {
    case intent.unclear {
      [] -> continue()
      questions -> Ok(NeedsClarification(questions))
    }
  }
}
```

---

## 4. PREDICTABLE ERROR HANDLING

No exceptions. No surprises. Just Results.

```gleam
// manifest/error.gleam
//
// All the ways things can go wrong.
// Explicit, exhaustive, handleable.

pub type ManifestError {
  // Parsing phase
  ParseError(reason: ParseReason)

  // Compilation phase
  CompileError(reason: CompileReason)

  // Generation phase
  SwarmError(reason: SwarmReason)

  // Verification phase
  VerifyError(reason: VerifyReason)

  // Storage phase
  StorageError(reason: StorageReason)
}

pub type ParseReason {
  EmptyMessage
  AIUnavailable
  MalformedAIResponse(raw: String)
}

pub type CompileReason {
  NoTestableConditions
  CodebaseUnreadable(path: String)
  PatternExtractionFailed
}

pub type SwarmReason {
  AllGenerationsFailed
  RateLimited
  CostCeilingReached(spent: Float, ceiling: Float)
}

pub type VerifyReason {
  WorkspaceCreationFailed(path: String)
  AllVerificationsFailed
}

pub type StorageReason {
  DatabaseLocked
  DiskFull
  CorruptedData(table: String)
}

/// Human-readable error messages
pub fn explain(error: ManifestError) -> String {
  case error {
    ParseError(EmptyMessage) ->
      "I need you to tell me what you want to build."

    ParseError(AIUnavailable) ->
      "I'm having trouble thinking right now. Please try again."

    CompileError(NoTestableConditions) ->
      "I need specific success criteria. How will we know when it's done?"

    CompileError(CodebaseUnreadable(path)) ->
      "I can't read the codebase at " <> path

    SwarmError(CostCeilingReached(spent, ceiling)) ->
      "Cost ceiling reached: $" <> float.to_string(spent) <>
      " of $" <> float.to_string(ceiling)

    _ -> "Something went wrong. Please try again."
  }
}
```

---

## 5. IDIOMATIC GLEAM

### Pipeline Style

```gleam
// NOT THIS (imperative)
fn process(message: String) -> Result(Intent, Error) {
  let validated = validate(message)
  case validated {
    Error(e) -> Error(e)
    Ok(v) -> {
      let parsed = parse(v)
      case parsed {
        Error(e) -> Error(e)
        Ok(p) -> {
          let enriched = enrich(p)
          Ok(enriched)
        }
      }
    }
  }
}

// THIS (pipeline)
fn process(message: String) -> Result(Intent, Error) {
  message
  |> validate
  |> result.then(parse)
  |> result.map(enrich)
}
```

### Use Expressions

```gleam
// NOT THIS (nested cases)
fn manifest(raw: RawIntent) -> Result(Survivors, Error) {
  case parse(raw) {
    Error(e) -> Error(ParseFailed(e))
    Ok(intent) -> {
      case compile(intent) {
        Error(e) -> Error(CompileFailed(e))
        Ok(spec) -> {
          // ... more nesting
        }
      }
    }
  }
}

// THIS (use expressions)
fn manifest(raw: RawIntent) -> Result(Survivors, Error) {
  use intent <- result.try(parse(raw))
  use spec <- result.try(compile(intent))
  use attempts <- result.try(generate(spec))
  use verified <- result.try(verify(attempts, spec))

  Ok(rank(verified))
}
```

### Pattern Matching

```gleam
// Exhaustive, clear, joyful
fn handle_judgment(judgment: Judgment) -> Action {
  case judgment {
    Accept(id) -> ApplyChanges(id)
    Refine(feedback) -> RestartWith(feedback)
    Redirect(intent) -> StartFresh(intent)
    Abort -> Cleanup
  }
}

fn describe_check(check: Check) -> String {
  case check {
    Passed(output) -> "✓ " <> summarize(output)
    Failed(errors) -> "✗ " <> list.first(errors) |> result.unwrap("Unknown")
  }
}
```

---

## 6. PROJECT STRUCTURE

```
manifest/
├── gleam.toml                 # Project config
├── src/
│   └── manifest/
│       ├── manifest.gleam     # Main entry, re-exports
│       │
│       ├── domain/            # Domain types (D in CUPID)
│       │   ├── intent.gleam
│       │   ├── spec.gleam
│       │   ├── attempt.gleam
│       │   ├── verification.gleam
│       │   └── survivor.gleam
│       │
│       ├── parse.gleam        # U: One thing - parse intent
│       ├── compile.gleam      # U: One thing - compile spec
│       ├── swarm.gleam        # U: One thing - generate attempts
│       ├── verify.gleam       # U: One thing - verify against reality
│       ├── rank.gleam         # U: One thing - rank survivors
│       │
│       ├── flow.gleam         # C: Compose into pipeline
│       │
│       ├── error.gleam        # P: Predictable errors
│       │
│       ├── ai.gleam           # AI integration
│       ├── db.gleam           # SQLite storage
│       ├── workspace.gleam    # Temp workspace management
│       └── shell.gleam        # Shell command execution
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
└── js/                        # Compiled JavaScript output
    └── manifest.js
```

---

## 7. GLEAM TO JAVASCRIPT

### Build Configuration

```toml
# gleam.toml
name = "manifest"
version = "1.0.0"
target = "javascript"

[javascript]
runtime = "bun"

[dependencies]
gleam_stdlib = "~> 0.34"
gleam_json = "~> 1.0"
gleam_http = "~> 3.0"
sqlight = "~> 0.4"

[dev-dependencies]
gleeunit = "~> 1.0"
```

### JavaScript Interop

```gleam
// manifest/ffi/shell.gleam
//
// JavaScript FFI for shell commands

@external(javascript, "./shell_ffi.mjs", "run")
pub fn run_command(
  command: String,
  working_dir: String,
  timeout_ms: Int,
) -> Result(String, ShellError)

@external(javascript, "./shell_ffi.mjs", "exists")
pub fn file_exists(path: String) -> Bool

@external(javascript, "./shell_ffi.mjs", "read")
pub fn read_file(path: String) -> Result(String, FileError)

@external(javascript, "./shell_ffi.mjs", "write")
pub fn write_file(path: String, content: String) -> Result(Nil, FileError)
```

```javascript
// manifest/ffi/shell_ffi.mjs
//
// JavaScript implementation of shell FFI

import { $ } from "bun";
import { Ok, Error } from "./gleam.mjs";

export async function run(command, workingDir, timeoutMs) {
  try {
    const result = await $`cd ${workingDir} && ${command}`
      .timeout(timeoutMs)
      .quiet()
      .nothrow();

    if (result.exitCode === 0) {
      return new Ok(result.stdout.toString());
    } else {
      return new Error({ output: result.stderr.toString() });
    }
  } catch (e) {
    return new Error({ output: e.message });
  }
}

export function exists(path) {
  return Bun.file(path).exists();
}

export async function read(path) {
  try {
    const content = await Bun.file(path).text();
    return new Ok(content);
  } catch (e) {
    return new Error({ reason: e.message });
  }
}

export async function write(path, content) {
  try {
    await Bun.write(path, content);
    return new Ok(undefined);
  } catch (e) {
    return new Error({ reason: e.message });
  }
}
```

---

## 8. JOY IN TESTING

Tests that are a pleasure to read:

```gleam
// test/manifest/parse_test.gleam

import gleeunit
import gleeunit/should
import manifest/parse
import manifest/intent.{Intent, RawIntent}

pub fn main() {
  gleeunit.main()
}

pub fn parses_simple_feature_request_test() {
  let raw = RawIntent(
    message: "Add user authentication with email and password",
    session_id: "test-session",
    received_at: 0,
  )

  parse.parse(raw)
  |> should.be_ok
  |> fn(intent) {
    intent.core
    |> should.equal("Add email/password authentication")

    intent.done_when
    |> should.contain("User can register")
    |> should.contain("User can log in")
  }
}

pub fn detects_ambiguity_test() {
  let raw = RawIntent(
    message: "Make it better",
    session_id: "test-session",
    received_at: 0,
  )

  parse.parse(raw)
  |> should.be_ok
  |> fn(intent) {
    intent.unclear
    |> list.length
    |> should.be_true(fn(len) { len > 0 })
  }
}

pub fn extracts_constraints_test() {
  let raw = RawIntent(
    message: "Add auth using bcrypt, never store plain text passwords",
    session_id: "test-session",
    received_at: 0,
  )

  parse.parse(raw)
  |> should.be_ok
  |> fn(intent) {
    intent.must
    |> should.contain("bcrypt")

    intent.must_not
    |> should.contain("plain text")
  }
}

pub fn rejects_empty_message_test() {
  let raw = RawIntent(
    message: "",
    session_id: "test-session",
    received_at: 0,
  )

  parse.parse(raw)
  |> should.be_error
  |> should.equal(parse.EmptyMessage)
}
```

---

## 9. THE COMPLETE FLOW

```gleam
// manifest/manifest.gleam
//
// The public API. Simple, clear, complete.

import manifest/flow
import manifest/survivor.{Survivor}
import manifest/error.{ManifestError}

/// Start manifesting a feature from human intent
pub fn manifest(
  message: String,
  session_id: String,
) -> Result(ManifestResult, ManifestError) {
  flow.manifest(message, session_id)
}

/// Handle human judgment on survivors
pub fn judge(
  intent_id: String,
  judgment: Judgment,
) -> Result(ManifestResult, ManifestError) {
  flow.judge(intent_id, judgment)
}

/// Get the status of a manifest operation
pub fn status(intent_id: String) -> Result(Status, ManifestError) {
  flow.status(intent_id)
}

/// Abort a manifest operation
pub fn abort(intent_id: String) -> Result(Nil, ManifestError) {
  flow.abort(intent_id)
}
```

---

## 10. SUMMARY: CUPID EMBODIED

| Property | How Manifest Embodies It |
|----------|-------------------------|
| **Composable** | Small modules that pipe together: `parse \|> compile \|> generate \|> verify \|> rank` |
| **Unix** | Each module does one thing: parse parses, verify verifies, rank ranks |
| **Predictable** | Result types everywhere, exhaustive pattern matching, no exceptions |
| **Idiomatic** | Gleam conventions: pipelines, use expressions, pattern matching |
| **Domain-based** | Types speak the language: Intent, Spec, Attempt, Survivor, Judgment |

---

## NEXT STEPS

1. Set up Gleam project structure
2. Implement domain types
3. Implement each module (Unix: one at a time)
4. Wire together with flow
5. Add JavaScript FFI for shell/file operations
6. Test each module
7. Compile to JavaScript
8. Integrate with OpenCode

**This is code that sparks joy. Let's build it.**
