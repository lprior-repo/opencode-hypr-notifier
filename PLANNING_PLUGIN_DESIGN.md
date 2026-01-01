# Planning Plugin Design Document

## Version: Round 1 - Initial Architecture

---

## 1. VISION & PURPOSE

### Problem Statement
AI assistants often jump directly into implementation without adequate planning. This leads to:
- Incomplete designs that require rework
- Missed edge cases discovered late
- User frustration from half-baked solutions
- Wasted effort on wrong approaches

### Solution
A **Planning Plugin** that:
1. Forces structured iteration through design phases
2. Requires explicit user approval at each stage
3. Tracks planning progress persistently
4. Sends notifications for planning milestones
5. Prevents implementation until design is "approved"

---

## 2. CORE CONCEPT: PLANNING ROUNDS

### The 5-Round Framework

| Round | Name | Focus | Exit Criteria |
|-------|------|-------|---------------|
| 1 | **Discovery** | Understand requirements, explore constraints | User confirms understanding |
| 2 | **Architecture** | High-level design, component breakdown | User approves structure |
| 3 | **Specification** | Detailed interfaces, data flows, APIs | User validates details |
| 4 | **Edge Cases** | Failure modes, error handling, security | User accepts risk assessment |
| 5 | **Finalization** | Implementation plan, test strategy | User authorizes implementation |

### Round Progression Rules
- Cannot skip rounds
- Must receive explicit "approve" to advance
- Can regress to earlier rounds if issues found
- Each round builds on previous approvals

---

## 3. PLUGIN ARCHITECTURE

### 3.1 Event Types (Emitted by Plugin)

```typescript
type PlanningEvent =
  | { type: "planning.round.started"; properties: { round: number; name: string; sessionId: string } }
  | { type: "planning.round.completed"; properties: { round: number; approved: boolean; sessionId: string } }
  | { type: "planning.feedback.requested"; properties: { round: number; question: string; sessionId: string } }
  | { type: "planning.approved"; properties: { totalRounds: number; sessionId: string } }
  | { type: "planning.regressed"; properties: { fromRound: number; toRound: number; reason: string; sessionId: string } }
```

### 3.2 Event Types (Consumed by Plugin)

```typescript
type UserFeedbackEvent =
  | { type: "user.planning.approve"; properties: { round: number; sessionId: string } }
  | { type: "user.planning.reject"; properties: { round: number; feedback: string; sessionId: string } }
  | { type: "user.planning.regress"; properties: { toRound: number; reason: string; sessionId: string } }
```

### 3.3 State Management

```typescript
type PlanningState = Readonly<{
  sessionId: string
  currentRound: number
  roundHistory: ReadonlyArray<RoundRecord>
  status: "planning" | "approved" | "implementing"
  createdAt: number
  updatedAt: number
}>

type RoundRecord = Readonly<{
  round: number
  name: string
  startedAt: number
  completedAt: number | null
  approved: boolean
  feedback: string[]
  artifacts: string[]  // References to design docs
}>
```

### 3.4 Persistent Storage

```
~/.config/opencode/planning-sessions/
├── {sessionId}.json           # Current session state
├── {sessionId}.history.json   # Full conversation history for session
└── templates/
    ├── discovery.md
    ├── architecture.md
    ├── specification.md
    ├── edge-cases.md
    └── finalization.md
```

---

## 4. NOTIFICATION INTEGRATION

### 4.1 Notification Events

| Event | Urgency | Icon | Message |
|-------|---------|------|---------|
| Round Started | normal | `dialog-information` | "Planning Round {n}: {name}" |
| Feedback Requested | critical | `dialog-question` | "Input needed for Round {n}" |
| Round Approved | low | `emblem-ok` | "Round {n} approved!" |
| Planning Complete | normal | `emblem-default` | "All 5 rounds approved - Ready to implement" |
| Regression | normal | `dialog-warning` | "Regressed to Round {n}" |

### 4.2 Integration with hypr-notifier

The planning plugin will emit events that `hypr-notifier` can consume:

```typescript
// In planning-plugin.ts
async function emitPlanningEvent(event: PlanningEvent): Promise<void> {
  // Emit to OpenCode event system
  // hypr-notifier will pick this up
}
```

---

