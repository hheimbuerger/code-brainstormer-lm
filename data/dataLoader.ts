import { CodeAspect, CodeFunction, AspectState } from '../store/codebase.types';
import { 
  ProjectData, 
  ProjectFunction, 
  validateProjectData, 
  hasUIState, 
  functionHasUIState,
  generateDefaultFunctionUI,
  generateDefaultProjectUI,
  parseAspectState
} from './projectSchema';
import { Node, Edge } from 'reactflow';
import { findOptimalNodePlacement } from '../utils/nodePlacement';
import { NODE_WIDTH, calculateNodeHeight } from '../constants/nodeConstants';

// Convert ProjectFunction to CodeFunction
const projectFunctionToCodeFunction = (func: ProjectFunction): CodeFunction => {
  return new CodeFunction(
    new CodeAspect(func.identifier.descriptor, parseAspectState(func.identifier.state)),
    new CodeAspect(func.signature.descriptor, parseAspectState(func.signature.state)),
    new CodeAspect(func.specification.descriptor, parseAspectState(func.specification.state)),
    new CodeAspect(func.implementation.descriptor, parseAspectState(func.implementation.state)),
    func.code
  );
};

// Convert CodeFunction to ProjectFunction (for saving)
export const codeFunctionToProjectFunction = (func: CodeFunction, ui?: ProjectFunction['ui']): ProjectFunction => {
  const projectFunc: ProjectFunction = {
    identifier: {
      descriptor: func.identifier.descriptor,
      state: func.identifier.state
    },
    signature: {
      descriptor: func.signature.descriptor,
      state: func.signature.state
    },
    specification: {
      descriptor: func.specification.descriptor,
      state: func.specification.state
    },
    implementation: {
      descriptor: func.implementation.descriptor,
      state: func.implementation.state
    },
    code: func.code
  };
  
  if (ui) {
    projectFunc.ui = ui;
  }
  
  return projectFunc;
};

// Enhanced load function that supports both sample data and persisted state
export const loadProjectData = async (jsonPath: string): Promise<{
  projectName: string;
  codeFunctions: CodeFunction[];
  nodes?: Node[];
  edges?: Edge[];
  viewport?: { x: number; y: number; zoom: number };
}> => {
  try {
    const response = await fetch(jsonPath);
    const data: ProjectData = await response.json();
    
    if (!validateProjectData(data)) {
      throw new Error('Invalid project data format');
    }
    
    // Convert functions to CodeFunction instances
    const codeFunctions = data.functions.map(projectFunctionToCodeFunction);
    
    // If this is sample data (no UI state), return minimal data
    if (!hasUIState(data)) {
      return {
        projectName: data.projectName,
        codeFunctions
      };
    }
    
    // Generate positions using placement algorithm for sample data
    const nodes: Node[] = [];
    const existingNodes: Node[] = [];
    
    for (let index = 0; index < data.functions.length; index++) {
      const func = data.functions[index];
      let ui: NonNullable<ProjectFunction['ui']>;
      
      if (functionHasUIState(func)) {
        ui = func.ui;
      } else {
        // For sample data without UI state, generate position using placement algorithm
        const startPosition = { x: 100, y: 100 }; // Starting point for first node
        const optimalPosition = findOptimalNodePlacement(startPosition, existingNodes);
        ui = {
          id: `function-${index}`,
          position: optimalPosition,
          selected: false,
          dragging: false,
          width: NODE_WIDTH,
          height: calculateNodeHeight(func) // Use actual calculated height
        };
      }
      
      // Ensure position is always defined
      if (!ui.position) {
        throw new Error(`Function ${index} missing position in UI state`);
      }
      
      const node: Node = {
        id: ui.id || `function-${index}`,
        type: 'methodNode',
        position: ui.position,
        data: { functionIndex: index },
        selected: ui.selected || false,
        dragging: ui.dragging || false,
        width: ui.width || 280,
        height: ui.height || 200
      };
      
      nodes.push(node);
      existingNodes.push(node); // Add to existing nodes for next placement calculation
    }
    
    return {
      projectName: data.projectName,
      codeFunctions,
      nodes,
      edges: data.ui.edges || [],
      viewport: data.ui.viewport
    };
    
  } catch (error) {
    console.error('Failed to load project data:', error);
    // Return default data if loading fails
    return {
      projectName: 'DefaultProject',
      codeFunctions: []
    };
  }
};

// Save current state to ProjectData format
export const saveProjectData = (
  projectName: string,
  codeFunctions: CodeFunction[],
  nodes?: Node[],
  edges?: Edge[],
  viewport?: { x: number; y: number; zoom: number }
): ProjectData => {
  const functions: ProjectFunction[] = codeFunctions.map((func, index) => {
    let ui: ProjectFunction['ui'] | undefined;
    
    // If we have UI data, include it
    if (nodes) {
      const node = nodes.find(n => n.data?.functionIndex === index);
      if (node) {
        ui = {
          id: node.id,
          position: node.position,
          selected: node.selected || false,
          dragging: node.dragging || false,
          width: node.width || 280,
          height: node.height || 200
        };
      }
    }
    
    return codeFunctionToProjectFunction(func, ui);
  });
  
  const projectData: ProjectData = {
    projectName,
    functions,
    version: '1.0',
    created: new Date().toISOString(),
    modified: new Date().toISOString()
  };
  
  // Add UI state if available
  if (nodes || edges || viewport) {
    projectData.ui = {
      viewport: viewport || { x: 0, y: 0, zoom: 1 },
      edges: (edges || []).map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        targetHandle: edge.targetHandle || undefined,
        type: edge.type || undefined
      })),
      selectedNodes: nodes?.filter(n => n.selected).map(n => n.id) || [],
      selectedEdges: edges?.filter(e => e.selected).map(e => e.id) || []
    };
  }
  
  return projectData;
};
