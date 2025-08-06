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

import { loadProjectData } from '../data/dataLoader';


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

// Create the store
export const useCodebaseStore = create<CodebaseState>()(
  devtools(
    (set, get) => ({
      // Core state - will be populated by async loading
      projectName: 'Loading...',
      codeFunctions: [],
      nodePositions: {}, // Store positions for each function by index
      
      // Persist graph (currently no-op, kept for future)
      saveGraph: (nodes: unknown, edges: unknown) => {},

      // Update the project name
      updateProjectName: (name: string) => {
        set({ projectName: name }, false, 'updateProjectName');
      },
      
      // Add a new function with required position
      addCodeFunction: (position: { x: number; y: number }) => {
        set((state) => {
          const newIndex = state.codeFunctions.length;
          const codeFunctions = [...state.codeFunctions, createCodeFunction()];
          const nodePositions = { ...state.nodePositions };
          
          // Always use provided position - no fallbacks
          nodePositions[newIndex] = position;
          
          return {
            codeFunctions,
            nodePositions,
          };
        }, false, 'addCodeFunction');
      },
      
      // Set position for a specific node
      setNodePosition: (index: number, position: { x: number; y: number }) => {
        set((state) => ({
          nodePositions: {
            ...state.nodePositions,
            [index]: position,
          },
        }), false, 'setNodePosition');
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
      
      // Async method to load project from external JSON using the data loader
      loadProjectFromFile: async () => {
        const projectData = await loadProjectData('/datasets/example-project.json');
        
        // Extract node positions from the loaded data
        const nodePositions: { [functionIndex: number]: { x: number; y: number } } = {};
        if (projectData.nodes) {
          projectData.nodes.forEach((node, index) => {
            nodePositions[index] = node.position;
          });
        } else {
          // For sample data without nodes, use placement algorithm to generate positions
          const { findOptimalNodePlacement } = await import('../utils/nodePlacement');
          const { calculateNodeHeight, NODE_WIDTH } = await import('../constants/nodeConstants');
          const existingNodes: any[] = [];
          
          projectData.codeFunctions.forEach((func, index) => {
            const startPosition = { x: 100, y: 100 };
            const optimalPosition = findOptimalNodePlacement(startPosition, existingNodes);
            nodePositions[index] = optimalPosition;
            
            // Add to existing nodes for next placement calculation with CORRECT dimensions
            existingNodes.push({
              id: `method-${index}`,
              position: optimalPosition,
              width: NODE_WIDTH,
              height: calculateNodeHeight(func), // Use actual calculated height
              data: { methodIndex: index },
              type: 'method' as const,
            });
          });
        }
        
        set({
          projectName: projectData.projectName,
          codeFunctions: projectData.codeFunctions,
          nodePositions,
        }, false, 'loadProjectFromFile');
        
        console.log('Successfully loaded project from external JSON:', projectData.projectName, 'with', Object.keys(nodePositions).length, 'node positions');
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
