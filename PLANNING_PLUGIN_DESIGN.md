# Planning Plugin Design Document

## Version: Round 2 - Full Prompts & Clarity Focus

**Changes from Round 1:**
- Session scope: Per-feature (not per-conversation)
- Removed enforcement complexity
- Added complete prompts for all 5 rounds
- Focused on clarity and usability

---

## 1. VISION

### What This Plugin Does

When an AI assistant receives a request for a significant feature, this plugin guides it through **5 structured rounds of planning** before any implementation begins. Each round has a specific purpose and produces concrete artifacts.

### Why It Matters

- Forces thorough thinking before coding
- Catches design flaws early
- Ensures user alignment at every step
- Creates documentation as a byproduct
- Reduces rework and wasted effort

---

## 2. THE 5 ROUNDS

| Round | Name | Purpose | Output |
|-------|------|---------|--------|
| 1 | **Discovery** | Understand what we're building and why | Requirements document |
| 2 | **Architecture** | Design the high-level structure | Component diagram + decisions |
| 3 | **Specification** | Define the details | API contracts, data models |
| 4 | **Edge Cases** | Identify what could go wrong | Risk register + mitigations |
| 5 | **Implementation Plan** | Create the execution roadmap | Ordered task list |

---

## 3. COMPLETE ROUND PROMPTS

### ROUND 1: DISCOVERY

```markdown
# ROUND 1: DISCOVERY

I need to fully understand what we're building before designing a solution.

## Questions I Need Answered

### The Problem
1. What specific problem are you trying to solve?
2. What's happening today that's painful or missing?
3. Who experiences this problem? (end users, developers, ops?)

### The Solution Vision
4. What does success look like when this is done?
5. How will you know it's working correctly?
6. What's the simplest version that would be valuable?

### Constraints
7. What technologies must we use? (language, framework, infra)
8. What technologies must we avoid?
9. Are there performance requirements? (latency, throughput, scale)
10. Are there security or compliance requirements?

### Context
11. Is there existing code that relates to this feature?
12. Are there patterns elsewhere in the codebase I should follow?
13. What have you already tried or considered?

## What I'll Produce

Once you answer these questions, I'll create:

- **Problem Statement**: A clear 2-3 sentence description of what we're solving
- **Success Criteria**: Measurable outcomes that define "done"
- **Constraints List**: Hard boundaries I must respect
- **Scope Definition**: What's in and what's explicitly out

---

**Please answer the questions above, then say "approve round 1" to continue.**
```

---

### ROUND 2: ARCHITECTURE

```markdown
# ROUND 2: ARCHITECTURE

Based on your requirements from Round 1, I'll now design the high-level structure.

## My Proposed Architecture

### Components
I'll define each major component:

| Component | Responsibility | Inputs | Outputs |
|-----------|---------------|--------|---------|
| [Name] | [What it does] | [What it receives] | [What it produces] |

### Component Relationships
```
[Diagram showing how components connect]
```

### Key Architectural Decisions

For each significant decision, I'll explain:

| Decision | Options Considered | Choice | Rationale |
|----------|-------------------|--------|-----------|
| [What needed deciding] | [Option A, B, C] | [Selected] | [Why this one] |

### Data Flow

1. [Entry point] receives [input]
2. [Component A] processes it by [action]
3. [Component B] transforms it to [output]
4. [Exit point] returns [result]

### Technology Choices

| Need | Technology | Why |
|------|------------|-----|
| [Requirement] | [Tool/Library] | [Justification] |

## What I Need From You

1. Does this structure make sense for your codebase?
2. Are the component boundaries appropriate?
3. Do the technology choices align with your preferences?
4. Is there existing code I should integrate with rather than build new?

---

**Review the architecture above. Provide feedback or say "approve round 2" to continue.**
```

---

### ROUND 3: SPECIFICATION

```markdown
# ROUND 3: SPECIFICATION

Now I'll define the precise details of each component.

## Data Models

### [Model Name]
```typescript
type ModelName = {
  id: string                    // Unique identifier
  field1: Type                  // Description of field1
  field2: Type                  // Description of field2
  createdAt: Date               // When created
  updatedAt: Date               // When last modified
}
```

[Repeat for each data model]

## API Contracts

### [Function/Endpoint Name]

**Purpose**: [What this does]

**Signature**:
```typescript
function name(param1: Type, param2: Type): ReturnType
```

**Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| param1 | Type | Yes | What this parameter controls |
| param2 | Type | No | Optional behavior modifier |

**Returns**:
| Condition | Return Value |
|-----------|--------------|
| Success | { result: Data } |
| Not Found | { error: "NOT_FOUND" } |
| Invalid Input | { error: "INVALID_INPUT", details: string } |

**Example**:
```typescript
// Input
name("value1", { option: true })

