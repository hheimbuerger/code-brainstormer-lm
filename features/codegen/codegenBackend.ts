import { PackagedCodebase, PackagedCodeMethod } from './codegenPackaging';
import { CodeGenCommand, CommandType } from './codegenCommands';
import { AspectState, CodeAspectType } from '@/store/codebase.types';
import { cloudLlmGenerateCode } from './codegenCloudLlm';

/* // Defines the progression of aspects for code generation.
const ASPECT_PROGRESSION = [
  CodeAspectType.IDENTIFIER,
  CodeAspectType.SIGNATURE,
  CodeAspectType.SPECIFICATION,
  CodeAspectType.IMPLEMENTATION,
];

// Hard-coded placeholder text for generated aspects.
const PLACEHOLDER_CODE = 'def newMethod(expression):\n  # TODO: implement\n  return 0';

const PLACEHOLDERS: Record<CodeAspectType, string> = {
  [CodeAspectType.IDENTIFIER]: 'newMethod',
  [CodeAspectType.SIGNATURE]:
    'evaluateMathematicalExpression(expression: string): int',
  [CodeAspectType.SPECIFICATION]:
    'Analysis the mathematical expression and return the result',
  [CodeAspectType.IMPLEMENTATION]:
    'Search the expression for plus and minus signs, and call add(x, y) and subtract(x, y) as necessary until the result is found',
}; */

/**
 * Information about what user action triggered the code-generation call.
 */
export type CodegenTrigger = {
  /** The method that was just edited. */
  method: PackagedCodeMethod;
  /** The specific aspect of the method that was changed. */
  aspect: CodeAspectType;
  /** The sequence of aspects to generate, from the edited one down to the first locked aspect. */
  aspectsToGenerate: CodeAspectType[];
};

/**
 * Simulates a backend call to an LLM-powered code-generation endpoint.
 *
 * This function implements the core logic for progressive code generation.
 * Given a trigger, it determines the next logical aspect to generate and
 * returns a command to update it, unless that aspect is locked.
 */
export async function callLLMCodeSynthesis(
  snapshot: PackagedCodebase,
  trigger: CodegenTrigger
): Promise<CodeGenCommand[]> {
  console.log('[DEBUG] Entered callLLMCodeSynthesis.');
  const { method: triggeredMethod, aspect: triggeredAspect } = trigger;

  // Call remote LLM (hard-coded test). If we get valid commands, return early
  const cloudCmds = await cloudLlmGenerateCode(snapshot, trigger);
  if (cloudCmds.length) {
    console.log(`[DEBUG] Returning ${cloudCmds.length} commands from cloud test`);
    return cloudCmds;
  }

  throw new Error('No code-gen commands were generated from the cloud test or the sim backend.');


/*   // 1. Find the next aspect in the progression.
  const currentIndex = ASPECT_PROGRESSION.indexOf(triggeredAspect);
  if (currentIndex < 0 || currentIndex + 1 >= ASPECT_PROGRESSION.length) {
    return []; // No next aspect to generate.
  }
  const nextAspect = ASPECT_PROGRESSION[currentIndex + 1];

  // 2. Find the full, updated method data from the snapshot.
  const methodInSnapshot = snapshot.methods.find(
    (m) => m.identifier.descriptor === triggeredMethod.identifier.descriptor
  );
  if (!methodInSnapshot) {
    return []; // Should not happen.
  }

  // 3. Check if the next aspect is locked.
  const targetAspectData = methodInSnapshot[nextAspect];
  if (targetAspectData.state === AspectState.LOCKED) {
    return []; // Target is locked, do nothing.
  }

  // 4. If not locked, generate commands to update it with a placeholder.
  const commands: CodeGenCommand[] = [
    {
      type: CommandType.UPDATE_ASPECT,
      className: snapshot.codeClass.descriptor,
      methodName: methodInSnapshot.identifier.descriptor,
      aspect: nextAspect,
      value: PLACEHOLDERS[nextAspect],
    },
  ];

  // 5. If we've just generated the implementation descriptor, also generate the code.
  if (nextAspect === CodeAspectType.IMPLEMENTATION) {
    commands.push({
      type: CommandType.UPDATE_METHOD_CODE,
      className: snapshot.codeClass.descriptor,
      methodName: methodInSnapshot.identifier.descriptor,
      value: PLACEHOLDER_CODE,
    });
  }
  console.log(`[DEBUG] Exiting callLLMCodeSynthesis, returning ${commands.length} commands.`);
  return commands;
 */
}
