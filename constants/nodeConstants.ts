/**
 * Node dimension constants - Single source of truth for all node sizing
 * Used across placement algorithm, collision detection, and UI components
 */

export const NODE_CONSTANTS = {
  // Base node dimensions (without any scaling)
  WIDTH: 200,
  MIN_HEIGHT: 160,
  
  // Content-based height estimation
  HEADER_HEIGHT: 40,     // Header with identifier
  FIELD_HEIGHT: 25,      // Base height per field (signature, spec, impl)
  LINE_HEIGHT: 16,       // Height per line of text content
  PADDING: 20,           // Total vertical padding
  
  // Spacing and layout
  MARGIN: 30, // Increased margin for better spacing, especially above nodes
  GRID_SIZE: 20,
  
  // Placement algorithm settings
  SEARCH_RADIUS: 400,
} as const;

/**
 * Calculate the estimated height of a node based on its content
 * This helps with more accurate collision detection for variable-height nodes
 */
export function calculateNodeHeight(codeFunction: any): number {
  const { HEADER_HEIGHT, FIELD_HEIGHT, LINE_HEIGHT, PADDING, MIN_HEIGHT } = NODE_CONSTANTS;
  
  let estimatedHeight = HEADER_HEIGHT + PADDING;
  let debugInfo = `Header: ${HEADER_HEIGHT}, Padding: ${PADDING}`;
  
  // Add height for each aspect field
  const aspects = ['signature', 'specification', 'implementation'];
  aspects.forEach(aspect => {
    const content = codeFunction[aspect]?.descriptor || '';
    if (content.trim()) {
      const lines = Math.max(1, content.split('\n').length);
      const fieldHeight = FIELD_HEIGHT + (lines * LINE_HEIGHT);
      estimatedHeight += fieldHeight;
      debugInfo += `, ${aspect}: ${fieldHeight}px (${lines} lines)`;
    } else {
      estimatedHeight += FIELD_HEIGHT;
      debugInfo += `, ${aspect}: ${FIELD_HEIGHT}px (empty)`;
    }
  });
  
  const finalHeight = Math.max(MIN_HEIGHT, estimatedHeight);
  
  // Debug logging for initial placement issues
  // if (codeFunction.identifier?.descriptor) {
  //   console.log(`📏 Node height for '${codeFunction.identifier.descriptor}': ${finalHeight}px (${debugInfo})`);
  // }
  
  // Add extra buffer for safety to prevent overlaps
  return finalHeight + 10; // 10px safety buffer
}

// Export individual constants for convenience
export const NODE_WIDTH = NODE_CONSTANTS.WIDTH;
export const NODE_MIN_HEIGHT = NODE_CONSTANTS.MIN_HEIGHT;
export const NODE_MARGIN = NODE_CONSTANTS.MARGIN;
export const NODE_GRID_SIZE = NODE_CONSTANTS.GRID_SIZE;
export const NODE_SEARCH_RADIUS = NODE_CONSTANTS.SEARCH_RADIUS;
