import { Node } from 'reactflow';

export interface PlacementOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  margin?: number;
  searchRadius?: number;
  gridSize?: number;
}

const DEFAULT_OPTIONS: Required<PlacementOptions> = {
  nodeWidth: 200,
  nodeHeight: 120,
  margin: 50, // 25% of node width (280 * 0.25 = 70)
  searchRadius: 400,
  gridSize: 20,
};

/**
 * Find the optimal position to place a new node near the viewport center.
 * 
 * Algorithm:
 * 1. Start from the viewport center
 * 2. Search in expanding circles for a free area
 * 3. Check collision with existing nodes (including margin)
 * 4. Snap to grid for clean positioning
 * 5. Return the first available position found
 */
export function findOptimalNodePlacement(
  viewportCenter: { x: number; y: number },
  existingNodes: Node[],
  options: PlacementOptions = {}
): { x: number; y: number } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  // Helper function to check if a position collides with existing nodes
  const hasCollision = (x: number, y: number): boolean => {
    // Test rectangle for new node (no margin padding)
    const testRect = {
      left: x,
      right: x + opts.nodeWidth,
      top: y,
      bottom: y + opts.nodeHeight,
    };
    
    return existingNodes.some(node => {
      // Existing node rectangle with margin padding
      const nodeRect = {
        left: node.position.x - opts.margin,
        right: node.position.x + (node.width || opts.nodeWidth) + opts.margin,
        top: node.position.y - opts.margin,
        bottom: node.position.y + (node.height || opts.nodeHeight) + opts.margin,
      };
      
      return !(
        testRect.right < nodeRect.left ||
        testRect.left > nodeRect.right ||
        testRect.bottom < nodeRect.top ||
        testRect.top > nodeRect.bottom
      );
    });
  };
  
  // Helper function to snap position to grid
  const snapToGrid = (x: number, y: number) => ({
    x: Math.round(x / opts.gridSize) * opts.gridSize,
    y: Math.round(y / opts.gridSize) * opts.gridSize,
  });
  
  // Start from viewport center, snapped to grid
  const startPos = snapToGrid(
    viewportCenter.x - opts.nodeWidth / 2,
    viewportCenter.y - opts.nodeHeight / 2
  );
  
  // Check if the center position is free
  if (!hasCollision(startPos.x, startPos.y)) {
    return startPos;
  }
  
  // Generate all nearby grid positions and sort by distance (much simpler and more effective)
  const positions: { x: number; y: number; distance: number }[] = [];
  const step = opts.gridSize;
  const maxDistance = opts.searchRadius;
  
  // Generate all grid positions within search radius
  for (let dx = -maxDistance; dx <= maxDistance; dx += step) {
    for (let dy = -maxDistance; dy <= maxDistance; dy += step) {
      const x = startPos.x + dx;
      const y = startPos.y + dy;
      const snapped = snapToGrid(x, y);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Only include positions within the search radius
      if (distance <= maxDistance) {
        positions.push({ x: snapped.x, y: snapped.y, distance });
      }
    }
  }
  
  // Sort all positions by distance from center (closest first)
  positions.sort((a, b) => a.distance - b.distance);
  
  // Test each position in order of distance
  for (const pos of positions) {
    if (!hasCollision(pos.x, pos.y)) {
      return { x: pos.x, y: pos.y };
    }
  }
  
  // Fallback: place to the right of the rightmost node
  const rightmostX = Math.max(
    ...existingNodes.map(node => node.position.x + (node.width || opts.nodeWidth)),
    viewportCenter.x
  );
  
  return snapToGrid(
    rightmostX + opts.margin * 2,
    viewportCenter.y - opts.nodeHeight / 2
  );
}

/**
 * Center the viewport on a specific node position
 */
export function centerViewportOnNode(
  nodePosition: { x: number; y: number },
  nodeSize: { width: number; height: number },
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void,
  currentZoom: number = 1
) {
  // Calculate the center point of the node
  const nodeCenterX = nodePosition.x + nodeSize.width / 2;
  const nodeCenterY = nodePosition.y + nodeSize.height / 2;
  
  // Calculate viewport position to center the node
  // We need to account for the viewport size, but we'll use a reasonable default
  const viewportWidth = window.innerWidth || 1200;
  const viewportHeight = window.innerHeight || 800;
  
  const newViewport = {
    x: viewportWidth / 2 - nodeCenterX * currentZoom,
    y: viewportHeight / 2 - nodeCenterY * currentZoom,
    zoom: currentZoom,
  };
  
  setViewport(newViewport);
}
