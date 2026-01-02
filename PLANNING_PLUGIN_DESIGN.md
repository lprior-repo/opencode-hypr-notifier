# Planning Plugin Design Document

## Version: Round 5 - Final Implementation Spec

**All 5 rounds complete. This is the production-ready specification.**

---

## 1. SYSTEM OVERVIEW

### Name: Manifest

A plugin that transforms human intent into working code through parallel generation and reality-based verification.

```
Human Intent → Specification → N Parallel Attempts → Reality Tests → Survivors → Human Judgment
```

### Core Files

```
src/
└── manifest-plugin.ts      # Single-file plugin (~1200 lines)

~/.config/opencode/manifest/
├── manifest.db             # SQLite database
├── config.json             # User configuration
├── workspaces/             # Temporary verification workspaces
└── logs/                   # Debug logs
```

---

## 2. COMPLETE TYPE DEFINITIONS

```typescript
// ============================================================
// CORE TYPES
// ============================================================

type Intent = Readonly<{
  id: string
  sessionId: string
  rawMessage: string
  parsed: ParsedIntent | null
  status: IntentStatus
  createdAt: number
  updatedAt: number
}>

type ParsedIntent = Readonly<{
  coreIntent: string                    // 1 sentence summary
  constraints: {
    must: readonly string[]             // Required conditions
    mustNot: readonly string[]          // Forbidden conditions
  }
  doneWhen: readonly string[]           // Success criteria
  ambiguities: readonly string[]        // Questions for human
  scope: {
    in: readonly string[]               // Explicitly included
    out: readonly string[]              // Explicitly excluded
  }
}>

type IntentStatus =
  | "parsing"
  | "clarifying"
  | "compiling"
  | "generating"
  | "verifying"
  | "ranking"
  | "judging"
  | "complete"
  | "failed"

type Specification = Readonly<{
  id: string
  intentId: string
  version: number
  assertions: readonly Assertion[]
  verificationTests: string             // Complete test file content
  typeContract: string                  // TypeScript types to satisfy
  allowedFiles: readonly string[]
  forbiddenFiles: readonly string[]
  patterns: readonly Pattern[]
  createdAt: number
}>

type Assertion = Readonly<{
  id: string
  description: string                   // Human-readable
  testCode: string                      // Executable test
  weight: number                        // 1-10 importance
}>

type Pattern = Readonly<{
  name: string
  description: string
  example: string                       // Code snippet
  appliesTo: readonly string[]          // File patterns
}>

type Attempt = Readonly<{
  id: string
  specId: string
  strategy: Strategy
  files: readonly FileChange[]
  approach: string                      // Brief description
  confidence: number                    // 0.0-1.0
  status: AttemptStatus
  createdAt: number
}>

type Strategy =
  | "vanilla"      // Straightforward implementation
  | "minimal"      // Fewest lines possible
  | "defensive"    // Maximum error handling
  | "patterns"     // Follow codebase patterns closely
  | "mutation"     // Variation of a promising attempt
  | "adversarial"  // Try to break the spec

type AttemptStatus = "pending" | "verifying" | "passed" | "failed"

type FileChange = Readonly<{
  path: string
  action: "create" | "modify" | "delete"
  content: string
}>

type VerificationResult = Readonly<{
  id: string
  attemptId: string
  passed: boolean
  checks: {
    typecheck: CheckResult
    lint: CheckResult
    unitTests: CheckResult
    specTests: CheckResult
  }
  assertionsPassed: number
  assertionsTotal: number
  failureReason: string | null
  durationMs: number
  createdAt: number
}>

type CheckResult = Readonly<{
  passed: boolean
  output: string
  errors: readonly string[]
}>

type Survivor = Readonly<{
  id: string
  attemptId: string
  verificationId: string
  rank: number
  scores: {
    assertions: number
    simplicity: number
    performance: number
    readability: number
    overall: number
  }
  presentedToHuman: boolean
  createdAt: number
}>

type Judgment = Readonly<{
  id: string
  intentId: string
  survivorId: string | null
  decision: "accept" | "refine" | "redirect" | "abort"
  refinement: string | null             // If refine
  redirectIntent: string | null         // If redirect
  createdAt: number
}>
```

---

## 3. EXACT AI PROMPTS

