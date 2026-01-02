# Planning Plugin Design Document

## Version: Round 3 - The Transcendent Loop

**Previous rounds asked**: "How do we plan better?"
**This round asks**: "What are humans actually for in this loop?"

---

## 1. THE REFRAME

### What We Got Wrong

Rounds 1-2 designed a **serial planning process**:
```
Human asks → AI produces 1 thing → Human reviews → Human asks for changes → repeat
```

This is the same bottleneck we're trying to escape. We made planning "more thorough" but kept the human in every iteration.

### What We Actually Need

```
Human intends → AI produces 100 attempts → Reality tests all 100 →
Survivors surface → Human judges survivors only

Bottleneck: only compute and human intent clarity
```

The planning plugin should not guide humans through planning steps.
It should **compile human intent into executable specifications**, then get out of the way.

---

## 2. THE ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                     INTENT TERMINAL                             │
│                                                                 │
│   Human provides:                                               │
│   - What they want (natural language)                           │
│   - Constraints (must/must-not)                                 │
│   - Examples of "good" (if available)                           │
│                                                                 │
│   Human does NOT:                                               │
│   - Iterate manually                                            │
│   - Review intermediate work                                    │
│   - Debug                                                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     INTENT COMPILER                             │
│                                                                 │
│   Inputs:                                                       │
│   - Natural language intent                                     │
│   - Codebase context                                            │
│   - Constraints                                                 │
│                                                                 │
│   Outputs:                                                      │
│   - Executable specification                                    │
│   - Success criteria (testable assertions)                      │
│   - Verification harness (how to check if it worked)            │
│                                                                 │
│   THIS IS THE HARD PART. THIS IS WHERE AI SHINES.               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GENERATION SWARM                             │
│                                                                 │
│   Inputs:                                                       │
│   - Executable specification                                    │
│   - N = number of parallel attempts                             │
│                                                                 │
│   Outputs:                                                      │
│   - N different implementations                                 │
│   - Variations: algorithms, structures, styles                  │
│   - Mutations: random perturbations of good solutions           │
│                                                                 │
│   NO JUDGMENT. JUST VOLUME.                                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    REALITY HARNESS                              │
│                                                                 │
│   Executes EVERY attempt against:                               │
│   - Type checker (does it compile?)                             │
│   - Linter (does it follow rules?)                              │
│   - Unit tests (does it pass spec?)                             │
│   - Property tests (does it hold invariants?)                   │
│   - Benchmarks (how fast? how small?)                           │
│                                                                 │
│   Returns: Pass/Fail + Evidence                                 │
│   Does not care about intent or elegance.                       │
│   Only answers: DOES THIS WORK OR NOT.                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SURVIVOR POOL                                │
│                                                                 │
│   Inputs: All attempts + All results                            │
│                                                                 │
│   Filters: Only those that passed verification                  │
│                                                                 │
│   Ranks by secondary criteria:                                  │
│   - Simplicity (fewer lines, fewer dependencies)                │
│   - Speed (benchmark results)                                   │
│   - Readability (AI-assessed or heuristic)                      │
│                                                                 │
│   Outputs: Top K candidates for human judgment                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HUMAN JUDGMENT                               │
│                                                                 │
│   Sees: K survivors (already verified working)                  │
│                                                                 │
│   Chooses:                                                      │
│   - "This one" → SHIP                                           │
│   - "None of these, try X angle" → Redirect intent              │
│   - "Closer but needs Y" → Refine specification                 │
│                                                                 │
│   Minimal effort. Maximum leverage.                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. THE FIVE COMPONENTS

### 3.1 Intent Terminal

**What it is**: The human interface. Minimal, focused on capturing intent.

**What human provides**:
```yaml
intent: "Add user authentication to the app"

constraints:
  must:
    - "Use existing User model in src/models/user.ts"
    - "Session-based, not JWT"
    - "Password hashing with bcrypt"
  must_not:
    - "No OAuth for now"
    - "No changes to database schema"

examples:
  good: "The login flow in acme-corp/webapp"
  bad: "The over-engineered auth in that enterprise project"

done_when:
  - "User can register with email/password"
  - "User can log in and get a session"
  - "Protected routes reject unauthenticated requests"
```

