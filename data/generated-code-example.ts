import { CodeField, CodeMethod, AspectState } from '../store/codebase.types';

// Example class definition
export const exampleCodeClass = new CodeField(
  'ExampleClass',
  AspectState.UNSET,
  'class ExampleClass {\n  // Class implementation will be generated here\n}',
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
    new CodeField('processData', AspectState.EDITED, 'processData'),
    // signature (return type + params merged)
    new CodeField(
      buildSignature(
        'ProcessedData',
        'processData',
        'inputData: DataModel, options: Map<String, Object>',
      ),
      AspectState.AUTOGEN,
      '',
    ),
    // specification
    new CodeField(
      'This node processes the input data and applies transformations.',
      AspectState.AUTOGEN,
      '',
    ),
    // implementation
    new CodeField(
      'Handles data validation and normalization.',
      AspectState.AUTOGEN,
      '',
    ),
  ),

  // Second method - Analyze Results
  new CodeMethod(
    new CodeField('analyzeResults', AspectState.EDITED, 'analyzeResults'),
    new CodeField(
      buildSignature(
        'AnalysisReport',
        'analyzeResults',
        'data: List<ProcessedData>, config: AnalysisConfig',
      ),
      AspectState.AUTOGEN,
      '',
    ),
    new CodeField(
      'Performs analysis on the processed data.',
      AspectState.AUTOGEN,
      '',
    ),
    new CodeField(
      'Generates insights and statistics.',
      AspectState.AUTOGEN,
      '',
    ),
  ),
];
