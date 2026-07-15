# Advanced Developer Blueprint: Systems Architecture & Refactoring Guide

This document defines the production-grade architectural standards, design patterns, and modularization strategies for the **AGAP Portal**. Written for principal-level engineers, it details how to decompose the codebase into high-performance, decoupled, and transaction-safe domains.

---

## 🏛️ System Architecture Overview

The system transitions from a traditional monolithic monorepo setup to a strict **Layered Clean Architecture** combined with **Domain-Driven Design (DDD)** concepts.

```
                  ┌─────────────────────────────────────────┐
                  │              apps/web (UI)              │
                  │   Contexts ➔ Views ➔ Components ➔ Hooks  │
                  └────────────────────┬────────────────────┘
                                       │ (HTTPS / REST)
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │              apps/api (I/O)             │
                  │ Routers ➔ Controllers ➔ Services ➔ Repo  │
                  └────────────────────┬────────────────────┘
                                       │ (SQL / TX)
                                       ▼
                  ┌─────────────────────────────────────────┐
                  │           PostgreSQL Database           │
                  │   Tables ➔ Indexes ➔ Locking / TXs      │
                  └─────────────────────────────────────────┘
```

---

## ⚛️ Frontend Architecture: Modular React Refactoring (`apps/web`)

The main objective is to refactor `App.jsx` from a 5,000-line monolithic file into modular sub-modules while maintaining state integrity and render efficiency.

### 1. Unified State & Context Providers (`src/context`)
Cross-cutting concerns (authentication, active user session, global notification toasts) must be isolated from layouts and view components.
*   **`AuthContext.jsx`**: Handles token lifecycle, login/logout logic, and role-based permissions.
*   **`ToastContext.jsx`**: Exposes a hook-based API (`useToast()`) to trigger alerts from any component layer without prop drilling.

### 2. Domain Partitioning (`src/features`)
Group components, custom hooks, and business logic into self-contained domain directories:
*   **`/features/vacancies`**: Handles vacancy tables, calendar schedule setups, and the character-by-character NOSCA scanner.
*   **`/features/applications`**: Contains initial evaluations, checklists, and evaluation state management.
*   **`/features/assessment`**: Contains assessment score inputs, comparative evaluation formulas, and ranking ledgers.

### 3. Separation of Concerns inside Components
Each feature module must separate pure layout markup from data fetching and logic:
1.  **Views (`*View.jsx`)**: Container components that connect to context providers and load data.
2.  **Logic Components (`*Table.jsx`, `*Modal.jsx`)**: Presentational layout blocks receiving clean props.
3.  **Hooks (`hooks/use*.js`)**: State management, calculation logic, and API calls abstracted into functional hooks.

---

## ⚙️ Backend Architecture: Modular Node/Express Refactoring (`apps/api`)

Decompose `server.js` into separated layers: **Routers**, **Controllers**, and **Services**.

### 1. Layered Architecture Pattern
*   **Routing Layer (`*.router.js`)**: Matches incoming REST endpoints, parses request objects, and delegates execution to controllers. Attaches `authenticateToken` middleware.
*   **Controller Layer (`*.controller.js`)**: Extract properties from `req.body` or `req.params`, handle basic HTTP validation, delegate complex workflows to Services, and write the JSON response.
*   **Service Layer (`*.service.js`)**: Encapsulates core business rules (e.g. computing candidate fit scores, parsing scanner output).
*   **Repository Layer (`*.repository.js`)**: Direct interface with the PostgreSQL pool. Isolates raw SQL queries from business services.

### 2. Advanced Concurrency & Transaction Control (Race Conditions)
During bulk NOSCA imports or school assignments, multiple HRMO officers may trigger concurrent operations. To enforce strict allocation limits and prevent double-allocations:
*   **Row-Level Locking**: Services must lock the parent record inside a transaction before checking caps:
    ```sql
    BEGIN;
    SELECT allocated_slots, total_limit 
    FROM division_allocations 
    WHERE division = $1 
    FOR UPDATE; -- Locks the row until the transaction commits or rolls back.
    
    -- Perform math checks in the service layer...
    
    INSERT INTO vacancies (...);
    UPDATE division_allocations SET allocated_slots = allocated_slots + 1 WHERE division = $1;
    COMMIT;
    ```

---

## 📦 Monorepo Workspace Boundaries

Maintain strict directory separation using npm/yarn workspaces to ensure compile-time isolation:

1.  **`packages/shared`**: Contains domain-agnostic computations (such as candidate fit calculators, title-casing formatters, and status definitions) shared by both frontend and backend. It must contain no database-specific dependencies.
2.  **`apps/web` & `apps/api`**: Must depend on `@agap/shared` via the workspace link. Do not import raw files between different apps.
