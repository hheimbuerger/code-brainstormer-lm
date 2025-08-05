import { AspectState } from '../store/codebase.types';

/**
 * Unified JSON schema that supports both:
 * 1. Minimal sample data (UI fields omitted, system generates them)
 * 2. Full persisted frontend state (includes all UI positioning/IDs)
 */

export interface ProjectAspect {
  descriptor: string;
  state: AspectState | string; // Allow string for JSON compatibility
}

export interface ProjectFunction {
  // Core function data (always present)
  identifier: ProjectAspect;
  signature: ProjectAspect;
  specification: ProjectAspect;
  implementation: ProjectAspect;
  code: string;
  
  // UI-specific fields (optional - only in persisted state)
  ui?: {
    id?: string;           // React Flow node ID
    position?: {           // Node position on canvas
      x: number;
      y: number;
    };
    selected?: boolean;    // Selection state
    dragging?: boolean;    // Drag state
    width?: number;        // Node dimensions
    height?: number;
  };
}

export interface ProjectData {
  // Core project data (always present)
  projectName: string;
  functions: ProjectFunction[];
  
  // Metadata
  version?: string;        // Schema version for future compatibility
  created?: string;        // ISO timestamp
  modified?: string;       // ISO timestamp
  
  // UI-specific fields (optional - only in persisted state)
  ui?: {
    viewport?: {           // Canvas viewport state
      x: number;
      y: number;
      zoom: number;
    };
    edges?: Array<{        // React Flow edges
      id: string;
      source: string;
      target: string;
      sourceHandle?: string;
      targetHandle?: string;
      type?: string;
    }>;
    selectedNodes?: string[];  // Selected node IDs
    selectedEdges?: string[];  // Selected edge IDs
  };
}

/**
 * Type guards to check if data includes UI state
 */
export const hasUIState = (data: ProjectData): data is ProjectData & { ui: NonNullable<ProjectData['ui']> } => {
  return data.ui !== undefined;
};

export const functionHasUIState = (func: ProjectFunction): func is ProjectFunction & { ui: NonNullable<ProjectFunction['ui']> } => {
  return func.ui !== undefined;
};

/**
 * Default UI state generators for when loading sample data
 */
export const generateDefaultFunctionUI = (index: number): NonNullable<ProjectFunction['ui']> => ({
  id: `function-${index}`,
  position: {
    x: 100 + (index % 3) * 300,  // Arrange in grid
    y: 100 + Math.floor(index / 3) * 200
  },
  selected: false,
  dragging: false,
  width: 280,
  height: 200
});

export const generateDefaultProjectUI = (): NonNullable<ProjectData['ui']> => ({
  viewport: {
    x: 0,
    y: 0,
    zoom: 1
  },
  edges: [],
  selectedNodes: [],
  selectedEdges: []
});

/**
 * Helper to convert string state to AspectState enum
 */
export const parseAspectState = (state: string | AspectState): AspectState => {
  if (typeof state === 'string') {
    switch (state.toLowerCase()) {
      case 'edited':
        return AspectState.EDITED;
      case 'autogen':
        return AspectState.AUTOGEN;
      case 'locked':
        return AspectState.LOCKED;
      case 'unset':
      default:
        return AspectState.UNSET;
    }
  }
  return state;
};

/**
 * Schema validation helpers
 */
export const validateProjectData = (data: any): data is ProjectData => {
  return (
    typeof data === 'object' &&
    typeof data.projectName === 'string' &&
    Array.isArray(data.functions) &&
    data.functions.every(validateProjectFunction)
  );
};

export const validateProjectFunction = (func: any): func is ProjectFunction => {
  return (
    typeof func === 'object' &&
    validateProjectAspect(func.identifier) &&
    validateProjectAspect(func.signature) &&
    validateProjectAspect(func.specification) &&
    validateProjectAspect(func.implementation) &&
    typeof func.code === 'string'
  );
};

export const validateProjectAspect = (aspect: any): aspect is ProjectAspect => {
  return (
    typeof aspect === 'object' &&
    typeof aspect.descriptor === 'string' &&
    (typeof aspect.state === 'string' || Object.values(AspectState).includes(aspect.state))
  );
};
