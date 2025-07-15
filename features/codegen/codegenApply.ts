import { CodeGenCommand, CommandType } from './codegenCommands';
import { useCodebaseStore } from '@/store/useCodebaseStore';

/**
 * applyCodegenCommands – SKETCH ONLY
 * -------------------------------------------------
 * Walks through the array of commands returned by the backend and mutates the
 * Zustand store accordingly.  All branches are placeholders – fill them in
 * when the detailed store mutation logic is clear.
 */
export function applyCodegenCommands(cmds: CodeGenCommand[]) {
  const store = useCodebaseStore.getState();
  const { updateCodeClass, updateCodeMethod, addCodeMethod, removeCodeMethod } = store;

  cmds.forEach((cmd) => {
    switch (cmd.type) {
      case CommandType.CREATE_METHOD:
        // TODO: Map cmd.method into store.addCodeMethod / update logic
        addCodeMethod();
        break;

      case CommandType.UPDATE_ASPECT:
        // TODO: Locate method index by name and update aspect
        // updateCodeMethod(index, { [cmd.aspect]: { code: cmd.value } })
        break;

      case CommandType.DELETE_METHOD:
        // TODO: Find method index and remove
        // removeCodeMethod(index)
        break;

      // Add other cases as CommandType expands

      default:
        console.warn('Unhandled command', cmd);
    }
  });
}
