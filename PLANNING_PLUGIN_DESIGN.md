# Planning Plugin Design Document

## Version: Round 4 - Stress Test & Failure Modes

**Decisions from Round 3 feedback:**
- Full system (all 5 components)
- SQLite database for intent/session persistence
- OpenCode plugin patterns
- Memory for runtime state
- Unlimited parallel AI calls

---

## 1. FULL SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              OPENCODE RUNTIME                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MANIFEST PLUGIN                                   │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Intent    │  │ Generation  │  │   Reality   │  │  Survivor   │        │
│  │  Compiler   │──│   Swarm     │──│   Harness   │──│    Pool     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                │                │                │                │
│         └────────────────┴────────────────┴────────────────┘                │
│                                   │                                         │
│                                   ▼                                         │
│                          ┌─────────────┐                                    │
│                          │   Database  │                                    │
│                          │   (SQLite)  │                                    │
│                          └─────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. DATABASE SCHEMA

### Tables

```sql
-- Intents: The human's original request
CREATE TABLE intents (
    id TEXT PRIMARY KEY,                    -- UUID
    session_id TEXT NOT NULL,               -- OpenCode session ID
    raw_message TEXT NOT NULL,              -- Original human message
    parsed_intent TEXT,                     -- Structured YAML/JSON
    constraints_must TEXT,                  -- JSON array
    constraints_must_not TEXT,              -- JSON array
    done_when TEXT,                         -- JSON array of success criteria
    status TEXT DEFAULT 'parsing',          -- parsing|compiled|generating|verifying|judging|complete|failed
    created_at INTEGER NOT NULL,            -- Unix timestamp
    updated_at INTEGER NOT NULL
);

-- Specifications: Compiled from intents
CREATE TABLE specifications (
    id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL REFERENCES intents(id),
    assertions TEXT NOT NULL,               -- JSON array of testable assertions
    verification_tests TEXT NOT NULL,       -- Generated test file content
    type_contract TEXT,                     -- TypeScript types to satisfy
    allowed_files TEXT NOT NULL,            -- JSON array of paths
    forbidden_files TEXT NOT NULL,          -- JSON array of paths
    patterns TEXT,                          -- JSON array of patterns to follow
    version INTEGER DEFAULT 1,              -- Incremented on refinement
    created_at INTEGER NOT NULL
);

-- Attempts: Generated implementations
CREATE TABLE attempts (
    id TEXT PRIMARY KEY,
    spec_id TEXT NOT NULL REFERENCES specifications(id),
    strategy TEXT NOT NULL,                 -- vanilla|minimal|defensive|patterns|mutation|adversarial
    files TEXT NOT NULL,                    -- JSON array of {path, action, content}
    approach TEXT,                          -- Brief description
    ai_confidence REAL,                     -- 0.0-1.0
    status TEXT DEFAULT 'pending',          -- pending|verifying|passed|failed
    created_at INTEGER NOT NULL
);

-- Verification results
CREATE TABLE verifications (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES attempts(id),
    passed INTEGER NOT NULL,                -- 0 or 1
    typecheck_passed INTEGER,
    typecheck_errors TEXT,
    lint_passed INTEGER,
    lint_errors TEXT,
    unit_tests_passed INTEGER,
    unit_tests_output TEXT,
    spec_tests_passed INTEGER,
    spec_tests_output TEXT,
    assertions_passed INTEGER,
    assertions_total INTEGER,
    failure_reason TEXT,
    duration_ms INTEGER,
    created_at INTEGER NOT NULL
);

-- Survivors: Ranked passing attempts
CREATE TABLE survivors (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES attempts(id),
    verification_id TEXT NOT NULL REFERENCES verifications(id),
    rank INTEGER NOT NULL,
    score_assertions REAL,
    score_simplicity REAL,
    score_performance REAL,
    score_readability REAL,
    score_overall REAL,
    presented_to_human INTEGER DEFAULT 0,   -- 0 or 1
    human_decision TEXT,                    -- accept|refine|redirect|null
    created_at INTEGER NOT NULL
);

-- Human judgments
CREATE TABLE judgments (
    id TEXT PRIMARY KEY,
    intent_id TEXT NOT NULL REFERENCES intents(id),
    survivor_id TEXT REFERENCES survivors(id),
    decision TEXT NOT NULL,                 -- accept|refine|redirect|abort
    refinement TEXT,                        -- New constraints if refine
    redirect_intent TEXT,                   -- New intent if redirect
    created_at INTEGER NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_intents_session ON intents(session_id);
CREATE INDEX idx_intents_status ON intents(status);
CREATE INDEX idx_attempts_spec ON attempts(spec_id);
CREATE INDEX idx_attempts_status ON attempts(status);
CREATE INDEX idx_survivors_rank ON survivors(rank);
```

