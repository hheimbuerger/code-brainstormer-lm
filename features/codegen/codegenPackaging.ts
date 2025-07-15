import { CodebaseState, CodeMethod } from '@/store/codebase.types';

/**
 * Minimal snapshot of the in-memory Zustand store that we want to send to the backend / LLM.
 * Keep this as lean as possible so the prompt stays within token limits.
 */
export interface PackagedCodebase {
  className: string;
  methods: Array<{
    identifier: string;
    signature: string;
    specification: string;
  }>;
  externalClasses: string[];
}

/**
 * Serialises the current Zustand store to a minimal, LLM-friendly JSON structure.
 *
 * NOTE: Only a stub for now.  Implementation will come later when we know exactly
 * what level of detail the LLM needs.
 */
export function packageCodebaseState(state: CodebaseState): PackagedCodebase {
  // TODO: Implement real packaging logic.  For now just return placeholders.
  return {
    className: state.codeClass.descriptor,
    methods: state.codeMethods.map((m: CodeMethod) => ({
      identifier: m.identifier.descriptor,
      signature: m.signature.code,
      specification: m.specification.code,
    })),
    externalClasses: [...state.externalClasses],
  };
}
