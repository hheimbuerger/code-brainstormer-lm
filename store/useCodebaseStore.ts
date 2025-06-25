import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { exampleExternalClasses, exampleCodeClass, exampleCodeMethods } from '../data/generated-code-example';

import {
  AspectState,
  CodeAspect,
  CodeMethod,
  type CodebaseState,
  type CodeAspectData,
  type CodeMethodData
} from './codebase.types';



// Helper function to create a new CodeField from partial data
const createCodeField = (field: Partial<CodeAspectData> = {}): CodeAspect => {
  return new CodeAspect(
    field.descriptor ?? '',
    field.state ?? AspectState.UNSET,
    field.code ?? ''
  );
};

// Helper function to create a new CodeMethod from partial data
const createCodeMethod = (method: Partial<CodeMethodData> = {}): CodeMethod => {
  
  return new CodeMethod(
    createCodeField(method.identifier || {}),
    createCodeField(method.signature || {}),

    createCodeField(method.specification || {}),
    createCodeField(method.implementation || {})
  );
};

// Create the store
export const useCodebaseStore = create<CodebaseState>()(
  devtools(
    (set, get) => ({
      // Core state
      codeClass: exampleCodeClass,
      codeMethods: exampleCodeMethods,
      externalClasses: exampleExternalClasses,
      
      // Persist graph (currently no-op, kept for future)
      saveGraph: (nodes: unknown, edges: unknown) => {},

      // Update the class fields
      updateCodeClass: (field: Partial<CodeAspect>) => {
        const updatedClass = createCodeField({
          ...exampleCodeClass,
          ...field
        });
        
        set({ codeClass: updatedClass }, false, 'updateCodeClass');
      },
      
      // Add a new method
      addCodeMethod: () => {
        set((state) => {
          const codeMethods = [...state.codeMethods, createCodeMethod()];
          return {
            codeMethods,
          };
        }, false, 'addCodeMethod');
      },
      
      // Update an existing method
      updateCodeMethod: (index, method) => {
        set((state) => {
          const existingMethod = state.codeMethods[index];
          if (!existingMethod) return state;
          
          const updatedMethod = createCodeMethod({
            identifier: { ...existingMethod.identifier, ...method.identifier },
            signature: { ...existingMethod.signature, ...method.signature },
            
            
            specification: { ...existingMethod.specification, ...method.specification },
            implementation: { ...existingMethod.implementation, ...method.implementation },
            
          });
          
          const codeMethods = [...state.codeMethods];
          codeMethods[index] = updatedMethod;
          
          return {
            codeMethods,
          };
        }, false, 'updateCodeMethod');
      },
      
      // Remove a method by index
      removeCodeMethod: (index) => {
        set((state) => {
          const codeMethods = state.codeMethods.filter((_, i) => i !== index);
          return {
            codeMethods,
          };
        }, false, 'removeCodeMethod');
      },
      
      // Add a new external class
      addExternalClass: (className: string) => {
        if (!className.trim()) return;
        set((state) => ({
          externalClasses: [...new Set([...state.externalClasses, className.trim()])]
        }), false, 'addExternalClass');
      },
      
      // Remove an external class by index
      removeExternalClass: (index: number) => {
        set((state) => ({
          externalClasses: state.externalClasses.filter((_, i) => i !== index)
        }), false, 'removeExternalClass');
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
