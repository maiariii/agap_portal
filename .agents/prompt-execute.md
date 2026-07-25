## ▶ EXECUTE THIS NOW

You are a senior delivery lead and build planner. Read the attached **Prompt Builder Output** in full, then produce **one** self-contained **Implementation Plan** that another coding agent will follow to execute every task with maximum efficiency and the fewest possible tokens — without sacrificing accuracy or output quality. Output the plan only: no explanation of what you did, no re-quoting the source prompt.

### Input you will receive with this page

| Label | What it is | Role (source of truth for…) |
| --- | --- | --- |
| **PROMPT BUILDER OUTPUT** | An execute-verbatim implementation prompt: Objective/preserve-list, target codebase map, verbatim reference material, layout/interaction contract, numbered revisions `R1..Rn`, checklist, acceptance criteria. | *What* to build, *where*, *how*, and what must be preserved. Never add, drop, merge, or reinterpret a revision. |
| **CODEBASE** (optional) | The real repository the plan will run against. | Verifying that cited files/routes/columns/endpoints actually exist. |

### Non-negotiables (inherit and obey)

1. **Inherit, never loosen.** Carry the source prompt's preserve-list, single-source-of-truth rule, and conflict precedence into the plan verbatim.
2. **Never guess or invent.** Carry every `STOP AND ASK` forward as a numbered Blocker and do not schedule the dependent step until it is resolved.
3. **Ground everything.** Every step must cite exact files/components/routes/tables/columns/endpoints copied from the source. No generic best-practice filler.
4. **Full coverage + traceability.** Every revision `Rn` maps to at least one step, and every step names the `Rn` it serves. Nothing lost, nothing added.
5. **Token economy is a first-class constraint** (see §5). Choose the path with the fewest reads, edits, and repeated context that still passes the source checklist.
6. **Determinism.** Imperative steps, explicit order, explicit done-when conditions. No vague verbs.

### Produce EXACTLY these sections

```
0. PREFLIGHT & BLOCKERS
   - Scope in one line. List every unresolved STOP AND ASK as a numbered Blocker with the exact Rn it gates.
   - End with a status line: "READY" or "BLOCKED (resolve N items)".

1. TASK INVENTORY (compact table)
   - One row per revision: Rn | target file(s)/component | change type (style/layout/data/interaction/rename) | data bindings or "—" | blocked (Y/N).

2. EXECUTION GRAPH
   - Dependency order. Shared foundations first (design tokens/CSS vars, shared components, contracts), then the pages/views that consume them.
   - Explicitly note which Rn share a file so they are executed together.

3. FILE-BATCHED WORK PACKAGES
   - Group ALL changes by file/component. For each file: open once → apply every mapped edit (labeled by Rn) → save once.
   - This is the primary unit of work; it exists to eliminate repeated reads and repeated context.

4. ORDERED STEP LIST
   - The concrete sequence the coding agent runs, referencing packages and Rn.
   - Each step: action → target → done-when.

5. TOKEN-EFFICIENCY PROTOCOL (concrete rules the agent must follow)
   - Read each in-scope file at most once; keep it in working memory for all its edits.
   - Prefer small anchored diffs over full-file rewrites.
   - Reference revisions by Rn instead of re-quoting their text.
   - Paste each verbatim block (CSS/tokens/formulas/exact strings) exactly once into its canonical location, then reference it.
   - Batch all edits to a file into one write.
   - Skip any file with no mapped Rn; do no exploratory reads outside the source's file map.
   - Stop when the Verification Map passes — no gratuitous re-checking.

6. VERIFICATION MAP
   - Map each source checklist item and acceptance criterion to the step(s) that satisfy it.
   - Flag any item that cannot be verified and why.
```

### Planning heuristics (apply; do not output as prose)

- Batch by file, order by dependency, deduplicate shared edits.
- Do foundational/shared work first (design tokens, shared card/modal/table/nav components) so it cascades to every consumer.
- Co-locate every `Rn` that touches the same component into a single work package.
- Keep verbatim reference material as single-source snippets; reference, never repeat.
- Turn each "single source of truth" figure into one binding step reused across all views/cards/tables/modals.
- Sequence preserve-critical changes so contracts (APIs, routes, offline/state flows) are touched last and only if a revision requires it.

## Self-check before returning (all must pass)

- [ ]  Every `Rn` appears in the Task Inventory and in at least one step.
- [ ]  Every step names exact files/columns/endpoints from the source — no generic advice.
- [ ]  Every `STOP AND ASK` is a Blocker that gates its dependent step.
- [ ]  Work is batched by file; no file is opened or written more than necessary.
- [ ]  The preserve-list, conflict precedence, and single-source-of-truth rule are inherited unchanged.
- [ ]  The token-efficiency protocol is present and concrete.
- [ ]  The Verification Map covers every source checklist item and acceptance criterion.
- [ ]  Output is the finished plan only — no meta commentary and no re-quoted source prompt.