### Database Location

```
~/.config/opencode/manifest/
├── manifest.db              -- SQLite database
├── workspaces/              -- Temp workspaces for verification
│   └── {attempt_id}/        -- Isolated workspace per attempt
└── logs/
    └── {intent_id}.log      -- Debug logs per intent
```

---

## 3. FAILURE MODES & MITIGATIONS

### 3.1 Intent Compilation Failures

| Failure | Cause | Detection | Mitigation |
|---------|-------|-----------|------------|
| **Ambiguous intent** | Human request unclear | AI flags ambiguities | Return clarification questions, don't proceed |
| **Impossible constraints** | Contradictory must/must_not | Constraint solver | Report contradiction, ask human to resolve |
| **No testable criteria** | "Make it better" with no measurable done_when | No assertions generated | Prompt human for specific success criteria |
| **Codebase not accessible** | File system errors | I/O errors during analysis | Fail fast, report which files inaccessible |
| **Pattern extraction fails** | Codebase too complex/unusual | Timeout or garbage patterns | Use sensible defaults, warn human |

**Recovery**: All compilation failures return to human with specific questions. Never generate from bad spec.

### 3.2 Generation Swarm Failures

| Failure | Cause | Detection | Mitigation |
|---------|-------|-----------|------------|
| **API rate limits** | Too many parallel calls | 429 responses | Exponential backoff, reduce parallelism |
| **API timeout** | Slow responses | Timeout exceeded | Retry with exponential backoff (3 attempts) |
| **API errors** | 500s, network issues | Error responses | Retry, then mark attempt as failed |
| **All attempts identical** | Low temperature or narrow spec | Hash comparison | Increase temperature, add random mutations |
| **Context too large** | Spec + codebase exceeds limits | Token count | Chunk codebase, prioritize relevant files |
| **Cost explosion** | N=100 is expensive | Cost tracking | Configurable N, cost ceiling, warn before expensive runs |

**Recovery**: Generation failures are expected. Log them, continue with successful attempts. If all fail, report to human.

### 3.3 Reality Harness Failures

| Failure | Cause | Detection | Mitigation |
|---------|-------|-----------|------------|
| **Workspace creation fails** | Disk full, permissions | I/O errors | Clean old workspaces, report disk issue |
| **Tests hang** | Infinite loop in generated code | Timeout (30s default) | Kill process, mark attempt failed |
| **Tests crash process** | Segfault, OOM | Process exit code | Isolate in subprocess, mark failed |
| **Flaky tests** | Non-deterministic | Different results on rerun | Run 3x, require 2/3 pass |
| **Missing dependencies** | Generated code needs packages | Import errors | Either fail or auto-install (configurable) |
| **Type checker crashes** | Invalid TypeScript | Process crash | Mark failed, not a verification pass |

**Recovery**: Reality harness should be extremely defensive. Every failure mode = attempt marked failed, not system crash.

### 3.4 Survivor Pool Failures

