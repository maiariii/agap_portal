# AGAP Portal — Workspace AI Rules & Function Preservation Guardrail

This document defines the strict, persistent rules and guardrails for any AI agent operating in this repository (`agap_portal`). The primary directive is to **prevent the accidental removal, breaking, or regression of existing functions, business logic, endpoints, and UI capabilities.**

---

## 🛡️ Core Directive: Zero-Regression & Function Preservation

Every agent operating in this codebase MUST adhere to the **Non-Destructive Engineering Protocol**:

1. **Never Blindly Overwrite or Replace Whole Files**
   - Do NOT rewrite entire files from scratch when only adding or adjusting a feature.
   - Use surgical, targeted chunk replacements (`replace_file_content` / `multi_replace_file_content`).
   - Preserve all untouched functions, imports, helper utilities, comments, edge-case handlers, and error boundaries.

2. **Mandatory Pre-Change System & Impact Analysis**
   Before modifying any file (frontend component, backend controller, route, service, or database script), you MUST:
   - **Inventory Existing Functions**: Read and list every function, hook, state, endpoint, and prop in the target file.
   - **Trace Callers & Dependents**: Search the repository (using grep search) for all references, imports, and API callers to ensure changes won't break upstream or downstream modules.
   - **Identify Invariants**: Explicitly identify the core behaviors that MUST NOT change (e.g., specific status transitions, audit log recording, response structures, modal states).

3. **Additive Over Destructive Design**
   - When introducing new logic or fields, **extend** existing functions, objects, and API response payloads rather than modifying or deleting existing properties.
   - Maintain backward compatibility for all API parameters, return types, component props, and database column names.

4. **UI & Component Feature Retention**
   - Never remove existing buttons, tabs, modal triggers, pagination, filters, export actions, or error banners unless the user explicitly requested their removal in writing.
   - When modernizing or restructuring a UI component, all existing sub-components, dialogs, and actions must be faithfully migrated and retained.

5. **Post-Change Verification Protocol**
   - After any edit, review `git diff` against the original file to verify:
     - [ ] Are all previously existing functions and exports still present?
     - [ ] Are all parameter signatures and returned data formats intact?
     - [ ] Are all routes and endpoint handlers still registered and operational?
     - [ ] Was any error handling, validation, or authentication check removed?

---

## 📋 Standard 4-Step Analysis Framework for AI Tasks

Whenever the user asks for a new feature, refactoring, or bug fix, follow this 4-step framework:

```
[Step 1: Inventory] -> Read target file & list all existing functions/features
[Step 2: Trace]     -> Grep codebase for all usages, callers, and API consumers
[Step 3: Plan]      -> Plan non-destructive changes preserving all existing behavior
[Step 4: Verify]    -> Check diff to ensure 0 existing functions were lost
```

For detailed guidance, checklists, and evaluation templates, refer to [SYSTEM_ANALYSIS_GUARDRAIL.md](file:///e:/christop/agap_portal/SYSTEM_ANALYSIS_GUARDRAIL.md).
