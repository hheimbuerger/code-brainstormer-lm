import {
  AspectState,
  CodebaseState,
  CodeFunction,
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

export interface PackagedCodeFunction {
  identifier: PackagedAspect;
  signature: PackagedAspect;
  specification: PackagedAspect;
  implementation: PackagedAspect;
  code: string;
}

export interface PackagedCodebase {
  project: string;
  functions: PackagedCodeFunction[];
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
  //   functions: state.codeFunctions.map((f: CodeFunction) => ({
  //     identifier: { descriptor: m.identifier.descriptor, state: m.identifier.state },
  //     signature: { descriptor: m.signature.descriptor, state: m.signature.state },
  //     specification: { descriptor: m.specification.descriptor, state: m.specification.state },
  //     implementation: { descriptor: m.implementation.descriptor, state: m.implementation.state },
  //     code: m.code,
  //   })),
  //   externalClasses: [...state.externalClasses],
  // };
  return {
    project: state.projectName,
    functions: state.codeFunctions.map((f: CodeFunction) => ({
      identifier: { descriptor: f.identifier.descriptor, state: f.identifier.state },
      signature: { descriptor: f.signature.descriptor, state: f.signature.state },
      specification: { descriptor: f.specification.descriptor, state: f.specification.state },
      implementation: { descriptor: f.implementation.descriptor, state: f.implementation.state },
      code: f.code,
    })),
  };
}
