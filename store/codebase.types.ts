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
  id?: string; // Stable unique identifier
  identifier: Partial<CodeAspectData>;
  signature: Partial<CodeAspectData>;
  specification: Partial<CodeAspectData>;
  implementation: Partial<CodeAspectData>;
  code: string;
  position?: { x: number; y: number }; // Store position with the function
}

export class CodeFunction {
  public id: string;
  public position: { x: number; y: number };
  
  constructor(
    public identifier: CodeAspect = new CodeAspect(),
    public signature: CodeAspect = new CodeAspect(),
    public specification: CodeAspect = new CodeAspect(),
    public implementation: CodeAspect = new CodeAspect(),
    public code: string = '',
    id?: string,
    position?: { x: number; y: number }
  ) {
    this.id = id || crypto.randomUUID();
    this.position = position || { x: 0, y: 0 };
  }

  // For better string representation in logs and Redux DevTools
  toString() {
    return `Function: ${this.identifier.descriptor} :: ${this.signature.descriptor}`;
  }
  
  // For custom JSON serialization
  toJSON() {
    return {
      id: this.id,
      identifier: this.identifier,
      signature: this.signature,
      specification: this.specification,
      implementation: this.implementation,
      code: this.code,
      position: this.position,
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
  
  // Core actions
  updateProjectName: (name: string) => void;
  addCodeFunction: (position: { x: number; y: number }) => string; // Returns the new function's ID
  updateCodeFunction: (id: string, func: Partial<CodeFunction>) => void;
  removeCodeFunction: (id: string) => void;
  loadProjectFromFile: () => Promise<void>;
  setNodePosition: (id: string, position: { x: number; y: number }) => void;

  // React Flow state
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  updateNodePosition: (id: string) => void;
}