**What human does NOT provide**:
- Implementation details
- Step-by-step instructions
- Architecture decisions
- Code reviews

---

### 3.2 Intent Compiler

**What it is**: AI system that transforms intent into executable specification.

**Input**: Intent (natural language + constraints + examples)

**Output**: Specification object

```typescript
type Specification = {
  // What success looks like (testable)
  assertions: Assertion[]

  // Generated test file that verifies the implementation
  verificationTests: string

  // Type signature that must be satisfied
  typeContract: string

  // Files that can be created/modified
  allowedFiles: string[]

  // Files that must not be touched
  forbiddenFiles: string[]

  // Patterns to follow (extracted from codebase)
  patterns: Pattern[]

  // The human's original intent (for reference)
  originalIntent: string
}

type Assertion = {
  description: string           // "User can register with email/password"
  testCode: string              // Actual test that verifies this
  weight: number                // How important (1-10)
}
```

**The compiler's job**:
1. Parse the codebase to understand existing patterns
2. Identify relevant files and their interfaces
3. Generate test assertions from "done_when" criteria
4. Create a verification harness that can check any implementation
5. Define boundaries (what can/cannot change)

**This is the hardest part**. Getting intent→spec right determines everything downstream.

---

### 3.3 Generation Swarm

**What it is**: Parallel AI generation of N implementations.

**Input**: Specification

**Output**: N implementation attempts

```typescript
type Attempt = {
  id: string
  files: FileChange[]           // The actual code changes
  approach: string              // Brief description of strategy
  confidence: number            // AI's self-assessed confidence
}

type FileChange = {
  path: string
  action: "create" | "modify" | "delete"
  content: string
}
```

**Generation strategies** (run in parallel):

| Strategy | Description | Count |
|----------|-------------|-------|
| Vanilla | Straightforward implementation | 20 |
| Minimal | Fewest lines possible | 15 |
| Defensive | Maximum error handling | 15 |
| Patterns | Copy patterns from codebase | 20 |
| Mutations | Variations of promising attempts | 20 |
| Adversarial | Try to break the spec | 10 |

**Key principle**: No judgment during generation. Generate volume. Let reality filter.

---

### 3.4 Reality Harness

**What it is**: Parallel execution of all attempts against verification.

**Verification pipeline** (for each attempt):

```
Attempt
   │
   ├─→ Apply changes to temp workspace
   │
   ├─→ Type check (tsc --noEmit)
   │      └─→ Pass/Fail + errors
   │
   ├─→ Lint (eslint/biome)
   │      └─→ Pass/Fail + warnings
   │
   ├─→ Unit tests (bun test)
   │      └─→ Pass/Fail + coverage
   │
   ├─→ Specification tests (from compiler)
   │      └─→ Pass/Fail + which assertions
   │
   ├─→ Property tests (if applicable)
   │      └─→ Pass/Fail + counterexamples
   │
   └─→ Benchmarks (if applicable)
          └─→ Metrics: time, memory, size
```

**Output per attempt**:

```typescript
type VerificationResult = {
  attemptId: string
  passed: boolean

  checks: {
    typecheck: CheckResult
    lint: CheckResult
    unitTests: CheckResult
    specTests: CheckResult
    propertyTests: CheckResult | null
    benchmarks: BenchmarkResult | null
  }

  // How many of the original "done_when" criteria passed
  assertionsPassed: number
  assertionsTotal: number

  // Failure details if not passed
  failureReason: string | null
}
```

**Key principle**: Reality is the only judge. Not the AI, not the human, not "best practices."

---

### 3.5 Survivor Pool

**What it is**: Filters and ranks passing attempts.

**Filtering**: Only attempts where `passed === true`

**Ranking criteria**:

| Criterion | Weight | Measurement |
|-----------|--------|-------------|
| Assertions passed | 40% | Count of passing spec assertions |
| Simplicity | 25% | Lines of code, cyclomatic complexity |
| Performance | 15% | Benchmark results (if available) |
| Readability | 10% | Heuristics or AI assessment |
| Test coverage | 10% | Coverage of new code |

