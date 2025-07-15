import { CodeMethodData, CodeAspectType } from '@/store/codebase.types';

// -----------------------------------------------------------------------------
// Command definitions for code-generation operations currently supported.
// Only method-level commands are needed at this stage.
// -----------------------------------------------------------------------------

/**
 * Enum describing all operation types the LLM can ask the client to perform.
 * Keep the names snake-case to match JSON coming back from the model.
 */
export enum CommandType {
  CREATE_METHOD = 'create_method',
  DELETE_METHOD = 'delete_method',
  UPDATE_ASPECT = 'update_aspect',
}

/* ------------------------------------------------------------------
 * Command payload shapes
 * ------------------------------------------------------------------ */

export interface BaseCommand {
  type: CommandType;
  commentary?: string; // optional reasoning from LLM
}

export interface CreateMethodCommand extends BaseCommand {
  type: CommandType.CREATE_METHOD;
  className: string;
  method: CodeMethodData;
}

export interface DeleteMethodCommand extends BaseCommand {
  type: CommandType.DELETE_METHOD;
  className: string;
  methodName: string;
}

export interface UpdateAspectCommand extends BaseCommand {
  type: CommandType.UPDATE_ASPECT;
  className: string;
  methodName: string;
  aspect: CodeAspectType;
  value: string;
}

/**
 * Union of all command payloads
 */
export type CodeGenCommand =
  | CreateMethodCommand
  | DeleteMethodCommand
  | UpdateAspectCommand;