### 3.1 Parse Intent Prompt

```markdown
# PARSE INTENT

You are extracting structured intent from a human's natural language request.

## Human's Message

{message}

## Your Task

Analyze this message and extract:

### 1. Core Intent
Write ONE sentence that captures what the human fundamentally wants.
Not how to do it. Not implementation details. Just the goal.

### 2. Constraints
Extract explicit and implicit constraints:

**Must** (things that MUST be true):
- Technologies they specified
- Patterns they want followed
- Requirements they stated

**Must Not** (things that MUST NOT happen):
- Technologies they rejected
- Changes they forbid
- Patterns to avoid

### 3. Done When
List specific, testable conditions that define success.
Each should be verifiable with a test.
Be concrete: "user can log in" not "authentication works"

### 4. Ambiguities
List anything unclear that needs human clarification before proceeding.
If the request is clear, return empty list.

### 5. Scope
**In**: What's explicitly included in this request
**Out**: What's explicitly excluded or deferred

## Output Format

Return valid YAML:

```yaml
coreIntent: "..."
constraints:
  must:
    - "..."
  mustNot:
    - "..."
doneWhen:
  - "..."
ambiguities:
  - "..."
scope:
  in:
    - "..."
  out:
    - "..."
```

If there are critical ambiguities that prevent proceeding, set them in the ambiguities list.
The system will ask the human for clarification before continuing.
```

---

### 3.2 Analyze Codebase Prompt

```markdown
# ANALYZE CODEBASE

You are analyzing a codebase to understand how to implement a feature.

## Intent

{parsedIntent}

## Codebase Structure

{fileTree}

## Key Files Content

{relevantFilesContent}

## Your Task

Analyze the codebase and determine:

### 1. Relevant Files
Which existing files relate to this intent?
List each with WHY it's relevant.

### 2. Patterns
What patterns exist that new code should follow?
- Naming conventions
- File organization
- Error handling style
- Import patterns
- Test patterns

### 3. Interfaces
What existing interfaces must be satisfied or extended?
- Types to implement
- Functions to call
- APIs to match

### 4. Forbidden Zones
What files/areas should NOT be modified?
- Stable APIs
- Generated files
- Config files unless specifically needed

### 5. Integration Points
Where does new code connect to existing code?
- Entry points
- Imports needed
- Exports to add

## Output Format

Return valid YAML:

```yaml
relevantFiles:
  - path: "..."
    reason: "..."

patterns:
  - name: "..."
    description: "..."
    example: |
      code here

interfaces:
  - name: "..."
    type: "..."
    location: "..."

forbiddenFiles:
  - "..."

integrationPoints:
  - location: "..."
    action: "..."
```
```

---

### 3.3 Generate Specification Prompt

```markdown
# GENERATE SPECIFICATION

You are creating an executable specification that defines success for an implementation.

## Intent

{parsedIntent}

## Codebase Analysis

{codebaseAnalysis}

## Your Task

Create a specification that:
1. Can verify ANY valid implementation (not just one approach)
2. Is testable with automated tests
3. Captures all success criteria from the intent

### 1. Assertions

For each "doneWhen" criterion, write a test.
Tests should be:
- Independent (can run in any order)
- Deterministic (same result every time)
- Fast (< 1 second each)

Format:
```typescript
import { describe, test, expect } from "bun:test"

describe("{feature}", () => {
  test("{criterion}", async () => {
    // Arrange
    // Act
    // Assert
  })
})
```

### 2. Type Contract

Define the TypeScript types that must exist.
These are the PUBLIC interfaces the implementation must satisfy.

```typescript
// Types that must be implemented
type X = { ... }

// Functions that must exist
function y(param: Type): ReturnType
```

### 3. Allowed Files

List files that CAN be created or modified.
Format: `path (create|modify)`

### 4. Forbidden Files

List files that MUST NOT be touched.
Include reason.

## Output Format

Return valid YAML:

```yaml
assertions:
  - id: "a1"
    description: "..."
    weight: 8
    testCode: |
      test("...", async () => {
        ...
      })

verificationTests: |
  import { describe, test, expect } from "bun:test"

  describe("Specification Tests", () => {
    // All tests here
  })

typeContract: |
  // TypeScript types

