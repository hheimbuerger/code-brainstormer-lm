import { CodeGenCommand, CommandType, UpdateMethodCodeCommand } from './codegenCommands';
import { useCodebaseStore, createCodeMethod } from '@/store/useCodebaseStore';
import { AspectState } from '@/store/codebase.types';

/**
 * Walks through an array of commands from the code-generation backend and
 * applies them sequentially to the Zustand store.
 */
export function applyCodegenCommands(cmds: CodeGenCommand[]) {
  console.log(`[DEBUG] Applying ${cmds.length} commands to the store.`);
  // It's crucial to get a fresh state reference inside the loop for every command,
  // as each command mutates the store and the next command needs to see that change.
  cmds.forEach((cmd) => {
    const store = useCodebaseStore.getState();

    switch (cmd.type) {
      case CommandType.CREATE_METHOD: {
        // First, add a new blank method.
        store.addCodeMethod();
        // Then, get its index and immediately update it with the payload.
        const newIndex = store.codeMethods.length - 1;
        const newMethod = createCodeMethod(cmd.method);
        store.updateCodeMethod(newIndex, newMethod);
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
        // Set the aspect's descriptor and mark its state as AI-generated.
        store.updateCodeMethod(methodIndex, {
          [cmd.aspect]: { descriptor: cmd.value, state: AspectState.AUTOGEN },
        });
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
        break;
      }

      default: {
        // This ensures that we get a compile-time error if we forget to handle a command.
        const _exhaustiveCheck: never = cmd;
        console.warn('Unhandled command:', _exhaustiveCheck);
      }
    }
  });
}