**Output**: Top K attempts (default K=5)

```typescript
type Survivor = {
  attempt: Attempt
  result: VerificationResult
  rank: number
  scores: {
    assertions: number
    simplicity: number
    performance: number
    readability: number
    coverage: number
    overall: number
  }
}
```

---

## 4. THE LOOP

```typescript
async function manifest(intent: Intent): Promise<Artifact> {
  // Step 1: Compile intent to specification
  const spec = await compileIntentToSpec(intent);

  // Present spec to human for validation
  const specApproved = await humanValidateSpec(spec);
  if (!specApproved.approved) {
    // Human refines intent, try again
    return manifest(specApproved.refinedIntent);
  }

  // Step 2: Main generation loop
  while (true) {
    // Generate many attempts in parallel
    const attempts = await generateMany(spec, { n: 100 });

    // Verify all attempts against reality
    const results = await verifyAll(attempts, spec);

    // Filter to survivors
    const survivors = results.filter(r => r.passed);

    // Rank and take top K
    const topK = rankSurvivors(survivors).slice(0, 5);

    if (topK.length === 0) {
      // Nothing passed. Show failures to human for redirect.
      const redirect = await humanHandleNoSurvivors(results);
      if (redirect.action === "refine_spec") {
        spec = await compileIntentToSpec(redirect.newIntent);
        continue;
      } else if (redirect.action === "abort") {
        throw new Error("Human aborted: no viable solutions");
      }
    }

    // Present survivors to human
    const judgment = await humanJudge(topK);

    switch (judgment.decision) {
      case "accept":
        // Human picked a winner
        return applyAttempt(judgment.selected);

      case "refine":
        // Human wants variations on a theme
        spec = refineSpec(spec, judgment.refinement);
        continue;

      case "redirect":
        // Human wants a completely different angle
        spec = await compileIntentToSpec(judgment.newIntent);
        continue;
    }
  }
}
```

---

## 5. WHAT THE PLUGIN ACTUALLY DOES

Given this architecture, the **Planning Plugin** is specifically the **Intent Compiler** component.

### Plugin Interface

```typescript
import type { Plugin } from "@opencode-ai/plugin"

export const PlanningPlugin: Plugin = async () => {
  return {
    // Hook into user messages to detect intent
    message: async ({ message, context }) => {
      const intent = parseIntent(message);

      if (intent.isSignificantFeature) {
        // Compile to specification
        const spec = await compileIntentToSpec(intent, context);

        // Return the specification for the generation swarm
        return {
          type: "planning.spec.ready",
          properties: { spec }
        };
      }
    },

    // Hook into events from other components
    event: async ({ event }) => {
      switch (event.type) {
        case "generation.complete":
          // Swarm finished generating attempts
          break;
        case "verification.complete":
          // Reality harness finished
          break;
        case "human.judgment":
          // Human made a decision
          break;
      }
    }
  };
};
```

### The Compiler's Prompts

Instead of prompts for "rounds of planning," we need prompts for **compiling intent to specification**.

#### Prompt 1: Parse Intent

```markdown
# PARSE INTENT

You are parsing a human's intent into structured form.

## Input
The human said: "{message}"

## Output

Extract:

1. **Core Intent**: What do they fundamentally want? (1 sentence)

2. **Constraints**:
   - must: Things that must be true
   - must_not: Things that must not happen

3. **Success Criteria**: How will we know it's done?
   - List specific, testable conditions

4. **Ambiguities**: What's unclear that needs clarification?

5. **Scope**: What's explicitly in/out?

Return as structured YAML.
```

#### Prompt 2: Analyze Codebase

```markdown
# ANALYZE CODEBASE FOR INTENT

Given:
- Intent: {intent}
- Codebase files: {file_list}

Determine:

1. **Relevant Files**: Which files relate to this intent?
   - List paths and why they're relevant

2. **Patterns**: What patterns exist that should be followed?
   - Code style, architecture, naming conventions

3. **Interfaces**: What existing interfaces must be satisfied?
   - Types, APIs, contracts

4. **Forbidden Zones**: What must NOT be changed?
   - Critical files, stable APIs

5. **Integration Points**: Where does new code connect to existing?
```