allowedFiles:
  - path: "..."
    action: "create"
  - path: "..."
    action: "modify"

forbiddenFiles:
  - path: "..."
    reason: "..."
```
```

---

### 3.4 Generate Implementation Prompt (Per Strategy)

```markdown
# GENERATE IMPLEMENTATION

You are implementing a feature according to a specification.

## Specification

{specification}

## Strategy: {strategy}

{strategyInstructions}

## Codebase Context

{relevantCodebaseFiles}

## Your Task

Implement the feature by:
1. Creating/modifying only allowed files
2. Satisfying all assertions in the specification
3. Following the patterns identified in the codebase
4. Matching the type contract exactly

## Strategy Instructions

### vanilla
Implement in the most straightforward way.
Clear, readable, standard patterns.
Don't optimize prematurely.

### minimal
Implement in the fewest lines possible.
Remove all unnecessary abstraction.
Inline where reasonable.
But still correct and readable.

### defensive
Maximum error handling.
Validate all inputs.
Handle all edge cases.
Graceful degradation.

### patterns
Follow codebase patterns exactly.
Match existing style precisely.
Use same libraries/utilities.
Feel like existing code.

### mutation
Base: {baseAttempt}
Create a variation that:
- Changes algorithm/approach slightly
- Uses different helper methods
- Restructures but preserves behavior

### adversarial
Try to satisfy the tests while finding edge cases.
Look for ambiguities in the spec.
Implement literally what's tested, nothing more.

## Output Format

Return valid YAML:

```yaml
approach: "Brief description of implementation approach"
confidence: 0.85  # 0.0-1.0

files:
  - path: "src/feature/index.ts"
    action: "create"
    content: |
      // Full file content

  - path: "src/routes.ts"
    action: "modify"
    content: |
      // Full file content after modification
```

IMPORTANT:
- Return complete file contents, not diffs
- Ensure code compiles (valid TypeScript)
- Follow patterns from the codebase
- Satisfy the type contract
```

---

### 3.5 Score Readability Prompt

```markdown
# SCORE READABILITY

You are evaluating code readability.

## Code

{attemptFiles}

## Score on these criteria (0-10 each):

1. **Naming**: Are variables, functions, types well-named?
2. **Structure**: Is the code well-organized?
3. **Clarity**: Is the logic easy to follow?
4. **Comments**: Are complex parts explained (but not over-commented)?
5. **Consistency**: Does it match its own patterns internally?

## Output Format

```yaml
naming: 8
structure: 7
clarity: 9
comments: 6
consistency: 8
overall: 7.6
reasoning: "Brief explanation"
```
```

---

## 4. ORCHESTRATION FLOW

