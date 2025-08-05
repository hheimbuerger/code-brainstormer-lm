# Code-Brainstormer LM – Data & State Architecture

## 1. Design Goals
* Separate immutable/core **domain data** from transient **UI state** for clarity, testability and performance.
* Keep React-Flow highly responsive by letting it own `nodes` and `edges`, updating Zustand **only on committed user actions** (e.g. pressing Enter or finishing a drag).
* Provide a minimal, explicit bridge (`FlowNodeData`) between the two worlds.
* Support function-based structured programming model with editable project names.

## 2. Domain Layer (Zustand)
```
CodeAspect – atomic piece of info (descriptor, state, code)
CodeFunction – business object composed of 4 CodeAspects: identifier, signature, specification, implementation
CodebaseState – root store exposing:
  • projectName: string (editable project identifier)
  • codeFunctions: CodeFunction[] (array of functions)
  • CRUD actions: addCodeFunction, updateCodeFunction, updateProjectName, …
```
Key facts:
1. **No positional or visual data** is stored here.
2. `AspectState` tracks lifecycle (`unset ▸ autogen ▸ edited ▸ locked`).
3. All write helpers normalise partial inputs via factory fns (`createCodeAspect`, `createCodeFunction`).
4. **Function-based model** replaces the old class-based approach for structured programming.

## 3. UI Layer (React-Flow)
```
Node.id     = "method-{index}"
Node.data   = { methodIndex: number }  // -> FlowNodeData
Edge        = standard RF edge (smoothstep, animated=false)
```
Behaviour:
* Nodes are generated once per render from `codeFunctions` with a simple **stable mapping**: `methodIndex === array index`.
* Initial x-position is `250 px * index`, giving a left-to-right lane with no overlap.
* **Edges are generated dynamically** by scanning each function's `implementation.descriptor` for inline function-call strings (e.g. `formatText(...)`). For every detected call an edge is created from the calling node to the target node whose identifier starts with the function name. Handles (`sourceHandle`) are suffixed with a stable counter (`{fnName}-{idx}`) to support multiple calls.

## 4. ProjectCanvas Architecture
The main UI component `ProjectCanvas` integrates:
* **Project Banner** - Displays and allows editing of the project name
* **Function Diagram** - React Flow canvas with function nodes and edges
* **Unified Layout** - Single component managing both banner and canvas areas

## 5. Data-Flow Lifecycle
1. **Initial load** – ProjectCanvas reads `codeFunctions` from the store and builds local `nodes` + `edges`.
2. **Project name editing** – Click-to-edit functionality updates `projectName` in store (no code generation triggered).
3. **Function editing** (inside `FunctionNode`)
   1. User edits any `EditableField`.
   2. On *save* (Enter/blur) `handleFieldChange` calls `updateCodeFunction(idx, patch)`.
   3. Zustand mutates the requested `CodeField` → React triggers re-render of that specific node via hook subscription.
4. **User dragging** – RF updates `nodes[i].position` locally; no store writes occur.
5. **Optional persistence** – The store exposes `saveGraph(nodes, edges)` (stub) if we later decide to persist layout.

## 6. Why This Matters
* **Performance** – Eliminate per-keystroke store traffic; RF remains 60 fps.
* **Single source of truth** – Domain data lives in one place; UI can be reset/re-layouted without corrupting data.
* **Low coupling** – Only the tiny `functionIndex` integer connects layers; future visual refactors won't touch domain models.
* **Unified UI** – ProjectCanvas integrates project management and function visualization in a single cohesive component.

## 7. Extending the Model
* Add new `CodeAspect`s to `CodeFunction` (e.g. examples, tests) – no RF changes required.
* Persist custom layouts by wiring `onNodesChange` / `onEdgesChange` to a new `saveGraph` implementation.
* Support multiple projects by extending the store with project switching capabilities.
* Add project-level metadata and configuration options.

## 8. Data Persistence
The system supports a unified JSON schema for both:
* **Sample data** – Minimal project structure for easy dataset switching
* **Full state persistence** – Complete UI state including node positions, viewport, and edges

See `data/projectSchema.ts` for the unified schema definition and `data/dataLoader.ts` for persistence logic.

---
_Last updated 2025-08-05 by Cascade assistant_
