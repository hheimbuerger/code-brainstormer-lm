import { CodeGenCommand, CommandType } from './codegenCommands';
import { CodeAspectType, CodeMethodData } from '@/store/codebase.types';
import { useCodebaseStore, createCodeMethod } from '@/store/useCodebaseStore';
import { AspectState } from '@/store/codebase.types';
import { packageCodebaseState, PackagedCodeMethod } from './codegenPackaging';
import { invokeCodeGen } from '@/app/actions/codegen';
import { CodegenTrigger } from './codegenBackend';

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

// Defines the progression of aspects for code generation.
const ASPECT_PROGRESSION = [
  CodeAspectType.IDENTIFIER,
  CodeAspectType.SIGNATURE,
  CodeAspectType.SPECIFICATION,
  CodeAspectType.IMPLEMENTATION,
];

/**
 * Determines which aspects should be generated based on the edited aspect and the current state of the method.
 * Returns the sequence of aspects from the edited one down to the first locked aspect.
 * 
 * @param editedAspect - The aspect that was just edited
 * @param method - The current method state
 * @returns Array of CodeAspectType values that should be generated
 */
function calculateAspectsToGenerate(
  editedAspect: CodeAspectType,
  method: PackagedCodeMethod
): CodeAspectType[] {
  const editedIndex = ASPECT_PROGRESSION.indexOf(editedAspect);
  if (editedIndex === -1) {
    console.warn('Unknown aspect type:', editedAspect);
    return [];
  }

  const aspectsToGenerate: CodeAspectType[] = [];
  
  // Start from the aspect after the edited one
  for (let i = editedIndex + 1; i < ASPECT_PROGRESSION.length; i++) {
    const aspectType = ASPECT_PROGRESSION[i];
    const aspectState = method[aspectType].state;
    
    // If this aspect is locked, stop here
    if (aspectState === AspectState.LOCKED) {
      break;
    }
    
    // Add this aspect to the list to generate
    aspectsToGenerate.push(aspectType);
  }
  
  return aspectsToGenerate;
}

/**
 * Helper function to invoke code generation for a specific method and aspect.
 * Packages the current codebase state and creates a trigger for the backend.
 * 
 * @param methodIndex - Index of the method in the codebase state
 * @param field - The aspect field being updated (e.g., 'implementation', 'specification')
 * @returns Promise resolving to an array of CodeGenCommand objects
 */
export async function invokeCodegenForMethod(
  methodIndex: number,
  field: string
): Promise<CodeGenCommand[]> {
  console.log(
    `[DEBUG] Codegen invoked for method index ${methodIndex}, field ${field}`,
  );
  const codebaseState = useCodebaseStore.getState();

  // Marshall the codebase state on the client
  const packagedState = packageCodebaseState(codebaseState);
  console.log('[DEBUG] Codebase state has been packaged.');

  const triggeredMethod = packagedState.functions[methodIndex];

  if (!triggeredMethod) {
    console.warn('Could not find triggered method for codegen');
    return [];
  }

  // Calculate which aspects should be generated
  const aspectsToGenerate = calculateAspectsToGenerate(
    field as CodeAspectType,
    triggeredMethod
  );

  // Create the trigger object on the client
  const trigger: CodegenTrigger = {
    method: triggeredMethod,
    aspect: field as CodeAspectType,
    aspectsToGenerate,
  };

  // This now calls the server action with the packaged state and trigger
  return invokeCodeGen(packagedState, trigger);
}

