import { applyEdgeChanges, applyNodeChanges } from 'reactflow';
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

// Debug log the example data
console.log('Example GenClass:', exampleGenClass.toString());
console.log('Example GenMethods:', exampleGenMethods.map(m => m.toString()));

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
      
      // React Flow state
      nodes: exampleGenMethods.map((method, index) => ({
        id: `method-${index}`,
        type: 'custom',
        position: method.position,
        data: {
          id: `method-${index}`,
          methodIndex: index
        }
      })),
      edges: [
        // Hardcoded edge from first method to second method
        {
          id: 'edge-0-1',
          source: 'method-0',
          target: 'method-1',
          type: 'smoothstep',
          animated: false,
        },
      ],
      
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
        set((state) => ({
          genMethods: [...state.genMethods, createGenMethod()]
        }), false, 'addGenMethod');
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
            position: { ...existingMethod.position, ...method.position }
          });
          
          const updatedMethods = [...state.genMethods];
          updatedMethods[index] = updatedMethod;
          
          return { genMethods: updatedMethods };
        }, false, 'updateGenMethod');
      },
      
      // Remove a method by index
      removeGenMethod: (index) => {
        set((state) => ({
          genMethods: state.genMethods.filter((_, i) => i !== index)
        }), false, 'removeGenMethod');
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
      
      // React Flow handlers
      onNodesChange: (changes) => {
        set((state) => ({
          nodes: applyNodeChanges(changes, state.nodes)
        }), false, 'onNodesChange');
      },
      
      onEdgesChange: (changes) => {
        set((state) => ({
          edges: applyEdgeChanges(changes, state.edges)
        }), false, 'onEdgesChange');
      },
      
      updateNodePosition: (id, position) => {
        set((state) => {
          const nodeIndex = state.nodes.findIndex(node => node.id === id);
          if (nodeIndex === -1) return state;
          
          const methodIndex = state.nodes[nodeIndex].data.methodIndex;
          const methodToUpdate = state.genMethods[methodIndex];
          
          // Create a new GenMethod instance with the updated position
          const updatedMethod = new GenMethod(
            methodToUpdate.identifier,
            methodToUpdate.returnValue,
            methodToUpdate.parameters,
            methodToUpdate.specification,
            methodToUpdate.implementation,
            position
          );
          
          // Create a new array with the updated method
          const updatedGenMethods = [...state.genMethods];
          updatedGenMethods[methodIndex] = updatedMethod;
          
          // Update the corresponding node's position
          const updatedNodes = state.nodes.map(node => 
            node.id === id ? { ...node, position } : node
          );
          
          return {
            nodes: updatedNodes,
            genMethods: updatedGenMethods
          };
        }, false, 'updateNodePosition');
      }
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