```typescript
async function manifest(message: string, sessionId: string): Promise<ManifestResult> {
  const db = getDatabase()

  // ============================================================
  // PHASE 1: PARSE INTENT
  // ============================================================
  const intentId = generateId()
  await db.createIntent({ id: intentId, sessionId, rawMessage: message, status: "parsing" })

  const parsed = await parseIntent(message)

  if (parsed.ambiguities.length > 0) {
    await db.updateIntent(intentId, { status: "clarifying", parsed })
    return {
      status: "needs_clarification",
      questions: parsed.ambiguities
    }
  }

  await db.updateIntent(intentId, { status: "compiling", parsed })

  // ============================================================
  // PHASE 2: ANALYZE CODEBASE
  // ============================================================
  const analysis = await analyzeCodebase(parsed)

  // ============================================================
  // PHASE 3: GENERATE SPECIFICATION
  // ============================================================
  const spec = await generateSpecification(parsed, analysis)
  await db.createSpec(spec)

  // Present spec to human for validation
  const specApproval = await presentSpecToHuman(spec)
  if (!specApproval.approved) {
    // Human refines, loop back
    return manifest(specApproval.refinedMessage, sessionId)
  }

  await db.updateIntent(intentId, { status: "generating" })

  // ============================================================
  // PHASE 4: GENERATE ATTEMPTS
  // ============================================================
  const config = getConfig()
  const attempts = await generateMany(spec, config.defaultN)
  await db.createAttempts(attempts)

  await db.updateIntent(intentId, { status: "verifying" })

  // ============================================================
  // PHASE 5: VERIFY ALL ATTEMPTS
  // ============================================================
  const results = await verifyAll(attempts, spec)
  await db.createVerifications(results)

  // Update attempt statuses
  for (const result of results) {
    await db.updateAttempt(result.attemptId, {
      status: result.passed ? "passed" : "failed"
    })
  }

  await db.updateIntent(intentId, { status: "ranking" })

  // ============================================================
  // PHASE 6: RANK SURVIVORS
  // ============================================================
  const passed = results.filter(r => r.passed)

  if (passed.length === 0) {
    // Nothing passed - show failures to human
    const topFailures = getTopFailures(results, 3)
    return {
      status: "no_survivors",
      failures: topFailures,
      suggestion: analyzeFailurePatterns(results)
    }
  }

  const survivors = await rankSurvivors(passed, attempts)
  await db.createSurvivors(survivors)

  const topK = survivors.slice(0, config.topK)

  await db.updateIntent(intentId, { status: "judging" })

  // ============================================================
  // PHASE 7: PRESENT TO HUMAN
  // ============================================================
  return {
    status: "survivors_ready",
    survivors: topK.map(s => ({
      id: s.id,
      rank: s.rank,
      approach: attempts.find(a => a.id === s.attemptId)!.approach,
      scores: s.scores,
      files: attempts.find(a => a.id === s.attemptId)!.files
    }))
  }
}

async function handleJudgment(
  intentId: string,
  judgment: Judgment
): Promise<ManifestResult> {
  const db = getDatabase()
  await db.createJudgment(judgment)

  switch (judgment.decision) {
    case "accept":
      // Apply the selected attempt
      const attempt = await db.getAttempt(judgment.survivorId!)
      await applyChanges(attempt.files)
      await db.updateIntent(intentId, { status: "complete" })
      return { status: "complete", appliedFiles: attempt.files }

    case "refine":
      // Refine the spec and regenerate
      const intent = await db.getIntent(intentId)
      const refinedMessage = `${intent.rawMessage}\n\nRefinement: ${judgment.refinement}`
      return manifest(refinedMessage, intent.sessionId)

    case "redirect":
      // Start fresh with new intent
      const originalIntent = await db.getIntent(intentId)
      return manifest(judgment.redirectIntent!, originalIntent.sessionId)

    case "abort":
      await db.updateIntent(intentId, { status: "failed" })
      return { status: "aborted" }
  }
}
```

---

## 5. VERIFICATION HARNESS