// Output
{ result: { id: "123", status: "complete" } }
```

[Repeat for each function/endpoint]

## State Management

### State Shape
```typescript
type State = {
  [key]: Type    // Description
}
```

### State Transitions
| Current State | Event | New State | Side Effects |
|---------------|-------|-----------|--------------|
| idle | START | running | Initialize resources |
| running | COMPLETE | done | Cleanup, notify |
| running | ERROR | failed | Log, cleanup |

## File Structure

```
src/
├── [feature]/
│   ├── types.ts        # Type definitions
│   ├── [component].ts  # Main implementation
│   ├── utils.ts        # Helper functions
│   └── index.ts        # Public exports
└── __tests__/
    └── [feature].test.ts
```

## What I Need From You

1. Do these data models capture everything needed?
2. Are the API contracts clear and complete?
3. Does the file structure fit your project conventions?
4. Any fields, parameters, or behaviors missing?

---

**Review the specifications above. Provide feedback or say "approve round 3" to continue.**
```

---

### ROUND 4: EDGE CASES

```markdown
# ROUND 4: EDGE CASES

Before implementation, I need to identify what could go wrong and how to handle it.

## Error Scenarios

### Input Errors
| Scenario | How It Happens | Detection | Response |
|----------|---------------|-----------|----------|
| Invalid input format | User provides malformed data | Validation at entry | Return 400 with details |
| Missing required field | Required param not provided | Schema validation | List missing fields |
| Out of range value | Number exceeds limits | Bounds check | Return allowed range |

### System Errors
| Scenario | How It Happens | Detection | Response |
|----------|---------------|-----------|----------|
| Dependency unavailable | External service down | Timeout/connection error | Retry with backoff, then fail gracefully |
| Resource exhausted | Memory/disk full | Resource monitoring | Reject new requests, alert |
| Concurrent modification | Race condition | Version check | Retry or conflict error |

### Business Logic Errors
| Scenario | How It Happens | Detection | Response |
|----------|---------------|-----------|----------|
| [Specific to feature] | [Cause] | [Detection method] | [Handling] |

## Security Considerations

| Threat | Risk Level | Mitigation |
|--------|------------|------------|
| Injection attacks | High | Input sanitization, parameterized queries |
| Authentication bypass | High | Validate tokens on every request |
| Data exposure | Medium | Principle of least privilege |
| [Feature-specific] | [Level] | [Mitigation] |

## Performance Concerns

| Scenario | Threshold | Detection | Mitigation |
|----------|-----------|-----------|------------|
| High load | >100 req/s | Metrics monitoring | Rate limiting, caching |
| Large payload | >10MB | Size check at entry | Streaming, chunking |
| Slow dependency | >5s response | Timeout | Circuit breaker |

## Recovery Procedures

### If [Component] Fails
1. [Immediate action]
2. [Fallback behavior]
3. [Recovery steps]
4. [Verification]

### Data Consistency
- How do we ensure data stays consistent if a process fails mid-operation?
- What's the rollback strategy?
- How do we detect and fix inconsistencies?

## What I Need From You

1. Are there domain-specific edge cases I'm missing?
2. What error scenarios have you seen in similar features?
3. Are the security mitigations appropriate for your risk tolerance?
4. What's your preference for error message verbosity?

---

**Review the edge cases above. Provide feedback or say "approve round 4" to continue.**
```

---

### ROUND 5: IMPLEMENTATION PLAN

```markdown
# ROUND 5: IMPLEMENTATION PLAN

All designs are approved. Here's the execution roadmap.

## Implementation Order

I'll implement in this sequence, where each step builds on the previous:

### Phase 1: Foundation
| Step | Task | Dependencies | Output |
|------|------|--------------|--------|
| 1.1 | Create type definitions | None | types.ts |
| 1.2 | Set up file structure | None | Directory scaffold |
| 1.3 | Write test fixtures | Types | test-fixtures.ts |

### Phase 2: Core Logic
| Step | Task | Dependencies | Output |
|------|------|--------------|--------|
| 2.1 | Implement [core component] | Types | [file].ts |
| 2.2 | Write unit tests for core | Core component | [file].test.ts |
| 2.3 | Implement [next component] | Core component | [file].ts |

### Phase 3: Integration
| Step | Task | Dependencies | Output |
|------|------|--------------|--------|
| 3.1 | Connect components | All components | Integration code |
| 3.2 | Integration tests | Connected system | integration.test.ts |
| 3.3 | Error handling | Integration | Error paths tested |

### Phase 4: Polish
| Step | Task | Dependencies | Output |
|------|------|--------------|--------|
| 4.1 | Edge case handling | Core complete | Robust error handling |
| 4.2 | Performance verification | Integration complete | Benchmarks passing |
| 4.3 | Documentation | All code complete | README updates |

## Test Strategy

### Unit Tests
- Each function tested in isolation
- Mock external dependencies
- Cover happy path + error cases
- Target: [X]% code coverage

### Integration Tests
- Test component interactions
- Use real dependencies where possible
- Cover main user flows

### Test Commands
```bash
bun test                    # Run all tests
bun test --watch            # Watch mode
bun test [file]             # Single file
```

## Verification Checklist

Before marking complete:
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Lint passes
- [ ] Manual testing of main flow
- [ ] Edge cases handled
- [ ] Error messages are clear
- [ ] Code is readable

## Rollback Plan

If issues are discovered after implementation:
1. [How to detect problems]
2. [How to disable/rollback]
3. [How to fix forward]

---

## PLANNING COMPLETE

All 5 rounds are approved. I have:

1. **Discovery**: Clear requirements and constraints
2. **Architecture**: Approved component design
3. **Specification**: Detailed contracts and models
4. **Edge Cases**: Identified risks and mitigations
5. **Implementation Plan**: Ordered execution roadmap

**Ready to begin implementation. Say "start implementation" to proceed.**
```