| Failure | Cause | Detection | Mitigation |
|---------|-------|-----------|------------|
| **Zero survivors** | All attempts failed | Empty survivor list | Report top 3 failures with reasons to human |
| **All survivors identical** | Low variation in generation | Hash comparison | Report "low diversity", suggest spec changes |
| **Ranking metric fails** | Can't measure simplicity/perf | Metric returns null | Exclude that metric, weight others higher |
| **Too many survivors** | Thousands passed | Count > threshold | Aggressive ranking, only show top K |

**Recovery**: Zero survivors is informative. Show failure patterns. Human redirects.

### 3.5 Human Judgment Failures

| Failure | Cause | Detection | Mitigation |
|---------|-------|-----------|------------|
| **Human unresponsive** | AFK, distracted | Timeout (configurable) | Send notification, wait |
| **Human rejects all survivors** | None are acceptable | "reject all" action | Log feedback, ask for redirect or new constraints |
| **Infinite refinement loop** | Human keeps refining | Loop count > threshold | Warn "5 refinements, consider restart" |
| **Conflicting judgments** | Human says accept then reject | Action log analysis | Use latest judgment, log conflict |

**Recovery**: Human is always in control. System waits patiently. Never auto-proceed without human.

### 3.6 Database Failures

| Failure | Cause | Detection | Mitigation |
|---------|-------|-----------|------------|
| **DB locked** | Concurrent writes | SQLITE_BUSY | Retry with backoff, use WAL mode |
| **DB corrupted** | Crash during write | Integrity check fails | Restore from backup, warn human |
| **Disk full** | No space | Write fails | Clean old sessions, alert human |
| **Schema mismatch** | Plugin updated | Version check | Auto-migrate or fail with clear message |

**Recovery**: Database is critical. Use WAL mode. Backup before migrations. Never lose human's work.

---

## 4. EDGE CASES

### 4.1 Extreme Inputs

| Edge Case | Handling |
|-----------|----------|
| **Empty intent** | "I need more information. What do you want to build?" |
| **Massive intent** (10k+ chars) | Truncate to 10k, summarize rest |
| **Intent in non-English** | Process anyway (AI handles multilingual) |
| **Intent with code blocks** | Extract code as example/constraint |
| **Intent references external URLs** | Fetch and include (with permission) |
| **Intent references images** | Not supported, ask for text description |

### 4.2 Extreme Codebase

| Edge Case | Handling |
|-----------|----------|
| **Empty codebase** | Valid - we're creating from scratch |
| **Massive codebase** (100k+ files) | Intelligent filtering: prioritize by relevance |
| **Binary files** | Skip, only process text |
| **Minified code** | Skip, not useful for pattern extraction |
| **No package.json/tsconfig** | Infer settings or ask human |
| **Monorepo** | Ask which package to focus on |

### 4.3 Extreme Generation

| Edge Case | Handling |
|-----------|----------|
| **N=1** | Valid, just not parallel. Works fine. |
| **N=1000** | Warn about cost/time, require confirmation |
| **All strategies fail** | Report which strategies failed and why |
| **One strategy dominates** | Fine, just means that approach works |
| **Mutation creates duplicates** | Dedupe by content hash |

### 4.4 Extreme Verification

| Edge Case | Handling |
|-----------|----------|
| **No tests in spec** | Fail - can't verify without assertions |
| **Tests take 10+ minutes** | Timeout, mark failed, suggest faster tests |
| **Tests require network** | Configurable: allow or mock |
| **Tests require DB** | Configurable: spin up test DB or mock |
| **Tests modify real data** | FORBIDDEN - always use isolated workspace |

---

## 5. PARALLEL EXECUTION DESIGN

### 5.1 Generation Parallelism

