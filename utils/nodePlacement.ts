import { Node } from 'reactflow';
import { NODE_CONSTANTS } from '../constants/nodeConstants';

export interface PlacementOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  margin?: number;
  searchRadius?: number;
  gridSize?: number;
}

const DEFAULT_OPTIONS: Required<PlacementOptions> = {
  nodeWidth: NODE_CONSTANTS.WIDTH,
  nodeHeight: NODE_CONSTANTS.MIN_HEIGHT,
  margin: NODE_CONSTANTS.MARGIN,
  searchRadius: NODE_CONSTANTS.SEARCH_RADIUS,
  gridSize: NODE_CONSTANTS.GRID_SIZE,
};

/**
 * Find the optimal position to place a new node near a target position.
 * 
 * COORDINATE SYSTEM:
 * - Origin (0,0) is at the top-left of the React Flow canvas
 * - Positive X goes RIGHT, Positive Y goes DOWN (standard web coordinates)
 * - Node positions represent the TOP-LEFT corner of the node
 * - All measurements are in pixels
 * 
 * Algorithm:
 * 1. Start from the target position (e.g., viewport center, mouse click)
 * 2. Search in expanding circles for a free area
 * 3. Check collision with existing nodes (including margin)
 * 4. Snap to grid for clean positioning
 * 5. Return the first available position found
 * 
 * @param targetPosition The desired position to place the node near (top-left corner)
 * @param existingNodes Array of existing nodes to avoid collisions with
 * @param options Configuration options for placement algorithm
 * @returns The optimal position for the new node (top-left corner)
 */
export function findOptimalNodePlacement(
  targetPosition: { x: number; y: number },
  existingNodes: Node[],
  options: PlacementOptions = {}
): { x: number; y: number } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  console.log('🎯 Node Placement Algorithm Started');
  console.log('📍 Target Position:', targetPosition);
  console.log('⚙️ Options:', opts);
  console.log('🏗️ Existing Nodes:', existingNodes.length, 'nodes');
  
  // Log existing node positions for debugging
  existingNodes.forEach((node, i) => {
    console.log(`   Node ${i}: ${node.id} at (${node.position.x}, ${node.position.y}) size: ${node.width || opts.nodeWidth}x${node.height || opts.nodeHeight}`);
  });
  
  // Helper function to check if a position collides with existing nodes
  const hasCollision = (x: number, y: number, logDetails = false): boolean => {
    // Test rectangle for new node (no margin padding)
    const testRect = {
      left: x,
      right: x + opts.nodeWidth,
      top: y,
      bottom: y + opts.nodeHeight,
    };
    
    if (logDetails) {
      console.log(`🔍 Testing position (${x}, ${y}) - Test rect:`, testRect);
    }
    
    const collision = existingNodes.some((node, i) => {
      // Existing node rectangle with margin padding
      const nodeRect = {
        left: node.position.x - opts.margin,
        right: node.position.x + (node.width || opts.nodeWidth) + opts.margin,
        top: node.position.y - opts.margin,
        bottom: node.position.y + (node.height || opts.nodeHeight) + opts.margin,
      };
      
      const hasOverlap = !(
        testRect.right < nodeRect.left ||
        testRect.left > nodeRect.right ||
        testRect.bottom < nodeRect.top ||
        testRect.top > nodeRect.bottom
      );
      
      if (logDetails && hasOverlap) {
        console.log(`   ❌ Collision with Node ${i} (${node.id}):`);
        console.log(`      Node rect (with margin):`, nodeRect);
        console.log(`      Overlap detected`);
      }
      
      return hasOverlap;
    });
    
    if (logDetails) {
      console.log(`   ${collision ? '❌ COLLISION' : '✅ FREE'} at (${x}, ${y})`);
    }
    
    return collision;
  };
  
  // Helper function to snap position to grid
  const snapToGrid = (x: number, y: number) => ({
    x: Math.round(x / opts.gridSize) * opts.gridSize,
    y: Math.round(y / opts.gridSize) * opts.gridSize,
  });
  
  // Start from target position, snapped to grid
  // Note: We center the node on the target position by offsetting by half the node size
  const startPos = snapToGrid(
    targetPosition.x - opts.nodeWidth / 2,
    targetPosition.y - opts.nodeHeight / 2
  );
  
  console.log('📐 Start position (target centered, snapped to grid):', startPos);
  
  // Check if the center position is free
  console.log('🎯 Testing center position first...');
  if (!hasCollision(startPos.x, startPos.y, true)) {
    console.log('✅ CENTER POSITION IS FREE! Using:', startPos);
    return startPos;
  }
  
  console.log('❌ Center position occupied, starting grid search...');
  
  // Generate all nearby grid positions and sort by distance (much simpler and more effective)
  const positions: { x: number; y: number; distance: number }[] = [];
  const step = opts.gridSize;
  const maxDistance = opts.searchRadius;
  
  console.log(`🔍 Generating grid positions within radius ${maxDistance}px, step ${step}px...`);
  
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
  
  console.log(`📊 Generated ${positions.length} candidate positions`);
  
  // Sort all positions by distance from center (closest first)
  positions.sort((a, b) => a.distance - b.distance);
  
  console.log('🔄 Testing positions in order of distance from center...');
  
  // Test each position in order of distance
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    const isFirst = i === 0;
    const isEvery10th = i % 10 === 0;
    const logDetails = isFirst || isEvery10th || i < 5; // Log first few and every 10th
    
    if (logDetails) {
      console.log(`🧪 Testing position ${i + 1}/${positions.length}: (${pos.x}, ${pos.y}) distance: ${pos.distance.toFixed(1)}px`);
    }
    
    if (!hasCollision(pos.x, pos.y, logDetails)) {
      console.log(`🎉 FOUND FREE POSITION at attempt ${i + 1}: (${pos.x}, ${pos.y}) distance: ${pos.distance.toFixed(1)}px`);
      return { x: pos.x, y: pos.y };
    }
  }
  
  console.log('⚠️ No free positions found in grid search, using fallback...');
  
  // Fallback: place to the right of the rightmost node
  const rightmostX = Math.max(
    ...existingNodes.map(node => node.position.x + (node.width || opts.nodeWidth)),
    targetPosition.x
  );
  
  const fallbackPos = snapToGrid(
    rightmostX + opts.margin * 2,
    targetPosition.y - opts.nodeHeight / 2
  );
  
  console.log(`🚨 FALLBACK POSITION: Rightmost X was ${rightmostX}, placing at:`, fallbackPos);
  console.log('🏁 Node Placement Algorithm Complete');
  
  return fallbackPos;
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
