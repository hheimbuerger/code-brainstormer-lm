import { PackagedCodebase } from './codegenPackaging';
import { CodeGenCommand, CommandType } from './codegenCommands';

// -----------------------------------------------------------------------------
// Hard-coded placeholder text for generated aspects. Fill in real strings later.
// -----------------------------------------------------------------------------
const SIGNATURE_PLACEHOLDER = '/* SIGNATURE_PLACEHOLDER */';
const SPEC_PLACEHOLDER = '/* SPEC_PLACEHOLDER */';
const IMPLEMENTATION_PLACEHOLDER = '/* IMPLEMENTATION_PLACEHOLDER */';

// Defines the progression order of aspects when incrementally generated.
const ASPECT_ORDER = ['signature', 'specification', 'implementation'] as const;

type ProgressiveAspect = typeof ASPECT_ORDER[number];

// Helper to decide the next aspect needing generation.
function findNextAspect(method: any): ProgressiveAspect | null {
  for (const aspect of ASPECT_ORDER) {
    // We treat an aspect as unfinished if its `code` (or `descriptor`) is empty
    // AND it is not locked. The exact structure may evolve, so we cast to any.
    const data = (method as any)[aspect];
    if (!data) continue;
    const isLocked = Boolean((data as any).locked);
    const hasContent = Boolean((data as any).code || (data as any).descriptor);
    if (!isLocked && !hasContent) {
      return aspect;
    }
  }
  return null;
}

// Map aspect → placeholder constant.
function placeholderFor(aspect: ProgressiveAspect): string {
  switch (aspect) {
    case 'signature':
      return SIGNATURE_PLACEHOLDER;
    case 'specification':
      return SPEC_PLACEHOLDER;
    case 'implementation':
      return IMPLEMENTATION_PLACEHOLDER;
    default:
      return '';
  }
}

/**
 * Simulates a backend call to an LLM-powered code-generation endpoint.
 *
 * For now this is fully deterministic / hard-coded: it looks at the input snapshot and
 * returns a small set of example commands. In the real implementation this would
 * make an HTTP request and parse the JSON response.
 */
export async function callLLMCodeSynthesis(
  snapshot: PackagedCodebase
): Promise<CodeGenCommand[]> {
  // 🚨 Replace with real HTTP call when backend is ready.


  return [
    {
      type: CommandType.UPDATE_ASPECT,
      className: snapshot.className,
      methodName: snapshot.methods[0].identifier,
      aspect: 'specification',
      value: `${snapshot.methods[0].specification} (reviewed)`
    },
  ];
}
