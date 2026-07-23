# Development Conventions: Clean Code & Responsive Design

This document defines the coding standards, interface design philosophies, and architectural best practices to keep the **AGAP Portal** codebase clean, scalable, and responsive.

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

## ⚛️ React-Specific Code Standards

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

## ⚙️ Backend-Specific Code Standards

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

---

## 📱 Responsive Design Guidelines & Layout Philosophy

### Fluidity Over Rigidity
*   **Timeless Rule**: Never design for a single screen size. Web layouts must be fluid.
*   **Percentages and Relative Units**: Prefer relative units (`%`, `vh`, `vw`, `em`, `rem`, `ch`) over hardcoded pixel heights and widths (`px`). 
*   **Min/Max Constraints**: Always anchor fluid widths with safety boundaries:
    ```css
    .card {
      width: 100%;
      max-width: 600px;
      min-width: 280px;
    }
    ```

### Progressive Enhancement & Mobile-First
*   Start with a single-column, screen-agnostic layout.
*   Enhance the layout for larger viewports using media queries. This guarantees readability on screen readers, smartwatch browsers, and low-end devices first.

### Modern CSS Layout Strategies
*   **Flexbox (1-Dimensional Layouts)**: Use Flexbox for rows, columns, toolbars, and aligned lists.
    ```css
    .toolbar {
      display: flex;
      flex-wrap: wrap; /* Prevent overflow on narrow viewports */
      gap: 12px;
      align-items: center;
      justify-content: space-between;
    }
    ```
*   **CSS Grid (2-Dimensional Layouts)**: Use Grid for page dashboards, control panels, and auto-sizing cards. Avoid hardcoding column numbers. Use `auto-fit` or `auto-fill` with `minmax()`:
    ```css
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
    ```
*   **Container Queries (Component-Level Responsiveness)**: Allow components to adapt to the space *actually available to them* inside their parents:
    ```css
    .sidebar-card-wrapper {
      container-type: inline-size;
      container-name: card-container;
    }
    @container card-container (max-width: 350px) {
      .card-inner {
        flex-direction: column;
        padding: 8px;
      }
    }
    ```

### Fluid Typography & Spacing
*   Use `clamp()` to scale typography smoothly:
    ```css
    h1 {
      font-size: clamp(1.75rem, 4vw + 1rem, 3rem);
      line-height: 1.2;
    }
    ```
*   Use `rem` for typography, margin, and padding to respect user font preferences.
*   Use `em` for local padding inside buttons or badges so they scale proportionally.

### The Responsive Checklist
1.  **Touch Targets**: Interactive buttons and links must be at least `44px` by `44px`.
2.  **Prevent Horizontal Scroll**: Resolve overflow issues rather than applying `overflow-x: hidden`.
3.  **Flexible Media**: Scale images/videos with `max-width: 100%; height: auto;`.
4.  **Table Wraps**: Wrap wide tables in an `overflow-x: auto` container.