## 5. USER INTERACTION MODEL

### 5.1 Starting a Planning Session

```
User: "I want to add authentication to my app"

AI: "This is a significant feature. Starting Planning Mode.

📋 ROUND 1: DISCOVERY

Let me understand your requirements:

1. What authentication methods do you need? (password, OAuth, SSO, etc.)
2. What's your current user model?
3. Are there existing auth patterns in your codebase?
4. What's your security posture? (2FA, session management?)

[Notification: Planning Round 1: Discovery]"
```

### 5.2 Round Approval Flow

```
User: "Looks good, approve round 1"

AI: "✅ Round 1 APPROVED

Moving to ROUND 2: ARCHITECTURE

Based on your requirements, I propose:
[... architectural design ...]

Do you approve this architecture?

[Notification: Planning Round 2: Architecture]"
```

### 5.3 Rejection/Iteration

```
User: "No, I don't want OAuth, just email/password"

AI: "📝 Noted. Updating Round 2 design...

[Updated architecture without OAuth]

Do you approve this revised architecture?

[Notification: Feedback incorporated - Round 2 updated]"
```

---

## 6. CONFIGURATION

### 6.1 Config File

`~/.config/opencode/opencode-planning.json`

```json
{
  "notification": true,
  "strictMode": true,
  "requiredRounds": 5,
  "allowSkipRounds": false,
  "persistSessions": true,
  "sessionTimeout": 86400000,
  "templates": {
    "discovery": "default",
    "architecture": "default",
    "specification": "default",
    "edgeCases": "default",
    "finalization": "default"
  },
  "urgency": {
    "roundStart": "normal",
    "feedbackRequest": "critical",
    "approval": "low",
    "complete": "normal"
  }
}
```

### 6.2 Template System

Each round has a template that guides the AI's questions:

```markdown
<!-- templates/discovery.md -->
# Discovery Round Template

## Required Questions
1. What problem are you solving?
2. Who are the users/stakeholders?
3. What are the constraints (time, tech, resources)?
4. What does success look like?
5. Are there existing patterns to follow?

## Artifacts to Produce
- [ ] Problem statement
- [ ] User stories
- [ ] Constraint list
- [ ] Success criteria
```

---

## 7. IMPLEMENTATION STRUCTURE

### 7.1 Single-File Architecture (Required by OpenCode)

```typescript
// src/planning-plugin.ts (~500 lines estimated)

// ============================================================
// SECTION 1: TYPES (50 lines)
// ============================================================

// ============================================================
// SECTION 2: CONSTANTS (80 lines)
// ============================================================

// ============================================================
// SECTION 3: STATE MANAGEMENT (100 lines)
// ============================================================

// ============================================================
// SECTION 4: PERSISTENCE (80 lines)
// ============================================================

// ============================================================
// SECTION 5: ROUND HANDLERS (120 lines)
// ============================================================

// ============================================================
// SECTION 6: EVENT PROCESSING (70 lines)
// ============================================================

// ============================================================
// SECTION 7: PLUGIN EXPORT (20 lines)
// ============================================================
```

---

## 8. OPEN QUESTIONS (Round 1)

1. **Session Scope**: Should planning sessions be per-feature or per-conversation?
2. **Multi-Feature**: Can multiple features be planned in parallel?
3. **AI Enforcement**: How does the plugin actually "block" implementation?
4. **Event Source**: Does OpenCode emit events we can intercept, or do we need a different mechanism?
5. **Template Customization**: Should users be able to define custom rounds?
6. **Integration**: How does this integrate with the existing hypr-notifier?

---

## 9. RISKS IDENTIFIED

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenCode may not support event interception | High | Research OpenCode event model |
| Single-file constraint limits complexity | Medium | Careful code organization |
| User fatigue from too many rounds | Medium | Make rounds efficient, allow fast-track |
| State persistence across sessions | Medium | Robust file handling |

---

## ROUND 1 STATUS: AWAITING FEEDBACK

Please review this initial architecture and provide feedback:

1. Does this vision align with what you want?
2. Are the 5 rounds appropriately named/scoped?
3. Is the notification integration approach correct?
4. Any features you want added or removed?
5. Concerns about the implementation approach?

**To proceed**: Reply with your feedback or "approve round 1"
