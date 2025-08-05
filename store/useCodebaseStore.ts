import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import {
  AspectState,
  CodeAspect,
  CodeFunction,
  type CodebaseState,
  type CodeAspectData,
  type CodeFunctionData
} from './codebase.types';



// Helper function to create a new CodeAspect from partial data
const createCodeAspect = (field: Partial<CodeAspectData> = {}): CodeAspect => {
  return new CodeAspect(
    field.descriptor ?? '',
    field.state ?? AspectState.UNSET
  );
};

// Helper function to create a new CodeFunction from partial data
export const createCodeFunction = (func: Partial<CodeFunctionData> = {}): CodeFunction => {
  
  return new CodeFunction(
    createCodeAspect(func.identifier || {}),
    createCodeAspect(func.signature || {}),
    createCodeAspect(func.specification || {}),
    createCodeAspect(func.implementation || {}),
    func.code ?? ''
  );
};

// Import default data
import { getDefaultProjectData } from '../data/dataLoader';

// Initialize with default data
const defaultData = getDefaultProjectData();

// Create the store
export const useCodebaseStore = create<CodebaseState>()(
  devtools(
    (set, get) => ({
      // Core state
      projectName: defaultData.projectName,
      codeFunctions: defaultData.codeFunctions,
      
      // Persist graph (currently no-op, kept for future)
      saveGraph: (nodes: unknown, edges: unknown) => {},

      // Update the project name
      updateProjectName: (name: string) => {
        set({ projectName: name }, false, 'updateProjectName');
      },
      
      // Add a new function
      addCodeFunction: () => {
        set((state) => {
          const codeFunctions = [...state.codeFunctions, createCodeFunction()];
          return {
            codeFunctions,
          };
        }, false, 'addCodeFunction');
      },
      
      // Update an existing function
      updateCodeFunction: (index: number, func: Partial<CodeFunction>) => {
        set((state) => {
          const existingFunction = state.codeFunctions[index];
          if (!existingFunction) return state;
          
          const updatedFunction = createCodeFunction({
            identifier: { ...existingFunction.identifier, ...func.identifier },
            signature: { ...existingFunction.signature, ...func.signature },
            specification: { ...existingFunction.specification, ...func.specification },
            implementation: { ...existingFunction.implementation, ...func.implementation },
            code: func.code ?? existingFunction.code,
          });
          
          const codeFunctions = [...state.codeFunctions];
          codeFunctions[index] = updatedFunction;
          
          return {
            codeFunctions,
          };
        }, false, 'updateCodeFunction');
      },

      // Remove a function by index
      removeCodeFunction: (index: number) => {
        set((state) => {
          const codeFunctions = state.codeFunctions.filter((_, i) => i !== index);
          return {
            codeFunctions,
          };
        }, false, 'removeCodeFunction');
      },
      
    }),
    {
      name: 'CodebaseStore',
      serialize: {
        replacer: (key: string, value: unknown) => {
          // Use toJSON if available on the object
          if (value !== null && typeof value === 'object' && 'toJSON' in value) {
            return (value as { toJSON: () => unknown }).toJSON();
          }
          return value;
        },
        options: {
          maxDepth: 3,
        },
      },
    }
  )
);