```typescript
async function verifyOne(
  attempt: Attempt,
  spec: Specification
): Promise<VerificationResult> {
  const workspaceId = attempt.id
  const workspacePath = path.join(WORKSPACES_DIR, workspaceId)

  const startTime = Date.now()

  try {
    // Create isolated workspace
    await fs.mkdir(workspacePath, { recursive: true })

    // Copy current codebase
    await copyCodebase(process.cwd(), workspacePath, {
      exclude: ["node_modules", ".git", "dist"]
    })

    // Apply attempt's changes
    for (const file of attempt.files) {
      const filePath = path.join(workspacePath, file.path)

      if (file.action === "delete") {
        await fs.unlink(filePath).catch(() => {})
      } else {
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, file.content)
      }
    }

    // Write specification tests
    const specTestPath = path.join(workspacePath, "__spec_tests__", "spec.test.ts")
    await fs.mkdir(path.dirname(specTestPath), { recursive: true })
    await fs.writeFile(specTestPath, spec.verificationTests)

    // Run verification pipeline
    const typecheck = await runWithTimeout(
      () => runTypecheck(workspacePath),
      30000,
      { passed: false, output: "Timeout", errors: ["Typecheck timed out"] }
    )

    const lint = await runWithTimeout(
      () => runLint(workspacePath),
      30000,
      { passed: false, output: "Timeout", errors: ["Lint timed out"] }
    )

    const unitTests = await runWithTimeout(
      () => runTests(workspacePath, "**/*.test.ts", ["__spec_tests__"]),
      60000,
      { passed: false, output: "Timeout", errors: ["Unit tests timed out"] }
    )

    const specTests = await runWithTimeout(
      () => runTests(workspacePath, "__spec_tests__/**/*.test.ts"),
      60000,
      { passed: false, output: "Timeout", errors: ["Spec tests timed out"] }
    )

    const passed = typecheck.passed && lint.passed && unitTests.passed && specTests.passed

    return {
      id: generateId(),
      attemptId: attempt.id,
      passed,
      checks: { typecheck, lint, unitTests, specTests },
      assertionsPassed: passed ? spec.assertions.length : countPassedAssertions(specTests),
      assertionsTotal: spec.assertions.length,
      failureReason: passed ? null : getFirstFailure(typecheck, lint, unitTests, specTests),
      durationMs: Date.now() - startTime,
      createdAt: Date.now()
    }
  } finally {
    // Always cleanup
    await fs.rm(workspacePath, { recursive: true, force: true })
  }
}

async function runTypecheck(workspace: string): Promise<CheckResult> {
  const result = await $`cd ${workspace} && bunx tsc --noEmit 2>&1`.quiet().nothrow()
  return {
    passed: result.exitCode === 0,
    output: result.stdout.toString(),
    errors: result.exitCode === 0 ? [] : parseTypescriptErrors(result.stdout.toString())
  }
}

async function runLint(workspace: string): Promise<CheckResult> {
  const result = await $`cd ${workspace} && bunx biome check . 2>&1`.quiet().nothrow()
  return {
    passed: result.exitCode === 0,
    output: result.stdout.toString(),
    errors: result.exitCode === 0 ? [] : parseLintErrors(result.stdout.toString())
  }
}

async function runTests(workspace: string, pattern: string, exclude?: string[]): Promise<CheckResult> {
  const excludeArgs = exclude?.map(e => `--exclude ${e}`).join(" ") || ""
  const result = await $`cd ${workspace} && bun test ${pattern} ${excludeArgs} 2>&1`.quiet().nothrow()
  return {
    passed: result.exitCode === 0,
    output: result.stdout.toString(),
    errors: result.exitCode === 0 ? [] : parseTestErrors(result.stdout.toString())
  }
}
```

---

## 6. RANKING ALGORITHM

```typescript
async function rankSurvivors(
  results: VerificationResult[],
  attempts: Attempt[]
): Promise<Survivor[]> {
  const config = getConfig()
  const weights = config.rankingWeights

  const survivors: Survivor[] = []

  for (const result of results) {
    const attempt = attempts.find(a => a.id === result.attemptId)!

    // Calculate scores
    const assertionScore = result.assertionsPassed / result.assertionsTotal

    const simplicityScore = scoreSimplicity(attempt)

    const performanceScore = 1.0  // TODO: Add benchmarks if needed

    const readabilityScore = await scoreReadability(attempt)

    const overall =
      assertionScore * weights.assertions +
      simplicityScore * weights.simplicity +
      performanceScore * weights.performance +
      readabilityScore * weights.readability

    survivors.push({
      id: generateId(),
      attemptId: attempt.id,
      verificationId: result.id,
      rank: 0,  // Set after sorting
      scores: {
        assertions: assertionScore,
        simplicity: simplicityScore,
        performance: performanceScore,
        readability: readabilityScore,
        overall
      },
      presentedToHuman: false,
      createdAt: Date.now()
    })
  }

  // Sort by overall score descending
  survivors.sort((a, b) => b.scores.overall - a.scores.overall)

  // Assign ranks
  survivors.forEach((s, i) => s.rank = i + 1)

  return survivors
}

function scoreSimplicity(attempt: Attempt): number {
  let totalLines = 0
  let totalComplexity = 0

  for (const file of attempt.files) {
    if (file.action === "delete") continue

    const lines = file.content.split("\n").length
    totalLines += lines

    // Simple complexity heuristics
    const nestingDepth = maxNestingDepth(file.content)
    const functionCount = (file.content.match(/function |=> |async /g) || []).length

    totalComplexity += nestingDepth + (functionCount / 10)
  }

  // Lower lines and complexity = higher score
  // Normalize to 0-1 range
  const lineScore = Math.max(0, 1 - (totalLines / 500))
  const complexityScore = Math.max(0, 1 - (totalComplexity / 20))

  return (lineScore + complexityScore) / 2
}

function maxNestingDepth(content: string): number {
  let max = 0
  let current = 0

  for (const char of content) {
    if (char === "{") current++
    if (char === "}") current--
    max = Math.max(max, current)
  }

  return max
}

async function scoreReadability(attempt: Attempt): Promise<number> {
  // Use AI to score readability
  const result = await callAI("score_readability", {
    attemptFiles: attempt.files
  })

  return result.overall / 10  // Convert 0-10 to 0-1
}
```

