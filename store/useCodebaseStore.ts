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
    func.code ?? '',
    func.id,
    func.position
  );
};

// Create the store
export const useCodebaseStore = create<CodebaseState>()(
  devtools(
    (set, get) => ({
      // Core state - will be populated by async loading
      projectName: 'Loading...',
      codeFunctions: [],
      
      // Persist graph (currently no-op, kept for future)
      saveGraph: (nodes: unknown, edges: unknown) => {},

      // Update the project name
      updateProjectName: (name: string) => {
        set({ projectName: name }, false, 'updateProjectName');
      },
      
      // Add a new function with required position
      addCodeFunction: (position: { x: number; y: number }, initialData?: Partial<CodeFunctionData>) => {
        const newFunction = createCodeFunction({ position, ...initialData });
        set((state) => {
          const codeFunctions = [...state.codeFunctions, newFunction];
          
          return {
            codeFunctions,
          };
        }, false, 'addCodeFunction');
        return newFunction.id; // Return the ID of the newly created function
      },
      
      // Set position for a specific node by ID
      setNodePosition: (id: string, position: { x: number; y: number }) => {
        set((state) => {
          const codeFunctions = state.codeFunctions.map((func) =>
            func.id === id
              ? createCodeFunction({ ...func, position })
              : func
          );
          return { codeFunctions };
        }, false, 'setNodePosition');
      },
      
      // Update an existing function by ID
      updateCodeFunction: (id: string, func: Partial<CodeFunction>) => {
        set((state) => {
          const existingFunction = state.codeFunctions.find((f) => f.id === id);
          if (!existingFunction) return state;
          
          const updatedFunction = createCodeFunction({
            id: existingFunction.id,
            identifier: { ...existingFunction.identifier, ...func.identifier },
            signature: { ...existingFunction.signature, ...func.signature },
            specification: { ...existingFunction.specification, ...func.specification },
            implementation: { ...existingFunction.implementation, ...func.implementation },
            code: func.code ?? existingFunction.code,
            position: func.position ?? existingFunction.position,
          });
          
          const codeFunctions = state.codeFunctions.map((f) =>
            f.id === id ? updatedFunction : f
          );
          
          return {
            codeFunctions,
          };
        }, false, 'updateCodeFunction');
      },

      // Remove a function by ID
      removeCodeFunction: (id: string) => {
        set((state) => {
          const codeFunctions = state.codeFunctions.filter((f) => f.id !== id);
          return {
            codeFunctions,
          };
        }, false, 'removeCodeFunction');
      },
      
      // Async method to load project from external JSON using the data loader
      loadProjectFromFile: async () => {
        const projectData = await loadProjectData('/datasets/example-project.json');
        
        // Convert loaded functions to CodeFunction instances with positions
        const codeFunctions: CodeFunction[] = [];
        
        if (projectData.nodes) {
          // If nodes data exists, use those positions
          projectData.codeFunctions.forEach((func, index) => {
            const position = projectData.nodes?.[index]?.position || { x: 100, y: 100 };
            codeFunctions.push(createCodeFunction({ ...func, position }));
          });
        } else {
          // For sample data without nodes, use placement algorithm to generate positions
          const { findOptimalNodePlacement } = await import('../utils/nodePlacement');
          const { calculateNodeHeight, NODE_WIDTH } = await import('../constants/nodeConstants');
          const existingNodes: any[] = [];
          
          projectData.codeFunctions.forEach((func) => {
            const startPosition = { x: 100, y: 100 };
            const optimalPosition = findOptimalNodePlacement(startPosition, existingNodes);
            
            const newFunction = createCodeFunction({ ...func, position: optimalPosition });
            codeFunctions.push(newFunction);
            
            // Add to existing nodes for next placement calculation with CORRECT dimensions
            existingNodes.push({
              id: newFunction.id,
              position: optimalPosition,
              width: NODE_WIDTH,
              height: calculateNodeHeight(newFunction), // Use actual calculated height
              data: { functionId: newFunction.id },
              type: 'method' as const,
            });
          });
        }
        
        set({
          projectName: projectData.projectName,
          codeFunctions,
        }, false, 'loadProjectFromFile');
        
        console.log('Successfully loaded project from external JSON:', projectData.projectName, 'with', codeFunctions.length, 'functions');
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
