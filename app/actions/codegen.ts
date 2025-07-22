'use server';

// This file defines the server action that serves as the main entry point for code generation.
// It delegates to the `callLLMCodeSynthesis` function.

import { callLLMCodeSynthesis, CodegenTrigger } from '@/features/codegen/codegenBackend';
import { PackagedCodebase } from '@/features/codegen/codegenPackaging';
import { CodeGenCommand } from '@/features/codegen/codegenCommands';

/**
 * generateCode – server action
 *
 * This function is invoked from client components.  Because it resides in the
 * server-side module graph (via the `use server` pragma) it never ships to the
 * browser.  The client calls it over an automatic POST request handled by Next.
 */
export async function invokeCodeGen(
  snapshot: PackagedCodebase,
  trigger: CodegenTrigger
): Promise<CodeGenCommand[]> {
  console.log('[DEBUG] Invoking codegen backend with trigger:', trigger);
  const cmds = await callLLMCodeSynthesis(snapshot, trigger);
  console.log('[DEBUG] invokeCodeGen returning', cmds.length, 'commands:', cmds);
  return cmds;
}
