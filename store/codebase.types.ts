import { type Node, type Edge, type NodeChange, type EdgeChange } from 'reactflow';

export enum CodeAspectType {
  IDENTIFIER = 'identifier',
  SIGNATURE = 'signature',
  SPECIFICATION = 'specification',
  IMPLEMENTATION = 'implementation',
}

export enum AspectState {
  UNSET = 'unset',
  AUTOGEN = 'autogen',
  EDITED = 'edited',
  LOCKED = 'locked'
}

export interface CodeAspectData {
  descriptor: string;
  state: AspectState;
}

export class CodeAspect implements CodeAspectData {
  constructor(
    public descriptor: string = '',
    public state: AspectState = AspectState.UNSET
  ) {}

  // For better string representation in logs and Redux DevTools
  toString() {
    return `${this.descriptor} [${this.state}]`;
  }
  
  // For custom JSON serialization
  toJSON() {
    return {
      descriptor: this.descriptor,
      state: this.state,
      _summary: this.toString()
    };
  }
}

export interface CodeFunctionData {
  identifier: Partial<CodeAspectData>;
  signature: Partial<CodeAspectData>;
  specification: Partial<CodeAspectData>;
  implementation: Partial<CodeAspectData>;
  code: string;
}

export class CodeFunction {
  
  constructor(
    public identifier: CodeAspect = new CodeAspect(),
    public signature: CodeAspect = new CodeAspect(),
    public specification: CodeAspect = new CodeAspect(),
    public implementation: CodeAspect = new CodeAspect(),
    public code: string = '',
  ) {
    
  }

  // For better string representation in logs and Redux DevTools
  toString() {
    return `Function: ${this.identifier.descriptor} :: ${this.signature.descriptor}`;
  }
  
  // For custom JSON serialization
  toJSON() {
    return {
      identifier: this.identifier,
      signature: this.signature,
      specification: this.specification,
      implementation: this.implementation,
      code: this.code,
      _summary: this.toString()
    };
  }
}

// Data structure for React Flow nodes
export interface FlowNodeData {
  functionIndex: number;
}

export interface CodebaseState {
  // Core data model
  projectName: string;
  codeFunctions: CodeFunction[];
  nodePositions: { [functionIndex: number]: { x: number; y: number } }; // Store positions for each function
  
  // Core actions
  updateProjectName: (name: string) => void;
  addCodeFunction: (position: { x: number; y: number }) => void;
  updateCodeFunction: (index: number, func: Partial<CodeFunction>) => void;
  removeCodeFunction: (index: number) => void;
  loadProjectFromFile: () => Promise<void>;
  setNodePosition: (index: number, position: { x: number; y: number }) => void;

  // Undo/Redo history (snapshot-based)
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // React Flow state
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  updateNodePosition: (id: string) => void;
}
