import { type Node, type Edge, type NodeChange, type EdgeChange } from 'reactflow';

export enum AspectState {
  PLANNED = 'planned',
  AUTOGEN = 'autogen',
  EDITED = 'edited'
}

export interface GenFieldData {
  descriptor: string;
  state: AspectState;
  code: string;
}

export class GenField implements GenFieldData {
  constructor(
    public descriptor: string = '',
    public state: AspectState = AspectState.PLANNED,
    public code: string = ''
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
      code: this.code,
      _summary: this.toString()
    };
  }
}

export interface Position {
  x: number;
  y: number;
}

export interface GenMethodData {
  identifier: Partial<GenFieldData>;
  returnValue: Partial<GenFieldData>;
  parameters: Partial<GenFieldData>;
  specification: Partial<GenFieldData>;
  implementation: Partial<GenFieldData>;
  position?: Partial<Position>;
}

export class GenMethod {
  position: Position;
  
  constructor(
    public identifier: GenField = new GenField(),
    public returnValue: GenField = new GenField(),
    public parameters: GenField = new GenField(),
    public specification: GenField = new GenField(),
    public implementation: GenField = new GenField(),
    position?: Position
  ) {
    this.position = position || { x: 0, y: 0 };
  }

  // For better string representation in logs and Redux DevTools
  toString() {
    return `Method: ${this.identifier.descriptor} -> ${this.returnValue.descriptor} (${this.position.x},${this.position.y})`;
  }
  
  // For custom JSON serialization
  toJSON() {
    return {
      identifier: this.identifier,
      returnValue: this.returnValue,
      specification: this.specification,
      implementation: this.implementation,
      position: this.position,
      _summary: this.toString()
    };
  }
}

// Data structure for React Flow nodes
export interface FlowNodeData {
  id: string;
  methodIndex: number;
}

export interface CodebaseState {
  // Core data model
  genClass: GenField;
  genMethods: GenMethod[];
  externalClasses: string[];
  
  // Core actions
  updateGenClass: (field: Partial<GenField>) => void;
  addGenMethod: () => void;
  updateGenMethod: (index: number, method: Partial<GenMethod>) => void;
  removeGenMethod: (index: number) => void;
  
  // External classes management
  addExternalClass: (className: string) => void;
  removeExternalClass: (index: number) => void;

  // React Flow state
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
}
