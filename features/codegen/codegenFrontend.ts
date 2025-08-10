import { CodeGenCommand, CommandType } from './codegenCommands';
import { CodeAspectType, CodeFunctionData } from '@/store/codebase.types';
import { useCodebaseStore, createCodeFunction } from '@/store/useCodebaseStore';
import { AspectState } from '@/store/codebase.types';
import { packageCodebaseState } from './codegenPackaging';
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
        store.addCodeFunction();
        // Retrieve fresh state (after mutation) and its helpers
        const updatedStore = useCodebaseStore.getState();
        const newIndex = updatedStore.codeFunctions.length - 1;
        const newFunction = createCodeFunction(cmd.method);
        updatedStore.updateCodeFunction(newIndex, newFunction);
        // Example: enqueue further commands if needed
        // enqueue(cmdsToEnqueue);
        break;
      }

      case CommandType.UPDATE_ASPECT: {
        const functionIndex = store.codeFunctions.findIndex(
          (f) => f.identifier.descriptor === cmd.methodName
        );
        if (functionIndex === -1) {
          console.warn('Could not find function to update:', cmd.methodName);
          break;
        }
        store.updateCodeFunction(functionIndex, {
          [cmd.aspect]: { descriptor: cmd.value, state: AspectState.AUTOGEN },
        });

        // Note: Automatic function creation has been removed.
        // Functions are now created manually via double-click on function references.
        break;
      }

      case CommandType.DELETE_METHOD: {
        const methodIndex = store.codeFunctions.findIndex(
          (m) => m.identifier.descriptor === cmd.methodName
        );
        if (methodIndex === -1) {
          console.warn('Could not find method to delete:', cmd.methodName);
          break;
        }
        store.removeCodeFunction(methodIndex);
        // enqueue(...)
        break;
      }

      case CommandType.UPDATE_METHOD_CODE: {
        const methodIndex = store.codeFunctions.findIndex(
          (m) => m.identifier.descriptor === cmd.methodName
        );
        if (methodIndex === -1) {
          console.warn('Could not find method to update code for:', cmd.methodName);
          break;
        }
        store.updateCodeFunction(methodIndex, { code: cmd.value });
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
 * Interface for function objects that can be used with calculateAspectsToGenerate.
 * Both CodeFunction and PackagedCodeFunction satisfy this interface.
 */
interface FunctionWithAspects {
  identifier: { descriptor: string; state: AspectState };
  signature: { descriptor: string; state: AspectState };
  specification: { descriptor: string; state: AspectState };
  implementation: { descriptor: string; state: AspectState };
}

/**
 * Determines which aspects should be generated based on the edited aspect and the current state of the function.
 * Returns the sequence of aspects from the edited one down to the first locked aspect.
 * 
 * @param editedAspect - The aspect that was just edited
 * @param func - The current function state (CodeFunction or PackagedCodeFunction)
 * @param includeEditedAspect - Whether to include the edited aspect itself (true for reroll, false for normal edit)
 * @returns Array of CodeAspectType values that should be generated
 */
export function calculateAspectsToGenerate(
  editedAspect: CodeAspectType,
  func: FunctionWithAspects,
  includeEditedAspect: boolean = false
): CodeAspectType[] {
  const editedIndex = ASPECT_PROGRESSION.indexOf(editedAspect);
  if (editedIndex === -1) {
    console.warn('Unknown aspect type:', editedAspect);
    return [];
  }

  const aspectsToGenerate: CodeAspectType[] = [];
  
  // Start from the edited aspect (for reroll) or the aspect after it (for normal edit)
  const startIndex = includeEditedAspect ? editedIndex : editedIndex + 1;
  
  for (let i = startIndex; i < ASPECT_PROGRESSION.length; i++) {
    const aspectType = ASPECT_PROGRESSION[i];
    const aspectState = func[aspectType].state;
    
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
 * Helper function to invoke code generation for a specific function and aspect.
 * Packages the current codebase state and creates a trigger for the backend.
 * 
 * @param functionIndex - Index of the function in the codebase state
 * @param field - The aspect field being updated (e.g., 'implementation', 'specification')
 * @returns Promise resolving to an array of CodeGenCommand objects
 */
export async function invokeCodegenForFunction(
  functionIndex: number,
  field: string
): Promise<CodeGenCommand[]> {
  console.log(
    `[DEBUG] Codegen invoked for function index ${functionIndex}, field ${field}`,
  );
  const codebaseState = useCodebaseStore.getState();

  // Marshall the codebase state on the client
  const packagedState = packageCodebaseState(codebaseState);
  console.log('[DEBUG] Codebase state has been packaged.');

  const triggeredFunction = packagedState.functions[functionIndex];

  if (!triggeredFunction) {
    console.warn('Could not find triggered function for codegen');
    return [];
  }

  // Calculate which aspects should be generated
  const aspectsToGenerate = calculateAspectsToGenerate(
    field as CodeAspectType,
    triggeredFunction
  );

  // Create the trigger object on the client
  const trigger: CodegenTrigger = {
    modifiedFunction: triggeredFunction,
    modifiedAspect: field as CodeAspectType,
    aspectsToGenerate,
  };

  // This now calls the server action with the packaged state and trigger
  return invokeCodeGen(packagedState, trigger);
}