#### Prompt 3: Generate Specification

```markdown
# GENERATE EXECUTABLE SPECIFICATION

Given:
- Intent: {intent}
- Codebase analysis: {analysis}

Create a specification that a generation swarm can implement against.

## Assertions

For each success criterion, write a test:

```typescript
// Assertion: "User can register with email/password"
test("user registration", async () => {
  const result = await register("test@example.com", "password123");
  expect(result.success).toBe(true);
  expect(result.user.email).toBe("test@example.com");
});
```

## Type Contract

Define the types that must exist:

```typescript
type RegisterResult = {
  success: boolean;
  user?: User;
  error?: string;
};

function register(email: string, password: string): Promise<RegisterResult>;
```

## Allowed Files

List files that can be created or modified:
- src/auth/register.ts (create)
- src/routes/auth.ts (modify)

## Forbidden Files

List files that must not be touched:
- src/models/user.ts (stable schema)
- src/db/migrations/* (no schema changes)
```

#### Prompt 4: Validate Specification

```markdown
# VALIDATE SPECIFICATION

Before sending to generation swarm, verify:

1. **Testable**: Every assertion has executable test code?
2. **Bounded**: Allowed/forbidden files clearly defined?
3. **Consistent**: No contradictions in constraints?
4. **Sufficient**: Passing all assertions = actually done?
5. **Minimal**: No unnecessary complexity in spec?

If issues found, fix them. If clarification needed from human, list questions.
```

---

## 6. INTEGRATION WITH ECOSYSTEM

### Events Emitted

| Event | When | Consumed By |
|-------|------|-------------|
| `planning.intent.parsed` | Intent extracted from message | UI |
| `planning.spec.ready` | Specification compiled | Generation Swarm |
| `planning.clarification.needed` | Ambiguity found | Human Terminal |
| `planning.spec.validated` | Spec ready for generation | Orchestrator |

### Events Consumed

| Event | From | Action |
|-------|------|--------|
| `human.intent` | Human Terminal | Start compilation |
| `human.clarification` | Human Terminal | Incorporate and continue |
| `human.refine` | Judgment | Update spec |
| `generation.complete` | Swarm | Trigger verification |
| `verification.complete` | Harness | Trigger ranking |

---

## 7. WHAT STILL NEEDS DESIGN

This plugin is ONE component. The full system needs:

| Component | Status | Notes |
|-----------|--------|-------|
| Intent Terminal | Not designed | Human input interface |
| Intent Compiler | This plugin | Designed here |
| Generation Swarm | Not designed | Parallel AI generation |
| Reality Harness | Not designed | Parallel verification |
| Survivor Pool | Not designed | Ranking and filtering |
| Orchestrator | Not designed | Coordinates all components |

### Questions for Human

1. Are we building the full system or just the Intent Compiler plugin?
2. How does generation swarm actually spawn parallel AI calls?
3. What's the interface between components? (Events? Direct calls? Files?)
4. Where does state live? (Memory? Disk? Database?)
5. Is this an OpenCode plugin or a standalone system?

---

## 8. ROUND 3 SUMMARY

### What Changed

| Before | After |
|--------|-------|
| 5 serial rounds of planning | Intent → Spec compilation |
| Human reviews every iteration | Human judges only survivors |
| AI produces 1 thing at a time | AI produces N things in parallel |
| Planning is the goal | Specification is the goal |
| Human iterates | Reality iterates |

### The Core Insight

> You don't iterate. Reality iterates.
> You don't generate. AI generates.
> You don't verify. Tests verify.
>
> You ONLY do what only you can do:
> - Know what you want
> - Recognize when you have it
> - Redirect when the whole approach is wrong

---

**This is Round 3. Review and provide feedback.**

**To proceed**: Say "approve round 3" or redirect the design.
