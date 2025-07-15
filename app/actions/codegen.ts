'use server';

// Server action wrapper for the LLM-powered code-generation endpoint.
// When we replace the mock with a real backend call this file remains the only place to change.

import { callLLMCodeSynthesis } from '@/features/codegen/codegenBackend';
import { PackagedCodebase } from '@/features/codegen/codegenPackaging';
import { CodeGenCommand } from '@/features/codegen/codegenCommands';

/**
 * generateCode – server action
 *
 * This function is invoked from client components.  Because it resides in the
 * server-side module graph (via the `use server` pragma) it never ships to the
 * browser.  The client calls it over an automatic POST request handled by Next.
 */
export async function generateCode(
  snapshot: PackagedCodebase
): Promise<CodeGenCommand[]> {
  // Delegates to the mock backend for now.
  return callLLMCodeSynthesis(snapshot);
}
