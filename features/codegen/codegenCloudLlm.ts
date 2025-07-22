import Anthropic from '@anthropic-ai/sdk';
import { CodeGenCommand, CommandType } from './codegenCommands';

// ---------------------------------------------------------------------------
// Configuration constants for the hard-coded cloud test
// ---------------------------------------------------------------------------
export const CLOUD_LLM_MODEL = 'claude-3-5-haiku-20241022';    // cheapest model for testing and prototyping
// export const CLOUD_LLM_MODEL = 'claude-4-sonnet-20250514';    // modern efficient model

export const CLOUD_LLM_MAX_TOKENS = 2048;

export const SYSTEM_PROMPT = `
  You are a code-generation backend.
  Return ONLY JSON (no markdown) representing a single CodeGenCommand of type 'update_aspect'.
  The schema is:
    {
      "type": "update_aspect",
      "className": string,
      "methodName": string,
      "aspect": "identifier|signature|specification|implementation",
      "value": string
    }

  Function calls should be of the form 'functionName(arg1, arg2, ...)', where all arguments are optional.
`;
import { CodeAspectType } from '@/store/codebase.types';
import { CodegenTrigger } from './codegenBackend';
import { PackagedCodebase } from './codegenPackaging';

/**
 * Very small runtime validator to ensure a plain JS object conforms to the
 * minimum fields of a `CodeGenCommand` union.  (Replace with zod in future.)
 */
function isValidCodeGenCommand(obj: any): obj is CodeGenCommand {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.type !== 'string') return false;
  switch (obj.type as CommandType) {
    case CommandType.UPDATE_ASPECT:
      return (
        typeof obj.className === 'string' &&
        typeof obj.methodName === 'string' &&
        typeof obj.aspect === 'string' &&
        typeof obj.value === 'string'
      );
    case CommandType.CREATE_METHOD:
      return typeof obj.className === 'string' && !!obj.method;
    case CommandType.DELETE_METHOD:
      return typeof obj.className === 'string' && typeof obj.methodName === 'string';
    case CommandType.UPDATE_METHOD_CODE:
      return (
        typeof obj.className === 'string' &&
        typeof obj.methodName === 'string' &&
        typeof obj.value === 'string'
      );
    default:
      return false;
  }
}

/**
 * One-off test call to Anthropic that asks for a single concrete command.
 * Returns an empty array if parsing / validation fails so callers can ignore it
 * safely in production.
 */
export async function cloudLlmGenerateCode(snapshot: PackagedCodebase, trigger: CodegenTrigger): Promise<CodeGenCommand[]> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const prompt: string = `
    Do return a command to update the aspect 'implementation' of the method ${trigger.method.identifier.descriptor}
    In it, include at least one function call from the following list: [formatText, processData].
    You may invent parameters as you like.
  `;

  const requestBody: Anthropic.MessageCreateParams = {
    model: CLOUD_LLM_MODEL,
    max_tokens: CLOUD_LLM_MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  };

  const response: Anthropic.Message = await anthropic.messages.create(requestBody);

  // Log token usage for debugging
  console.log('[DEBUG] Anthropic usage:', JSON.stringify(response.usage));

  // Fail fast if generation was truncated or interrupted
  if (response.stop_reason !== 'end_turn') {
    console.warn('[WARN] LLM stop_reason indicates incomplete output:', response.stop_reason);
    return [];
  }

  // The SDK returns `content` as an array of objects; join to plain text.
  const rawText = Array.isArray(response.content)
    ? response.content.map((c: any) => ('text' in c ? c.text : '')).join('')
    : String(response.content);

  const jsonText = rawText.trim();
  try {
    const parsed = JSON.parse(jsonText);
    const cmds = Array.isArray(parsed) ? parsed : [parsed];
    const validCmds = cmds.filter(isValidCodeGenCommand);
    return validCmds as CodeGenCommand[];
  } catch {
    console.warn('[WARN] Could not parse LLM JSON:', jsonText);
    return [];
  }
}
