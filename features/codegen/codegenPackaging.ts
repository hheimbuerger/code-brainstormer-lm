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
  descriptor: string;
  state: AspectState;
}

export interface PackagedCodeMethod {
  identifier: PackagedAspect;
  signature: PackagedAspect;
  specification: PackagedAspect;
  implementation: PackagedAspect;
  code: string;
}

export interface PackagedCodebase {
  project: string;
  functions: PackagedCodeMethod[];
  externalClasses: string[];
}

/**
 * Serialises the current Zustand store to a minimal, LLM-friendly JSON structure.
 *
 * This snapshot contains the essential logical context of the codebase, including
 * class and method details, but excludes UI-specific state like node positions.
 */
export function packageCodebaseState(state: CodebaseState): PackagedCodebase {
  // return {
  //   codeClass: { descriptor: state.codeClass.descriptor, state: state.codeClass.state },
  //   methods: state.codeMethods.map((m: CodeMethod) => ({
  //     identifier: { descriptor: m.identifier.descriptor, state: m.identifier.state },
  //     signature: { descriptor: m.signature.descriptor, state: m.signature.state },
  //     specification: { descriptor: m.specification.descriptor, state: m.specification.state },
  //     implementation: { descriptor: m.implementation.descriptor, state: m.implementation.state },
  //     code: m.code,
  //   })),
  //   externalClasses: [...state.externalClasses],
  // };
  return {
    project: state.codeClass.descriptor,
    functions: state.codeMethods.map((m: CodeMethod) => ({
      identifier: { descriptor: m.identifier.descriptor, state: m.identifier.state },
      signature: { descriptor: m.signature.descriptor, state: m.signature.state },
      specification: { descriptor: m.specification.descriptor, state: m.specification.state },
      implementation: { descriptor: m.implementation.descriptor, state: m.implementation.state },
      code: m.code,
    })),
    externalClasses: [...state.externalClasses],
  };
}
