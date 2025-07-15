import { PackagedCodebase, PackagedCodeMethod } from './codegenPackaging';
import { CodeGenCommand, CommandType } from './codegenCommands';
import { AspectState, CodeAspectType } from '@/store/codebase.types';

// Defines the progression of aspects for code generation.
const ASPECT_PROGRESSION = [
  CodeAspectType.IDENTIFIER,
  CodeAspectType.SIGNATURE,
  CodeAspectType.SPECIFICATION,
  CodeAspectType.IMPLEMENTATION,
];

// Hard-coded placeholder text for generated aspects.
const PLACEHOLDERS: Record<CodeAspectType, string> = {
  [CodeAspectType.IDENTIFIER]: 'newMethod',
  [CodeAspectType.SIGNATURE]:
    'evaluateMathematicalExpression(expression: string): int',
  [CodeAspectType.SPECIFICATION]:
    'Analysis the mathematical expression and return the result',
  [CodeAspectType.IMPLEMENTATION]:
    'Search the expression for plus and minus signs, and call add(x, y) and subtract(x, y) as necessary until the result is found',
};

/**
 * Information about what user action triggered the code-generation call.
 */
export type CodegenTrigger = {
  /** The method that was just edited. */
  method: PackagedCodeMethod;
  /** The specific aspect of the method that was changed. */
  aspect: CodeAspectType;
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
  const { method: triggeredMethod, aspect: triggeredAspect } = trigger;

  // 1. Find the next aspect in the progression.
  const currentIndex = ASPECT_PROGRESSION.indexOf(triggeredAspect);
  if (currentIndex < 0 || currentIndex + 1 >= ASPECT_PROGRESSION.length) {
    return []; // No next aspect to generate.
  }
  const nextAspect = ASPECT_PROGRESSION[currentIndex + 1];

  // 2. Find the full, updated method data from the snapshot.
  const methodInSnapshot = snapshot.methods.find(
    (m) => m.identifier.code === triggeredMethod.identifier.code
  );
  if (!methodInSnapshot) {
    return []; // Should not happen.
  }

  // 3. Check if the next aspect is locked.
  const targetAspectData = methodInSnapshot[nextAspect];
  if (targetAspectData.state === AspectState.LOCKED) {
    return []; // Target is locked, do nothing.
  }

  // 4. If not locked, generate a command to update it with a placeholder.
  return [
    {
      type: CommandType.UPDATE_ASPECT,
      className: snapshot.codeClass.descriptor,
      methodName: methodInSnapshot.identifier.code,
      aspect: nextAspect,
      value: PLACEHOLDERS[nextAspect],
    },
  ];
}
