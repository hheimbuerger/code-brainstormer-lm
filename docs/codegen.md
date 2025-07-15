# Code-Generation Flow ("codegen" feature)

This document captures the **concept**, **principles**, and **call-flow** of the code-generation feature implemented in `features/codegen/`.  It is **implementation-agnostic**: focus is on *when* each function is invoked and *how* the pieces interact, not on their internal logic.

---

## 1. Guiding Principles

1. **Diagram-driven, command-based** – The LLM never returns raw source code to place directly in files.  Instead it sends *structured commands* (`CodeGenCommand[]`) that mutate the in-memory domain model (Zustand store).  
2. **Deterministic replay** – Commands are pure data; they can be validated, audited, replayed, or merged.  
3. **Lean prompts** – Before each round, the current model is *packaged* into a minimal JSON snapshot.  Only the data the LLM truly needs is sent.  
4. **Client ↔ Server split** – Packaging & application run on the client; code synthesis runs on the server (via a server action).  
5. **Future ready** – A mocked backend (`simulateCodeGeneration`) stands in for a real LLM service; swapping it out requires no front-end changes.

## 2. High-level Flow (chronological)

1. **User action** – e.g. *Generate Code* button click.  
2. **`packageCodebaseState`** (client) serialises the Zustand store → `PackagedCodebase`.  
3. **The client creates a `CodegenTrigger`** object describing the user's action (e.g. which method and aspect were edited).
4. **`invokeCodeGen` server action** is invoked with the `PackagedCodebase` and `CodegenTrigger`. *This runs on the server only.*
5. **Server action** delegates to **`callLLMCodeSynthesis`** (the mocked backend) which returns a list of commands (`CodeGenCommand[]`).
6. **`applyCodegenCommands`** (client) walks the returned array and mutates the store via its public mutators. React-Flow re-renders automatically.
6. **Shadow code** will later be regenerated from the updated store (out of scope for this phase).

A sequence diagram-style outline:

```
UI (client)
  │ click
  ▼
packageCodebaseState
  │ snapshot
  ▼             (network / server action)
invokeCodeGen  –––––––––––––––––▶  callLLMCodeSynthesis (server)
  │ ◀–––––––––––––––––– commands
  ▼
applyCodegenCommands
  │ store mutations
  ▼
React-Flow & UI update
```

## 3. Main Modules & Entry Points

| Responsibility | File | Public API | When Called | Runs On |
|----------------|------|-----------|-------------|---------|
| Snapshot current model | `features/codegen/codegenPackaging.ts` | `packageCodebaseState(state)` | Immediately before talking to the server | Client |
| Invoke backend | `app/actions/codegen.ts` | `invokeCodeGen(snapshot, trigger)` | Called by client; executes on server (server action) | Server |
| Mocked backend | `features/codegen/codegenBackend.ts` | `callLLMCodeSynthesis(snapshot)` | Only inside server action (temp) | Server |
| Command schema | `features/codegen/codegenCommands.ts` | `CommandType`, `CodeGenCommand`, etc. | Shared by all layers | Both |
| Apply commands | `features/codegen/codegenApply.ts` | `applyCodegenCommands(cmds)` | After server action returns | Client |

## 4. Command Taxonomy (overview)

`CommandType` enum currently contains:

* `create_method`
* `delete_method`
* `update_aspect` – mutate `identifier`, `signature`, `specification`, or `implementation`

Each command interface carries the minimal fields needed to execute the operation.  Extend the enum & payloads as new capabilities emerge.

## 5. Store Mutators Consumed

`applyCodegenCommands` relies on public functions exposed by `useCodebaseStore`:

* `addCodeMethod()`
* `updateCodeMethod(index, partial)`
* `removeCodeMethod(index)`
* `updateCodeClass(partial)`

Further mutators will be added as the command set grows (e.g. class renaming, external classes).

## 6. Current Limitations / TODOs

### Architectural Notes & Learnings

- **Server Actions vs. API Routes**: For internal client-server communication within a Next.js application, Server Actions are the preferred, more modern, and cleaner approach. They avoid the need for manual `fetch` or `axios` calls and boilerplate API route handlers. API Routes are better suited for public-facing endpoints intended for third-party consumption.

- **Client-Side Marshalling**: Because the backend is stateless, the client is responsible for preparing all necessary data before calling the server. The `packageCodebaseState` function serves this purpose, creating a clean, serializable representation of the state. This is more performant than sending the entire raw store object over the network.

- **Client-Side Trigger Creation**: The client has the most immediate context about a user's action (e.g., which UI element was edited). Therefore, it is the client's responsibility to construct the `CodegenTrigger` object. This keeps the server action's signature clean and its logic focused on orchestration rather than data transformation.

- **Separation of Concerns**: The final architecture maintains a clean separation of responsibilities:
  - **Client Component (`MethodNode.tsx`)**: Handles UI, captures edits, packages state, creates the trigger, calls the server action, and applies the results.
  - **Server Action (`app/actions/codegen.ts`)**: Acts as a thin network layer, receiving pre-packaged data and passing it to the core backend logic.
  - **Core Backend (`features/codegen/codegenBackend.ts`)**: Contains the pure `callLLMCodeSynthesis` logic, completely decoupled from the client or network.
  - **Client Unmarshalling (`features/codegen/codegenApply.ts`)**: Logic for applying commands is kept on the client as it is tightly coupled to the client's state management library (Zustand).

### Current Limitations / TODOs

* **Mock backend** – `callLLMCodeSynthesis` returns hard-coded examples. Replace with a real LLM call.  
* **Snapshot richness** – `packageCodebaseState` may need to include edges, aspect states, etc.  
* **Shadow-code emission** – After store mutations, regenerate TypeScript files (future work).

---

_Last updated: 2025-07-15_
