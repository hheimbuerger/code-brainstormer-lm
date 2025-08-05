import { CodeFunctionData, CodeAspectType } from '@/store/codebase.types';

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
  UPDATE_METHOD_CODE = 'update_method_code',
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
  method: CodeFunctionData;
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

export interface UpdateMethodCodeCommand extends BaseCommand {
  type: CommandType.UPDATE_METHOD_CODE;
  className: string;
  methodName: string;
  value: string;
}

/**
 * Union of all command payloads
 */
export type CodeGenCommand =
  | CreateMethodCommand
  | DeleteMethodCommand
  | UpdateAspectCommand
  | UpdateMethodCodeCommand;