```typescript
async function generateMany(spec: Specification, n: number): Promise<Attempt[]> {
  const strategies = distributeStrategies(n);
  // strategies = { vanilla: 20, minimal: 15, defensive: 15, ... }

  const promises: Promise<Attempt>[] = [];

  for (const [strategy, count] of Object.entries(strategies)) {
    for (let i = 0; i < count; i++) {
      promises.push(
        generateOne(spec, strategy, i)
          .catch(err => {
            log.warn(`Generation failed: ${strategy}#${i}`, err);
            return null; // Don't fail the whole batch
          })
      );
    }
  }

  const results = await Promise.all(promises);
  return results.filter((r): r is Attempt => r !== null);
}
```

### 5.2 Verification Parallelism

```typescript
async function verifyAll(
  attempts: Attempt[],
  spec: Specification
): Promise<VerificationResult[]> {
  // Limit concurrency to avoid overwhelming system
  const CONCURRENCY = 10;
  const semaphore = new Semaphore(CONCURRENCY);

  const promises = attempts.map(attempt =>
    semaphore.acquire().then(async release => {
      try {
        return await verifyOne(attempt, spec);
      } finally {
        release();
      }
    })
  );

  return Promise.all(promises);
}
```

### 5.3 Workspace Isolation

```typescript
async function verifyOne(
  attempt: Attempt,
  spec: Specification
): Promise<VerificationResult> {
  // Create isolated workspace
  const workspace = await createWorkspace(attempt.id);

  try {
    // Copy base codebase
    await copyCodebase(workspace);

    // Apply attempt's changes
    await applyChanges(workspace, attempt.files);

    // Write spec tests
    await writeFile(
      path.join(workspace, '__spec_tests__/spec.test.ts'),
      spec.verificationTests
    );

    // Run verification pipeline
    const typecheck = await runTypecheck(workspace);
    const lint = await runLint(workspace);
    const unitTests = await runUnitTests(workspace);
    const specTests = await runSpecTests(workspace);

    return {
      attemptId: attempt.id,
      passed: typecheck.passed && lint.passed && unitTests.passed && specTests.passed,
      checks: { typecheck, lint, unitTests, specTests },
      assertionsPassed: specTests.passed ? spec.assertions.length : 0,
      assertionsTotal: spec.assertions.length,
      failureReason: getFirstFailure(typecheck, lint, unitTests, specTests)
    };
  } finally {
    // Always cleanup
    await removeWorkspace(workspace);
  }
}
```

---

## 6. OPENCODE PLUGIN STRUCTURE

Following the single-file pattern from `hypr-notifier.ts`:

```typescript
// src/manifest-plugin.ts

import type { Plugin } from "@opencode-ai/plugin"

// ============================================================
// SECTION 1: TYPES (100 lines)
// ============================================================
type Intent = Readonly<{ /* ... */ }>
type Specification = Readonly<{ /* ... */ }>
type Attempt = Readonly<{ /* ... */ }>
type VerificationResult = Readonly<{ /* ... */ }>
type Survivor = Readonly<{ /* ... */ }>
type Judgment = Readonly<{ /* ... */ }>

// ============================================================
// SECTION 2: DATABASE (150 lines)
// ============================================================
class Database {
  private db: BunSQLite
  constructor(path: string) { /* ... */ }

  // Intent operations
  createIntent(intent: Intent): Promise<string>
  getIntent(id: string): Promise<Intent | null>
  updateIntentStatus(id: string, status: string): Promise<void>

  // Specification operations
  createSpec(spec: Specification): Promise<string>
  getSpecForIntent(intentId: string): Promise<Specification | null>

  // Attempt operations
  createAttempts(attempts: Attempt[]): Promise<void>
  getAttemptsForSpec(specId: string): Promise<Attempt[]>
  updateAttemptStatus(id: string, status: string): Promise<void>

  // Verification operations
  createVerification(result: VerificationResult): Promise<string>

  // Survivor operations
  createSurvivors(survivors: Survivor[]): Promise<void>
  getSurvivorsForIntent(intentId: string): Promise<Survivor[]>

  // Judgment operations
  createJudgment(judgment: Judgment): Promise<string>
}

// ============================================================
// SECTION 3: INTENT COMPILER (200 lines)
// ============================================================
async function parseIntent(message: string): Promise<ParsedIntent>
async function analyzeCodebase(intent: ParsedIntent): Promise<CodebaseAnalysis>
async function generateSpecification(
  intent: ParsedIntent,
  analysis: CodebaseAnalysis
): Promise<Specification>
async function validateSpecification(spec: Specification): Promise<ValidationResult>
async function compileIntentToSpec(message: string): Promise<Specification>

