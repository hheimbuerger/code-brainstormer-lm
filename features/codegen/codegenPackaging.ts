import {
  AspectState,
  CodebaseState,
  CodeMethod,
  CodeAspect,
} from '@/store/codebase.types';

/**
 * Minimal snapshot of the in-memory Zustand store that we want to send to the backend / LLM.
 * Keep this as lean as possible so the prompt stays within token limits.
 */
export interface PackagedAspect {
  code: string;
  state: AspectState;
}

export interface PackagedCodeMethod {
  identifier: PackagedAspect;
  signature: PackagedAspect;
  specification: PackagedAspect;
  implementation: PackagedAspect;
}

export interface PackagedCodebase {
  codeClass: CodeAspect;
  methods: PackagedCodeMethod[];
  externalClasses: string[];
}

/**
 * Serialises the current Zustand store to a minimal, LLM-friendly JSON structure.
 *
 * This snapshot contains the essential logical context of the codebase, including
 * class and method details, but excludes UI-specific state like node positions.
 */
export function packageCodebaseState(state: CodebaseState): PackagedCodebase {
  return {
    codeClass: state.codeClass,
    methods: state.codeMethods.map((m: CodeMethod) => ({
      identifier: { descriptor: m.identifier.descriptor, code: m.identifier.code, state: m.identifier.state },
      signature: { descriptor: m.signature.descriptor, code: m.signature.code, state: m.signature.state },
      specification: { descriptor: m.specification.descriptor, code: m.specification.code, state: m.specification.state },
      implementation: { descriptor: m.implementation.descriptor, code: m.implementation.code, state: m.implementation.state },
    })),
    externalClasses: [...state.externalClasses],
  };
}