---

## 4. STATE MANAGEMENT

### Per-Feature Session

Each feature being planned gets its own session:

```typescript
type PlanningSession = Readonly<{
  featureId: string           // Unique ID for this feature
  featureName: string         // Human-readable name
  currentRound: 1 | 2 | 3 | 4 | 5
  rounds: {
    discovery: RoundState
    architecture: RoundState
    specification: RoundState
    edgeCases: RoundState
    implementationPlan: RoundState
  }
  artifacts: {
    requirements: string      // From Round 1
    architecture: string      // From Round 2
    specification: string     // From Round 3
    edgeCases: string         // From Round 4
    implementationPlan: string // From Round 5
  }
  createdAt: number
  updatedAt: number
}>

type RoundState = Readonly<{
  status: "pending" | "in_progress" | "approved"
  feedback: string[]          // User feedback incorporated
  approvedAt: number | null
}>
```

### Storage Location

```
~/.config/opencode/planning/
├── sessions/
│   └── {featureId}.json      # Session state
└── config.json               # Plugin settings
```

---

## 5. PLUGIN EVENTS

### Events Emitted

| Event | When | Properties |
|-------|------|------------|
| `planning.started` | New planning session begins | `{ featureId, featureName }` |
| `planning.round.started` | Round begins | `{ featureId, round, roundName }` |
| `planning.round.approved` | User approves round | `{ featureId, round }` |
| `planning.complete` | All 5 rounds approved | `{ featureId, featureName }` |
| `planning.feedback` | User provides feedback | `{ featureId, round, feedback }` |

### Notification Integration

The hypr-notifier can listen for these events:

| Event | Notification |
|-------|--------------|
| `planning.round.started` | "Planning Round {n}: {name}" |
| `planning.round.approved` | "Round {n} approved" |
| `planning.complete` | "Planning complete - Ready to implement" |

---

## 6. CONFIGURATION

### Config File

`~/.config/opencode/planning/config.json`

```json
{
  "notifications": true,
  "persistSessions": true,
  "defaultRounds": ["discovery", "architecture", "specification", "edgeCases", "implementationPlan"]
}
```

### Sensible Defaults

All settings have reasonable defaults. The plugin works without any configuration.

---

## 7. IMPLEMENTATION STRUCTURE

```typescript
// src/planning-plugin.ts

// ============================================================
// TYPES
// ============================================================
type PlanningSession = { /* ... */ }
type RoundState = { /* ... */ }
type PlanningEvent = { /* ... */ }

// ============================================================
// CONSTANTS
// ============================================================
const ROUND_PROMPTS = {
  discovery: `...`,
  architecture: `...`,
  specification: `...`,
  edgeCases: `...`,
  implementationPlan: `...`
}

const DEFAULT_CONFIG = Object.freeze({ /* ... */ })

// ============================================================
// STATE
// ============================================================
let sessions: Map<string, PlanningSession> = new Map()
let config: PlanningConfig | null = null

// ============================================================
// SESSION MANAGEMENT
// ============================================================
function createSession(featureId: string, featureName: string): PlanningSession
function getSession(featureId: string): PlanningSession | null
function updateSession(featureId: string, updates: Partial<PlanningSession>): void
function saveSession(session: PlanningSession): Promise<void>
function loadSession(featureId: string): Promise<PlanningSession | null>

// ============================================================
// ROUND HANDLERS
// ============================================================
function startRound(session: PlanningSession, round: number): string  // Returns prompt
function approveRound(session: PlanningSession, round: number): void
function addFeedback(session: PlanningSession, round: number, feedback: string): void

// ============================================================
// EVENT HANDLING
// ============================================================
function handleEvent(event: OpenCodeEvent): Promise<void>

// ============================================================
// PLUGIN EXPORT
// ============================================================
export const PlanningPlugin: Plugin = async () => { /* ... */ }
export default PlanningPlugin
```

---

## 8. ROUND 2 SUMMARY

### What Changed From Round 1
1. **Scope clarified**: Per-feature sessions
2. **Prompts added**: Complete prompts for all 5 rounds
3. **Complexity reduced**: No enforcement mechanism
4. **Clarity improved**: Each round has clear purpose and output

### What I Need From You

1. Are the 5 round prompts clear and complete?
2. Do the prompts ask the right questions for your workflow?
3. Is any round missing critical content?
4. Should any round be split or combined?
5. Is the artifact output from each round what you need?

---

**Review this design. Provide feedback or say "approve round 2" to continue to Round 3.**