// ============================================================
// SECTION 4: GENERATION SWARM (150 lines)
// ============================================================
type Strategy = "vanilla" | "minimal" | "defensive" | "patterns" | "mutation" | "adversarial"
function distributeStrategies(n: number): Record<Strategy, number>
async function generateOne(spec: Specification, strategy: Strategy): Promise<Attempt>
async function generateMany(spec: Specification, n: number): Promise<Attempt[]>

// ============================================================
// SECTION 5: REALITY HARNESS (200 lines)
// ============================================================
async function createWorkspace(attemptId: string): Promise<string>
async function applyChanges(workspace: string, files: FileChange[]): Promise<void>
async function runTypecheck(workspace: string): Promise<CheckResult>
async function runLint(workspace: string): Promise<CheckResult>
async function runUnitTests(workspace: string): Promise<CheckResult>
async function runSpecTests(workspace: string): Promise<CheckResult>
async function verifyOne(attempt: Attempt, spec: Specification): Promise<VerificationResult>
async function verifyAll(attempts: Attempt[], spec: Specification): Promise<VerificationResult[]>

// ============================================================
// SECTION 6: SURVIVOR POOL (100 lines)
// ============================================================
function scoreSimplicity(attempt: Attempt): number
function scoreReadability(attempt: Attempt): number
function rankSurvivors(results: VerificationResult[]): Survivor[]
function getTopK(survivors: Survivor[], k: number): Survivor[]

// ============================================================
// SECTION 7: ORCHESTRATOR (150 lines)
// ============================================================
async function manifest(message: string): Promise<Artifact>
async function handleHumanJudgment(judgment: Judgment): Promise<void>
async function handleRefinement(refinement: string): Promise<void>
async function handleRedirect(newIntent: string): Promise<void>

// ============================================================
// SECTION 8: PLUGIN EXPORT (50 lines)
// ============================================================
export const ManifestPlugin: Plugin = async () => {
  const db = new Database(getDbPath())

  return {
    name: "manifest",

    // Detect significant feature requests
    message: async ({ message, context }) => {
      if (isSignificantFeature(message)) {
        return manifest(message)
      }
    },

    // Handle events from the system
    event: async ({ event }) => {
      switch (event.type) {
        case "human.judgment":
          await handleHumanJudgment(event.properties)
          break
        // ...
      }
    }
  }
}

export default ManifestPlugin
```

---

## 7. RUNTIME MEMORY STATE

```typescript
// In-memory state for current session
type RuntimeState = {
  // Current manifest operation (if any)
  currentManifest: {
    intentId: string
    status: ManifestStatus
    phase: "compiling" | "generating" | "verifying" | "ranking" | "judging"
    progress: {
      total: number
      completed: number
      failed: number
    }
  } | null

  // Active workspaces (for cleanup on crash)
  activeWorkspaces: Set<string>

  // Pending AI calls (for rate limiting)
  pendingCalls: number

  // Cost tracking
  estimatedCost: number
  costCeiling: number
}

let state: RuntimeState = {
  currentManifest: null,
  activeWorkspaces: new Set(),
  pendingCalls: 0,
  estimatedCost: 0,
  costCeiling: 10.00 // $10 default ceiling
}
```

---

## 8. CONFIGURATION

```typescript
type ManifestConfig = Readonly<{
  // Database
  dbPath: string                    // Default: ~/.config/opencode/manifest/manifest.db

  // Generation
  defaultN: number                  // Default: 50
  maxN: number                      // Default: 200
  costCeiling: number               // Default: 10.00 ($)

  // Verification
  verificationTimeout: number       // Default: 30000 (30s)
  verificationConcurrency: number   // Default: 10
  flakyTestRetries: number          // Default: 3

  // Survivor pool
  topK: number                      // Default: 5
  rankingWeights: {
    assertions: number              // Default: 0.4
    simplicity: number              // Default: 0.25
    performance: number             // Default: 0.15
    readability: number             // Default: 0.1
    coverage: number                // Default: 0.1
  }

  // Behavior
  autoInstallDependencies: boolean  // Default: false
  allowNetworkInTests: boolean      // Default: false
  cleanupWorkspaces: boolean        // Default: true

  // Notifications
  notifications: boolean            // Default: true
}>

