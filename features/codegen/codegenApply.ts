import { CodeGenCommand, CommandType, UpdateMethodCodeCommand } from './codegenCommands';
import { CodeAspectType, CodeMethodData } from '@/store/codebase.types';
import { useCodebaseStore, createCodeMethod } from '@/store/useCodebaseStore';
import { AspectState } from '@/store/codebase.types';

/**
 * Walks through an array of commands from the code-generation backend and
 * applies them sequentially to the Zustand store.
 */
export function applyCodegenCommands(initialCmds: CodeGenCommand[]) {
  console.log(`[DEBUG] Applying ${initialCmds.length} commands to the store (FIFO queue).`);
  // FIFO queue for commands
  const queue: CodeGenCommand[] = [...initialCmds];

  while (queue.length > 0) {
    const cmd = queue.shift()!; // Remove from front
    const store = useCodebaseStore.getState();

    // Helper: If a command wants to enqueue further commands, it can push to 'queue'
    const enqueue = (cmds: CodeGenCommand[] | CodeGenCommand | undefined) => {
      if (!cmds) return;
      if (Array.isArray(cmds)) queue.push(...cmds);
      else queue.push(cmds);
    };

    switch (cmd.type) {
      case CommandType.CREATE_METHOD: {
        store.addCodeMethod();
        // Retrieve fresh state (after mutation) and its helpers
        const updatedStore = useCodebaseStore.getState();
        const newIndex = updatedStore.codeMethods.length - 1;
        const newMethod = createCodeMethod(cmd.method);
        updatedStore.updateCodeMethod(newIndex, newMethod);
        // Example: enqueue further commands if needed
        // enqueue(cmdsToEnqueue);
        break;
      }

      case CommandType.UPDATE_ASPECT: {
        const methodIndex = store.codeMethods.findIndex(
          (m) => m.identifier.descriptor === cmd.methodName
        );
        if (methodIndex === -1) {
          console.warn('Could not find method to update:', cmd.methodName);
          break;
        }
        store.updateCodeMethod(methodIndex, {
          [cmd.aspect]: { descriptor: cmd.value, state: AspectState.AUTOGEN },
        });

        // If the updated aspect is the implementation, scan for new function references
        if (cmd.aspect === CodeAspectType.IMPLEMENTATION) {
          const fnRegex = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
          const referencedFns: Set<string> = new Set();
          let match: RegExpExecArray | null;
          while ((match = fnRegex.exec(cmd.value)) !== null) {
            referencedFns.add(match[1]);
          }

          referencedFns.forEach((fnName) => {
            // Check if method already exists in store
            const exists = store.codeMethods.some((m) =>
              m.identifier.descriptor.startsWith(fnName)
            );
            if (!exists) {
              const newMethod: CodeMethodData = {
                identifier: { descriptor: fnName, state: AspectState.AUTOGEN },
                signature: { descriptor: '', state: AspectState.UNSET },
                specification: { descriptor: '', state: AspectState.UNSET },
                implementation: { descriptor: '', state: AspectState.UNSET },
                code: '',
              };

              enqueue({
                type: CommandType.CREATE_METHOD,
                className: cmd.className,
                method: newMethod,
              });
            }
          });
        }
        break;
      }

      case CommandType.DELETE_METHOD: {
        const methodIndex = store.codeMethods.findIndex(
          (m) => m.identifier.descriptor === cmd.methodName
        );
        if (methodIndex === -1) {
          console.warn('Could not find method to delete:', cmd.methodName);
          break;
        }
        store.removeCodeMethod(methodIndex);
        // enqueue(...)
        break;
      }

      case CommandType.UPDATE_METHOD_CODE: {
        const methodIndex = store.codeMethods.findIndex(
          (m) => m.identifier.descriptor === cmd.methodName
        );
        if (methodIndex === -1) {
          console.warn('Could not find method to update code for:', cmd.methodName);
          break;
        }
        store.updateCodeMethod(methodIndex, { code: cmd.value });
        // enqueue(...)
        break;
      }

      default: {
        const _exhaustiveCheck: never = cmd;
        console.warn('Unhandled command:', _exhaustiveCheck);
      }
    }
  }
}

