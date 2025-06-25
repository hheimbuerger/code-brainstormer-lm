import { type Node, type Edge, type NodeChange, type EdgeChange } from 'reactflow';

export enum AspectState {
  UNSET = 'unset',
  AUTOGEN = 'autogen',
  EDITED = 'edited',
  LOCKED = 'locked'
}

export interface CodeFieldData {
  descriptor: string;
  state: AspectState;
  code: string;
}

export class CodeField implements CodeFieldData {
  constructor(
    public descriptor: string = '',
    public state: AspectState = AspectState.UNSET,
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

export interface CodeMethodData {
  identifier: Partial<CodeFieldData>;
  signature: Partial<CodeFieldData>;
  specification: Partial<CodeFieldData>;
  implementation: Partial<CodeFieldData>;
}

export class CodeMethod {
  
  constructor(
    public identifier: CodeField = new CodeField(),
    public signature: CodeField = new CodeField(),
    public specification: CodeField = new CodeField(),
    public implementation: CodeField = new CodeField(),
  ) {
    
  }

  // For better string representation in logs and Redux DevTools
  toString() {
    return `Method: ${this.identifier.descriptor} :: ${this.signature.descriptor}`;
  }
  
  // For custom JSON serialization
  toJSON() {
    return {
      identifier: this.identifier,
      signature: this.signature,
      specification: this.specification,
      implementation: this.implementation,
      
      _summary: this.toString()
    };
  }
}

// Data structure for React Flow nodes
export interface FlowNodeData {
  methodIndex: number;
}

export interface CodebaseState {
  // Core data model
  codeClass: CodeField;
  codeMethods: CodeMethod[];
  externalClasses: string[];
  
  // Core actions
  updateCodeClass: (field: Partial<CodeField>) => void;
  addCodeMethod: () => void;
  updateCodeMethod: (index: number, method: Partial<CodeMethod>) => void;
  removeCodeMethod: (index: number) => void;
  
  // External classes management
  addExternalClass: (className: string) => void;
  removeExternalClass: (index: number) => void;

  // React Flow state
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  updateNodePosition: (id: string) => void;
}