const DEFAULT_CONFIG: ManifestConfig = Object.freeze({
  dbPath: path.join(homedir(), '.config/opencode/manifest/manifest.db'),
  defaultN: 50,
  maxN: 200,
  costCeiling: 10.00,
  verificationTimeout: 30000,
  verificationConcurrency: 10,
  flakyTestRetries: 3,
  topK: 5,
  rankingWeights: {
    assertions: 0.4,
    simplicity: 0.25,
    performance: 0.15,
    readability: 0.1,
    coverage: 0.1
  },
  autoInstallDependencies: false,
  allowNetworkInTests: false,
  cleanupWorkspaces: true,
  notifications: true
})
```

---

## 9. STRESS TEST SCENARIOS

### Scenario 1: 100 Parallel Generations
- **Setup**: N=100, spec requires complex feature
- **Expected**: 100 AI calls complete in ~30-60s
- **Monitored**: Memory usage, API rate limits, error rate
- **Pass criteria**: <5% failures, no crashes, <$5 cost

### Scenario 2: Zero Survivors
- **Setup**: Impossible spec (contradictory requirements)
- **Expected**: All 50 attempts fail verification
- **Monitored**: Failure reasons captured, human notified
- **Pass criteria**: Clear failure report, no zombie processes

### Scenario 3: Flaky Tests
- **Setup**: Spec with timing-dependent tests
- **Expected**: Some attempts pass on retry
- **Monitored**: Flaky detection triggers re-run
- **Pass criteria**: 2/3 consistent results accepted

### Scenario 4: Massive Codebase
- **Setup**: 10k+ files in codebase
- **Expected**: Intelligent filtering, reasonable token usage
- **Monitored**: Context size, relevance of included files
- **Pass criteria**: <50k tokens per generation call

### Scenario 5: Infinite Refinement
- **Setup**: Human keeps saying "not quite"
- **Expected**: Warning after 5 refinements
- **Monitored**: Loop count, human frustration signals
- **Pass criteria**: System remains stable, suggests restart

### Scenario 6: Crash Recovery
- **Setup**: Kill plugin mid-verification
- **Expected**: On restart, cleanup orphan workspaces, resume or restart intent
- **Monitored**: Workspace cleanup, DB integrity
- **Pass criteria**: No orphan files, DB consistent

---

## 10. ROUND 4 SUMMARY

### What This Round Covered

| Area | Details |
|------|---------|
| **Database schema** | 6 tables, indexes, full audit trail |
| **Failure modes** | 25+ failure scenarios with mitigations |
| **Edge cases** | Extreme inputs, codebases, generation counts |
| **Parallelism** | Semaphore-controlled concurrent execution |
| **Plugin structure** | ~1100 lines, 8 sections, single file |
| **Memory state** | Runtime tracking for progress, cost, cleanup |
| **Configuration** | 15+ settings with sensible defaults |
| **Stress tests** | 6 scenarios to validate robustness |

### Open Questions Resolved

| Question | Answer |
|----------|--------|
| Full system or just compiler? | **Full system** |
| Where does state live? | **SQLite DB + memory runtime** |
| How many parallel calls? | **Configurable, default 50, max 200** |
| OpenCode patterns? | **Yes, single-file plugin** |

### What Round 5 Will Cover

- Final implementation spec
- Exact prompt text for each AI call
- Test file structure
- Deployment instructions
- User documentation

---

**This is Round 4. Review the failure modes and stress tests.**

**To proceed**: Say "approve round 4" to move to Round 5 (final implementation spec).
