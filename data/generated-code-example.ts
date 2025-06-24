import { GenField, GenMethod, AspectState } from '../store/codebase.types';

// Example class definition
export const exampleGenClass = new GenField(
  'ExampleClass',
  AspectState.PLANNED,
  'class ExampleClass {\n  // Class implementation will be generated here\n}'
);

// Example external classes that this class depends on
export const exampleExternalClasses = [
  'java.util.List',
  'com.example.utilities.DataValidator',
  'com.example.models.DataModel'
];

// Example methods
export const exampleGenMethods: GenMethod[] = [
  // First method - Process Data
  new GenMethod(
    new GenField('processData', AspectState.EDITED, 'processData'),
    new GenField('Return Value', AspectState.AUTOGEN, 'ProcessedData'),
    new GenField(
      'Parameters',
      AspectState.AUTOGEN,
      'inputData: DataModel, options: Map<String, Object>'
    ),
    new GenField(
      'Specification', 
      AspectState.AUTOGEN, 
      'This node processes the input data and applies transformations.'
    ),
    new GenField(
      'Implementation', 
      AspectState.AUTOGEN, 
      'Handles data validation and normalization.'
    ),
    { x: 100, y: 100 }
  ),
  
  // Second method - Analyze Results
  new GenMethod(
    new GenField('analyzeResults', AspectState.EDITED, 'analyzeResults'),
    new GenField('Return Value', AspectState.AUTOGEN, 'AnalysisReport'),
    new GenField(
      'Parameters',
      AspectState.AUTOGEN,
      'data: List<ProcessedData>, config: AnalysisConfig'
    ),
    new GenField(
      'Specification',
      AspectState.AUTOGEN,
      'Performs analysis on the processed data.'
    ),
    new GenField(
      'Implementation',
      AspectState.AUTOGEN,
      'Generates insights and statistics.'
    ),
    { x: 400, y: 100 }
  )
];