---

## 7. PLUGIN EXPORT

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const ManifestPlugin: Plugin = async () => {
  // Initialize database
  const db = await initDatabase()

  // Cleanup any orphan workspaces from previous crashes
  await cleanupOrphanWorkspaces()

  return {
    name: "manifest",

    event: async ({ event }) => {
      switch (event.type) {
        // User sent a message that might be a feature request
        case "message.user": {
          const message = event.properties.content
          const sessionId = event.properties.sessionId

          if (isSignificantFeature(message)) {
            log("Detected significant feature request, starting manifest flow")
            const result = await manifest(message, sessionId)

            // Emit result event for UI
            return {
              type: "manifest.result",
              properties: result
            }
          }
          break
        }

        // Human provided clarification
        case "manifest.clarification": {
          const { intentId, answers } = event.properties
          const result = await handleClarification(intentId, answers)
          return {
            type: "manifest.result",
            properties: result
          }
        }

        // Human approved spec
        case "manifest.spec.approved": {
          const { intentId } = event.properties
          const result = await continueAfterSpecApproval(intentId)
          return {
            type: "manifest.result",
            properties: result
          }
        }

        // Human judged survivors
        case "manifest.judgment": {
          const { intentId, judgment } = event.properties
          const result = await handleJudgment(intentId, judgment)
          return {
            type: "manifest.result",
            properties: result
          }
        }
      }
    }
  }
}

function isSignificantFeature(message: string): boolean {
  // Heuristics for detecting feature requests vs simple questions
  const featureIndicators = [
    /\b(add|implement|create|build|make|write)\b/i,
    /\b(feature|functionality|capability|system)\b/i,
    /\b(should|must|need to|want to)\b/i
  ]

  const questionIndicators = [
    /^(what|where|how|why|when|who|which)\b/i,
    /\?$/,
    /\b(explain|describe|show me|tell me)\b/i
  ]

  const featureScore = featureIndicators.filter(r => r.test(message)).length
  const questionScore = questionIndicators.filter(r => r.test(message)).length

  return featureScore > questionScore && message.length > 50
}

export default ManifestPlugin
```

---

## 8. TEST STRUCTURE

```
__tests__/
├── manifest-plugin.test.ts      # Plugin integration tests
├── intent-compiler.test.ts      # Intent parsing tests
├── specification.test.ts        # Spec generation tests
├── generation.test.ts           # Attempt generation tests
├── verification.test.ts         # Reality harness tests
├── ranking.test.ts              # Survivor ranking tests
└── fixtures/
    ├── intents/                 # Sample intent messages
    ├── codebases/               # Mock codebases
    └── specs/                   # Expected specifications
```

### Key Test Cases

```typescript
// intent-compiler.test.ts
describe("Intent Compiler", () => {
  test("parses simple feature request", async () => {
    const message = "Add user authentication with email and password"
    const parsed = await parseIntent(message)

    expect(parsed.coreIntent).toContain("authentication")
    expect(parsed.doneWhen).toContainEqual(expect.stringContaining("login"))
  })

  test("detects ambiguities", async () => {
    const message = "Make the app better"
    const parsed = await parseIntent(message)

    expect(parsed.ambiguities.length).toBeGreaterThan(0)
  })

  test("extracts constraints", async () => {
    const message = "Add auth using bcrypt, not plain text passwords"
    const parsed = await parseIntent(message)

    expect(parsed.constraints.must).toContainEqual(expect.stringContaining("bcrypt"))
    expect(parsed.constraints.mustNot).toContainEqual(expect.stringContaining("plain text"))
  })
})

