
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { exampleExternalClasses, exampleGenClass, exampleGenMethods } from '../data/generated-code-example';

import {
  AspectState,
  GenField,
  GenMethod,
  type CodebaseState,
  type GenFieldData,
  type GenMethodData
} from './codebase.types';



// Helper function to create a new GenField from partial data
const createGenField = (field: Partial<GenFieldData> = {}): GenField => {
  return new GenField(
    field.descriptor ?? '',
    field.state ?? AspectState.PLANNED,
    field.code ?? ''
  );
};

// Helper function to create a new GenMethod from partial data
const createGenMethod = (method: Partial<GenMethodData> = {}): GenMethod => {
  const position = method.position || { x: 0, y: 0 };
  return new GenMethod(
    createGenField(method.identifier || {}),
    createGenField(method.returnValue || {}),
    createGenField(method.parameters || { descriptor: 'params', state: AspectState.PLANNED, code: '' }),
    createGenField(method.specification || {}),
    createGenField(method.implementation || {}),
    { x: position.x || 0, y: position.y || 0 }
  );
};

// Create the store
export const useCodebaseStore = create<CodebaseState>()(
  devtools(
    (set, get) => ({
      // Core state
      genClass: exampleGenClass,
      genMethods: exampleGenMethods,
      externalClasses: exampleExternalClasses,
      
      
      
      // Persist graph (currently no-op, kept for future)
      saveGraph: (nodes: unknown, edges: unknown) => {},

      // Update the class fields
      updateGenClass: (field) => {
        const updatedClass = createGenField({
          ...exampleGenClass,
          ...field
        });
        
        set({ genClass: updatedClass }, false, 'updateGenClass');
      },
      
      // Add a new method
      addGenMethod: () => {
        set((state) => {
          const genMethods = [...state.genMethods, createGenMethod()];
          return {
            genMethods,
          };
        }, false, 'addGenMethod');
      },
      
      // Update an existing method
      updateGenMethod: (index, method) => {
        set((state) => {
          const existingMethod = state.genMethods[index];
          if (!existingMethod) return state;
          
          const updatedMethod = createGenMethod({
            identifier: { ...existingMethod.identifier, ...method.identifier },
            returnValue: { ...existingMethod.returnValue, ...method.returnValue },
            parameters: { ...existingMethod.parameters, ...method.parameters },
            specification: { ...existingMethod.specification, ...method.specification },
            implementation: { ...existingMethod.implementation, ...method.implementation },
            
          });
          
          const genMethods = [...state.genMethods];
          genMethods[index] = updatedMethod;
          
          return {
            genMethods,
          };
        }, false, 'updateGenMethod');
      },
      
      // Remove a method by index
      removeGenMethod: (index) => {
        set((state) => {
          const genMethods = state.genMethods.filter((_, i) => i !== index);
          return {
            genMethods,
          };
        }, false, 'removeGenMethod');
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
