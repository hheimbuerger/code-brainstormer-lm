# Code-Brainstormer LM – Data & State Architecture

## 1. Design Goals
* Separate immutable/core **domain data** from transient **UI state** for clarity, testability and performance.
* Keep React-Flow highly responsive by letting it own `nodes` and `edges`, updating Zustand **only on committed user actions** (e.g. pressing Enter or finishing a drag).
* Provide a minimal, explicit bridge (`FlowNodeData`) between the two worlds.

## 2. Domain Layer (Zustand)
```
CodeField   – atomic piece of info (descriptor, state, code)
CodeMethod  – business object composed of 4 CodeFields
CodeClass   – single CodeField holding the class headline
CodebaseState – root store exposing:
  • codeClass / codeMethods / externalClasses
  • CRUD actions: addCodeMethod, updateCodeMethod, …
```
Key facts:
1. **No positional or visual data** is stored here.
2. `AspectState` tracks lifecycle (`unset ▸ autogen ▸ edited ▸ locked`).
3. All write helpers normalise partial inputs via factory fns (`createCodeField`, `createCodeMethod`).

## 3. UI Layer (React-Flow)
```
Node.id     = "method-{index}"
Node.data   = { methodIndex: number }  // -> FlowNodeData
Edge        = standard RF edge (smoothstep, animated=false)
```
Behaviour:
* Nodes are generated once per render from `codeMethods` with a simple **stable mapping**: `methodIndex === array index`.
* Initial x-position is `250 px * index`, giving a left-to-right lane with no overlap.
* A demo edge (`method-0 → method-1`) is auto-created when ≥2 methods exist.

## 4. Data-Flow Lifecycle
1. **Initial load** – FlowDiagram reads `codeMethods` from the store and builds local `nodes` + `edges`.
2. **User editing** (inside `CustomNode`)
   1. User edits any `EditableField`.
   2. On *save* (Enter/blur) `handleFieldChange` calls `updateCodeMethod(idx, patch)`.
   3. Zustand mutates the requested `CodeField` → React triggers re-render of that specific node via hook subscription.
3. **User dragging** – RF updates `nodes[i].position` locally; no store writes occur.
4. **Optional persistence** – The store exposes `saveGraph(nodes, edges)` (stub) if we later decide to persist layout.

## 5. Why This Matters
* **Performance** – Eliminate per-keystroke store traffic; RF remains 60 fps.
* **Single source of truth** – Domain data lives in one place; UI can be reset/re-layouted without corrupting data.
* **Low coupling** – Only the tiny `methodIndex` integer connects layers; future visual refactors won’t touch domain models.

## 6. Extending the Model
* Add new `CodeField`s to `CodeMethod` (e.g. examples, tests) – no RF changes required.
* Persist custom layouts by wiring `onNodesChange` / `onEdgesChange` to a new `saveGraph` implementation.
* Support multiple diagrams by namespacing `nodes` per class and mapping `Node.data` accordingly.

---
_Last updated 2025-06-25 by Cascade assistant_