// verification.test.ts
describe("Reality Harness", () => {
  test("passes valid implementation", async () => {
    const spec = createTestSpec()
    const attempt = createValidAttempt()

    const result = await verifyOne(attempt, spec)

    expect(result.passed).toBe(true)
    expect(result.assertionsPassed).toBe(result.assertionsTotal)
  })

  test("fails invalid implementation", async () => {
    const spec = createTestSpec()
    const attempt = createInvalidAttempt()

    const result = await verifyOne(attempt, spec)

    expect(result.passed).toBe(false)
    expect(result.failureReason).toBeDefined()
  })

  test("handles timeout", async () => {
    const spec = createTestSpec()
    const attempt = createHangingAttempt()

    const result = await verifyOne(attempt, spec)

    expect(result.passed).toBe(false)
    expect(result.failureReason).toContain("timeout")
  })

  test("cleans up workspace on error", async () => {
    const spec = createTestSpec()
    const attempt = createCrashingAttempt()

    await verifyOne(attempt, spec).catch(() => {})

    const workspacePath = path.join(WORKSPACES_DIR, attempt.id)
    expect(await fs.exists(workspacePath)).toBe(false)
  })
})
```

---

## 9. DEPLOYMENT

### Installation

```bash
# In your OpenCode plugins directory
cd ~/.config/opencode/plugins

# Clone or copy the plugin
cp /path/to/manifest-plugin.ts ./

# Or install from npm (when published)
bun add @opencode/manifest-plugin
```

### Configuration

Create `~/.config/opencode/manifest/config.json`:

```json
{
  "defaultN": 50,
  "maxN": 200,
  "costCeiling": 10.00,
  "verificationTimeout": 30000,
  "verificationConcurrency": 10,
  "topK": 5,
  "notifications": true
}
```

### First Run

The plugin automatically:
1. Creates the database
2. Creates the workspaces directory
3. Cleans up any orphan workspaces

---

## 10. USER DOCUMENTATION

### How It Works

When you ask for a significant feature, Manifest:

1. **Parses your intent** - Extracts what you want, constraints, and success criteria
2. **Analyzes the codebase** - Understands patterns and integration points
3. **Creates a specification** - Defines testable success criteria
4. **Generates 50 implementations** - In parallel, using different strategies
5. **Tests all of them** - Against the specification
6. **Shows you the winners** - Top 5 that passed all tests

### Commands

- `manifest status` - Show current manifest operation
- `manifest abort` - Cancel current operation
- `manifest history` - Show past manifest sessions

### Example Flow

```
You: Add user authentication with email/password

Manifest: I've parsed your intent. Here's what I understand:

  Core: Add email/password authentication
  Done when:
    - User can register with email/password
    - User can log in with valid credentials
    - Invalid login returns error
    - Protected routes require authentication

  Does this look right? (yes/refine)

You: yes

Manifest: Generating 50 implementations...
  ████████████████████████████████ 50/50

  Verifying...
  ████████████████████████████████ 50/50

  Results: 23 passed, 27 failed

  Top 5 Survivors:

  1. [Score: 0.92] Minimal approach - 47 lines
  2. [Score: 0.89] Pattern-following approach - 63 lines
  3. [Score: 0.87] Defensive approach - 89 lines
  4. [Score: 0.85] Vanilla approach - 72 lines
  5. [Score: 0.81] Mutation of #1 - 51 lines

  View details? (1-5) or accept? (a1-a5) or refine? (r)

You: a1

Manifest: Applied survivor #1. Files changed:
  - src/auth/login.ts (created)
  - src/auth/register.ts (created)
  - src/middleware/auth.ts (created)
  - src/routes/index.ts (modified)
```

---

## 11. ROUND 5 COMPLETE

### What This Specification Contains

| Section | Content |
|---------|---------|
| **Types** | Complete TypeScript definitions |
| **Prompts** | Exact text for all 5 AI prompts |
| **Orchestration** | Full manifest flow with all phases |
| **Verification** | Complete harness with timeout handling |
| **Ranking** | Scoring algorithm with weights |
| **Plugin Export** | OpenCode-compatible plugin structure |
| **Tests** | Test structure and key cases |
| **Deployment** | Installation and configuration |
| **User Docs** | How it works and example flow |

### Ready For Implementation

This specification is complete. The plugin can be implemented directly from this document.

**Estimated implementation**: ~1200 lines TypeScript

---

## PLANNING COMPLETE

5 rounds of iteration:
1. Initial architecture
2. Full prompts for rounds
3. Transcendent loop reframe
4. Stress test & failure modes
5. Final implementation spec

**The design is approved and ready for implementation.**
