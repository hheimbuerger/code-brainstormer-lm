import { CodeAspect, CodeMethod, AspectState } from '../store/codebase.types';

// Example class definition
export const exampleCodeClass = new CodeAspect(
  'ExampleClass',
  AspectState.UNSET
);

export const exampleExternalClasses = [
  'java.util.List',
  'com.example.utilities.DataValidator',
  'com.example.models.DataModel',
];

// Helper to create a signature descriptor string
const buildSignature = (
  returnType: string,
  name: string,
  params: string,
) => `${returnType} ${name}(${params})`;

// Example methods
export const exampleCodeMethods: CodeMethod[] = [
  // First method - Process Data
  new CodeMethod(
    // identifier
    new CodeAspect('start', AspectState.EDITED),
    // signature (return type + params merged)
    new CodeAspect(
      buildSignature(
        'ProcessedData',
        'processData',
        'inputData: DataModel, options: Map<String, Object>',
      ),
      AspectState.AUTOGEN,
    ),
    // specification
    new CodeAspect(
      'This node processes the input data and applies transformations.',
      AspectState.AUTOGEN,
    ),
    // implementation
    new CodeAspect(
      // 'Lorem ipsum dolor sit amet, consectetur formatText("lorem_ipsum") adipiscing elit. Sed do eiusmod tempor incididunt ut labore processData(3, 5) et dolore magna aliqua.',
      'formatText(1)',
      AspectState.AUTOGEN,
    ),
    '// TODO: Add example code here for method 1',
  ),

  // Second method - Analyze Results
  new CodeMethod(
    new CodeAspect('formatText', AspectState.EDITED),
    new CodeAspect(
      buildSignature(
        'AnalysisReport',
        'analyzeResults',
        'data: List<ProcessedData>, config: AnalysisConfig',
      ),
      AspectState.AUTOGEN,
    ),
    new CodeAspect(
      'Performs analysis on the processed data.',
      AspectState.AUTOGEN,
    ),
    new CodeAspect(
      'processData(2)',
      AspectState.AUTOGEN,
    ),
    '// TODO: Add example code here for method 2',
  ),

  // Third method - Process Data (placeholder)
  new CodeMethod(
    new CodeAspect('processData', AspectState.EDITED),
    new CodeAspect(
      buildSignature(
        'ProcessedData',
        'processData',
        'inputData: DataModel, options: Map<String, Object>',
      ),
      AspectState.AUTOGEN,
    ),
    // specification
    new CodeAspect(
      'This node processes the input data and applies transformations.',
      AspectState.AUTOGEN,
    ),
    new CodeAspect(
      'start(3)',
      AspectState.AUTOGEN,
    ),
    '// TODO: Add example code here for method 3',
  ),
];
