# User Interactions & UX Guide

_Last updated 2025-08-06 by Cascade assistant_

## Overview

This document describes all user interactions available in Code-Brainstormer LM, with particular focus on the double-click behaviors and node creation UX that have been carefully designed for intuitive workflow.

## Double-Click Behaviors

### 1. Canvas Double-Click (Create Empty Function)

**Action**: Double-click on empty canvas space  
**Result**: Creates a new empty function node at the click position

**Behavior**:
- ✅ **Node Placement**: Uses intelligent placement algorithm to find closest available grid position (20px grid) with 50px minimum margin from existing nodes
- ✅ **Smooth Navigation**: Viewport animates smoothly (800ms) to center on the new node while preserving current zoom level
- ✅ **Auto-Focus**: Identifier field automatically enters edit mode with cursor positioned for immediate typing
- ✅ **Grid Alignment**: Node snaps to clean 20px grid for professional layouts

**Use Case**: Starting a new function from scratch - user needs to type the function name immediately.

### 2. Function Reference Double-Click (Create Named Function)

**Action**: Double-click on an orange function reference (unresolved function call) within implementation text

**Result**: Creates a new function node with pre-filled identifier based on the function call

**Behavior**:
- ✅ **Node Placement**: Places node near the source function using the same intelligent placement algorithm
- ✅ **Smooth Navigation**: Viewport animates smoothly (800ms) to center on the new node while preserving current zoom level
- ✅ **Pre-filled Identifier**: Function name is automatically extracted from the function call (e.g., `processData()` → identifier: "processData")
- ✅ **No Auto-Focus**: Identifier field remains in display mode since it's already correctly named
- ✅ **Ready for Specification**: User can immediately start defining the function's purpose and behavior

**Use Case**: Following through on a function call reference - the name is already known, user wants to define what the function should do.

### 3. Existing Function Reference Double-Click (Navigate to Function)

**Action**: Double-click on a blue function reference (resolved function call) within implementation text

**Result**: Navigates to the existing function node

**Behavior**:
- ✅ **Smooth Navigation**: Viewport animates smoothly (800ms) to center on the existing function node while preserving current zoom level
- ✅ **No Changes**: Existing function remains unchanged - this is pure navigation
- ✅ **Visual Feedback**: Smooth animation helps user understand the relationship between function call and function definition

**Use Case**: Exploring code relationships - user wants to see the definition of a function they're calling.

## Visual Indicators

### Function Call Styling

Function calls within implementation text are visually distinguished:

- **Blue Text with Handle**: Existing functions (clickable for navigation)
  - Hover: Underline appears
  - Double-click: Navigate to function
  - Handle: Small circle for edge connections

- **Orange Text with Asterisk (*)**: Non-existent functions (clickable for creation)
  - Pulsing orange color for attention
  - Asterisk indicator shows it's unresolved
  - Double-click: Create new function
  - Tooltip: "Double-click to create this function"

## Node Placement Algorithm

### How It Works

1. **Starting Point**: Uses click position (for canvas) or near source function (for references)
2. **Grid Snapping**: All positions snap to 20px grid for clean alignment
3. **Collision Detection**: Ensures 50px minimum margin between node edges
4. **Distance-Based Search**: Finds the closest available position using comprehensive distance-based search
5. **Fallback**: If no position found within 400px radius, places to the right of rightmost node

### Algorithm Parameters

- **Node Dimensions**: 200px width × 120px height
- **Grid Size**: 20px (all positions snap to this grid)
- **Minimum Margin**: 50px between node edges
- **Search Radius**: 400px maximum search distance
- **Fallback Spacing**: 100px (2× margin) for fallback placement

### Why This Approach

- **Predictable**: Always finds the closest available spot
- **Consistent**: Same behavior regardless of creation method
- **Professional**: Grid alignment creates clean, organized layouts
- **Space-Efficient**: Utilizes available space effectively without overcrowding

## Viewport Navigation & Animation

### Animation Characteristics

- **Duration**: 800ms smooth animation
- **Easing**: Built-in React Flow easing for natural movement
- **Zoom Preservation**: Current zoom level is maintained during navigation
- **Centering**: Node center is positioned at viewport center

### Implementation Details

- Uses React Flow's `setViewport()` with animation options
- Calculates node center using actual node dimensions (100px, 60px from top-left)
- Accounts for current zoom level in positioning calculations
- Small delay (100ms) ensures node is rendered before navigation

## Auto-Focus Behavior

### When Auto-Focus Triggers

- ✅ **Canvas Double-Click**: Empty identifier needs user input
- ❌ **Function Reference Double-Click**: Identifier already filled

### Implementation Details

- **Timing**: 100ms delay ensures textarea is fully rendered
- **Cursor Position**: Placed at end of existing text
- **Auto-Resize**: Field automatically resizes to fit content
- **Duration**: Auto-focus state clears after 1 second to prevent interference

### Why Selective Auto-Focus

- **Empty nodes**: User needs to type immediately → Auto-focus helps
- **Named nodes**: Identifier already correct → Auto-focus would be disruptive
- **Workflow optimization**: Reduces unnecessary interruptions

## Edge Connections

### Automatic Edge Creation

- **Source**: Function calls in implementation text
- **Target**: Matching function identifiers
- **Positioning**: Edges connect to nearest node sides for optimal routing
- **Dynamic Updates**: Edges recalculate when nodes are moved

### Visual Feedback

- **Hover Highlighting**: Edges highlight when hovering over corresponding function calls
- **Handle Visibility**: Small circular handles appear on function calls for visual connection
- **Smart Routing**: React Flow automatically routes edges around obstacles

## Best Practices for Users

### Creating Functions

1. **Start with Canvas Double-Click** for completely new functions
2. **Use Function Reference Double-Click** when you know the function name from a call
3. **Let the placement algorithm work** - it will find optimal positions
4. **Use the auto-focus** for empty nodes to start typing immediately

### Navigation

1. **Double-click blue function references** to explore code relationships
2. **Use smooth animations** to understand spatial relationships
3. **Zoom and pan freely** - navigation preserves your view settings

### Layout Organization

1. **Trust the grid alignment** for professional layouts
2. **Drag nodes to reorganize** if needed - edges will update automatically
3. **Use the 50px margins** to maintain readable spacing
4. **Leverage the placement algorithm** for consistent spacing

## Technical Implementation Notes

### Key Components

- **ProjectCanvas.tsx**: Main canvas with double-click handlers and viewport control
- **FunctionNode.tsx**: Individual nodes with function reference rendering and click handling
- **nodePlacement.ts**: Intelligent placement algorithm with collision detection
- **EditableField.tsx**: Auto-focus and editing behavior for node fields

### State Management

- **Auto-focus state**: Tracked at canvas level, passed to nodes via data props
- **Node positions**: Stored in Zustand store, synchronized with React Flow
- **Viewport state**: Managed by React Flow with programmatic control for animations

### Performance Considerations

- **Placement algorithm**: O(n²) complexity but optimized for typical node counts
- **Animation timing**: Balanced for smooth UX without blocking interactions
- **State updates**: Minimal re-renders through careful dependency management
