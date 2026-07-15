# Clean Code Guidelines: Anti-Spaghetti Code Blueprint

This document defines the coding standards, patterns, and refactoring guidelines to prevent "spaghetti code" inside the **AGAP Portal** codebase. These principles keep the system scalable, readable, and highly maintainable.

---

## 🛡️ Core Clean Code Principles

### 1. The Single Responsibility Principle (SRP)
Every file, function, and component should have **one reason to change**.
*   **Bad**: A component that fetches data, formats dates, handles raw SQL, and renders the UI grid.
*   **Good**: Decomposed modules where data fetching resides in custom hooks, formatting resides in shared utility files, and the component only handles presentation layout.

### 2. Low Nesting & Early Returns (Guard Clauses)
Avoid deep nesting (`if-else` blocks) that makes code hard to read. Use **early returns** to handle error conditions or boundary cases first.
*   **Bad (Spaghetti)**:
    ```javascript
    const handleConfirmSchedule = async () => {
      if (calVacancy) {
        if (calStart) {
          if (calEnd) {
            // Complex save logic nested 4 levels deep...
          }
        }
      }
    };
    ```
*   **Good (Clean)**:
    ```javascript
    const handleConfirmSchedule = async () => {
      if (!calVacancy || !calStart || !calEnd) {
        return setToast({ message: 'Please input all values', type: 'error' });
      }
      // Success path on the base indentation level...
    };
    ```

---

## ⚛️ React-Specific Anti-Spaghetti Standards

### 1. Component Size Constraints
Keep components focused and compact:
*   **Max Size**: Aim for components under **250 lines**.
*   **Action**: If a component contains nested rendering loops (e.g. mapping checklists, rendering specific rows), extract them into isolated helper components (such as our `NOSCAItemEditor`).

### 2. State Decoupling
Avoid defining complex business or computational logic directly inside inline handlers.
*   **Bad**:
    ```javascript
    <button onClick={() => {
      const nextStage = getNextStage(app.status);
      updateBackend(nextStage).then(res => {
        setToken(res.token);
        setToast({ message: 'Success' });
      }).catch(e => setError(e));
    }}>Next</button>
    ```
*   **Good**: Extract the handler to a named function or custom hook:
      ```javascript
      const handleAdvancePipeline = async () => {
        try {
          await advanceCandidatePipeline(app.id);
          setToast({ message: 'Candidate advanced successfully', type: 'success' });
        } catch (err) {
          setToast({ message: err.message, type: 'error' });
        }
      };
      ```

### 3. Pure Renders: No State Mutations in Render Loops
Never trigger state changes or side effects directly in the render path, `useMemo`, or `useCallback`. This prevents infinite re-render loops.

---

## ⚙️ Backend-Specific Anti-Spaghetti Standards

### 1. Separate Routing from Logic
Express route definitions must be lightweight, delegating implementation to controllers:
*   **Bad**: Writing 80 lines of DB query logic directly inside `app.post('/api/route', async (req, res) => { ... })`.
*   **Good**:
    ```javascript
    // vacancies.router.js
    router.post('/import-nosca', authenticateToken, vacanciesController.importNosca);
    ```

### 2. Encapsulate Database Queries
Never write raw SQL queries scattered across route files. Keep SQL queries in **Services** or **Repositories**:
*   Define a central function `findVacancyById(id)` rather than copying the `SELECT * FROM vacancies WHERE id = $1` query across multiple endpoints.
*   Use parameter bindings (`$1`, `$2`) consistently to prevent SQL Injection vulnerability.

---

## 🚫 Elimination of Magic Strings & Numbers

Define shared configurations, enums, and pipeline stages in constant objects rather than hardcoding strings:
*   **Bad**: `if (app.status === 'qualified')`
*   **Good**: Use standard enums or shared configurations (e.g. `QUAL_PIPELINE` or `DOC_REQUIREMENTS`).
