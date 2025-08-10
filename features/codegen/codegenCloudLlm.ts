import Anthropic from '@anthropic-ai/sdk';
import { CodeGenCommand, CommandType } from './codegenCommands';

// ---------------------------------------------------------------------------
// Configuration constants for the hard-coded cloud test
// ---------------------------------------------------------------------------
// export const CLOUD_LLM_MODEL = 'claude-3-5-haiku-20241022';    // cheapest model for testing and prototyping
export const CLOUD_LLM_MODEL = 'claude-4-sonnet-20250514';    // efficient model
// export const CLOUD_LLM_MODEL = 'claude-opus-4-1-20250805';    // most capable, slower model

export const CLOUD_LLM_MAX_TOKENS = 2048;

export const SYSTEM_PROMPT = `
  You are performing code-generation-adjacent tasks. You're mostly working with an abstract list of functions, however. For data types and general language features, think of
  very simplified Python.

  The codebase is a series of pure functions. Functions can call each other or imaginary external functions.
  For the generated code, we're not dealing with classes, packages, or modules. It's just fairly simple functions.

  Each function is defined by the following four 'parameters', which we're calling *aspects*:
  * identifier: the function's name
  * signature: its parameters and return type
  * specification: the description of the function, including use cases: what it can do and what it needs to do that. Think of this as the function's docstring!
  * implementation: a textual description of the function's logic, including a *complete* list of all function calls it can invoke. *Not* source code! *Not* markdown either. May contain paragraph breaks for structure. Think of it as the sequence of all code block comments in the function's body. You may specifically mention branches and loops here.

  The implementation aspect can and *should* include function calls. They are displayed as 'functionName(arg1, arg2, ...)', with all arguments being optional. Do not wrap function calls in backticks.
  The system will collect all function calls from the implementation string you're generating, and this will build the call hierarchy of the entire codebase, so this is a very important aspect to generate!
  Make sure you generate the paratheses behind the function call, even if you're only referring to the function abstractly and without specific arguments/parameters, otherwise it won't be interpreted as a function call by the rest of the system.

  We're considering the four aspects a descending hierarchy of specificity. That is, the signature follows the identifier, the specification follows the signature, and the implementation follows the specification.

  You're always given a snapshot of the current state of the codebase as a JSON. It will tell you about the class name and all existing functions.
  The codebase snapshot will already contain the latest change made by the user. You'll be told what was just changed and what aspects you're expected to generate.
  Each aspect comes with a state: 'edited' means it has been written by a human, 'autogen' means it was LLM-generated, 'locked' means the human has marked this as final and not to be changed for now.

  Be conservative in generating: as much as possible try to keep what's already there. If the specification has changed significantly, then of course the implementation must change, too.
  But minor modifications shouldn't cause all a complete refactoring of the system.
  If the existing aspect fits your new inputs, don't change it. If you need a function call, and there is one that fits okay, then call it instead of generating a new one.
  If an existing function sounds like what you need, then use it, even if the parameter or signature isn't precisely what you had in mind.
  But when the function you're generating requires another helper function, which doesn't exist yet, feel free to generate a function call to a new function.

  Be very lenient about data types and parameters, that's not the focus of this system.

  Return ONLY JSON in the following format:
  {
    "rationale": string,   # as Markdown
    "commands": CodeGenCommand[]
  }

  The schema of each CodeGenCommand is:
    {
      "type": "update_aspect",
      "methodName": string,
      "aspect": "identifier|signature|specification|implementation",
      "value": string
    }

  RETURN ONLY JSON! NO MARKDOWN!
`;
import { CodegenTrigger } from './codegenBackend';
import { PackagedCodebase } from './codegenPackaging';

/**
 * Very small runtime validator to ensure a plain JS object conforms to the
 * minimum fields of a `CodeGenCommand` union.  (Replace with zod in future.)
 */
function isValidCodeGenCommand(obj: any): obj is CodeGenCommand {
  if (!obj || typeof obj !== 'object') {
    console.warn('[DEBUG] Command validation failed: not an object', obj);
    return false;
  }
  if (typeof obj.type !== 'string') {
    console.warn('[DEBUG] Command validation failed: type is not string', obj);
    return false;
  }
  
  console.log('[DEBUG] Validating command:', obj);
  
  switch (obj.type as CommandType) {
    case CommandType.UPDATE_ASPECT:
      const isValid = (
        typeof obj.methodName === 'string' &&
        typeof obj.aspect === 'string' &&
        typeof obj.value === 'string'
      );
      if (!isValid) {
        console.warn('[DEBUG] UPDATE_ASPECT validation failed:', {
          methodName: typeof obj.methodName,
          aspect: typeof obj.aspect,
          value: typeof obj.value
        });
      }
      return isValid;
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
      console.warn('[DEBUG] Command validation failed: unknown type', obj.type);
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

  const aspectsToGenerateText = trigger.aspectsToGenerate.length > 0 
    ? trigger.aspectsToGenerate.join(', ')
    : 'none (all subsequent aspects are locked or already complete)';

  console.log(`[DEBUG] Cloud LLM called with trigger aspect: ${trigger.modifiedAspect}, method: ${trigger.modifiedFunction.identifier.descriptor}`);
  console.log(`[DEBUG] Method: ${trigger.modifiedFunction}, aspect: ${trigger.modifiedAspect}`);
  
  const functionName = trigger.modifiedFunction.identifier.descriptor;
  
  const prompt: string = `
    Here is the current state of the codebase:
    ${JSON.stringify(snapshot)}

    You have been given a new aspect '${trigger.modifiedAspect}' of the function '${functionName}'. The new value is:
    ${trigger.modifiedFunction[trigger.modifiedAspect].descriptor}

    Based on this change, you should generate the following aspects of the function '${functionName}': ${aspectsToGenerateText}

    Please generate appropriate values for each of these aspects, taking into account the updated ${trigger.modifiedAspect} and the current state of the function.
  `;
  console.log('[DEBUG] Prompt:', prompt);

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

  let jsonText = rawText.trim();
  
  // Handle JSON wrapped in markdown code blocks (```json ... ```)
  const jsonCodeBlockRegex = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/;
  const match = jsonText.match(jsonCodeBlockRegex);
  if (match) {
    jsonText = match[1].trim();
  }
  
  try {
    const parsed = JSON.parse(jsonText);
    console.log('[DEBUG] LLM rationale:', parsed.rationale);
    const cmds = Array.isArray(parsed.commands) ? parsed.commands : [];

    const validCmds = cmds.filter(isValidCodeGenCommand);
    return validCmds as CodeGenCommand[];
  } catch {
    console.warn('[WARN] Could not parse LLM JSON:', jsonText);
    return [];
  }
}
