/**
 * ConnectionLines Component
 *
 * SVG overlay showing connections between workflow nodes
 * - Bezier curves connecting nodes vertically
 * - Arrow markers at endpoints
 * - Animated dots during execution (optional)
 */

'use client';

import React from 'react';
import { CanvasNode } from '@/stores/workflow-builder-store';

interface ConnectionLinesProps {
  nodes: CanvasNode[];
}

/**
 * Calculate Bezier path between two nodes
 */
function calculateBezierPath(
  fromNode: CanvasNode,
  toNode: CanvasNode,
  nodeWidth: number = 400,
  nodeHeight: number = 100
): string {
  // Start point (bottom center of from node)
  const startX = fromNode.position.x + nodeWidth / 2;
  const startY = fromNode.position.y + nodeHeight;

  // End point (top center of to node)
  const endX = toNode.position.x + nodeWidth / 2;
  const endY = toNode.position.y;

  // Control points for smooth curve
  const controlOffset = Math.abs(endY - startY) / 2;

  return `M ${startX},${startY}
          C ${startX},${startY + controlOffset}
            ${endX},${endY - controlOffset}
            ${endX},${endY}`;
}

/**
 * Get connection line color based on execution state
 */
function getLineColor(fromNode: CanvasNode, toNode: CanvasNode): string {
  if (fromNode.executionState === 'completed' && toNode.executionState === 'running') {
    return 'rgb(59, 130, 246)'; // Blue for active
  }
  if (fromNode.executionState === 'completed' && toNode.executionState === 'completed') {
    return 'rgb(34, 197, 94)'; // Green for completed path
  }
  if (fromNode.executionState === 'failed') {
    return 'rgb(239, 68, 68)'; // Red for failed
  }
  return 'rgb(148, 163, 184)'; // Default gray
}

/**
 * Get stroke width based on execution state
 */
function getStrokeWidth(fromNode: CanvasNode, toNode: CanvasNode): number {
  if (fromNode.executionState === 'running' || toNode.executionState === 'running') {
    return 3; // Thicker for active
  }
  return 2; // Default
}

/**
 * ConnectionLines Component
 */
export function ConnectionLines({ nodes }: ConnectionLinesProps) {
  if (nodes.length < 2) {
    return null; // No connections needed for 0 or 1 nodes
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
      aria-hidden="true"
    >
      {/* Arrow Marker Definition */}
      <defs>
        {/* Default arrow */}
        <marker
          id="arrowhead-default"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3, 0 6" fill="rgb(148, 163, 184)" />
        </marker>

        {/* Active arrow (blue) */}
        <marker
          id="arrowhead-active"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3, 0 6" fill="rgb(59, 130, 246)" />
        </marker>

        {/* Completed arrow (green) */}
        <marker
          id="arrowhead-completed"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3, 0 6" fill="rgb(34, 197, 94)" />
        </marker>

        {/* Failed arrow (red) */}
        <marker
          id="arrowhead-failed"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon points="0 0, 10 3, 0 6" fill="rgb(239, 68, 68)" />
        </marker>
      </defs>

      {/* Connection Paths */}
      {nodes.slice(0, -1).map((node, index) => {
        const nextNode = nodes[index + 1];
        const path = calculateBezierPath(node, nextNode);
        const color = getLineColor(node, nextNode);
        const strokeWidth = getStrokeWidth(node, nextNode);

        // Determine marker ID based on state
        let markerId = 'arrowhead-default';
        if (node.executionState === 'completed' && nextNode.executionState === 'running') {
          markerId = 'arrowhead-active';
        } else if (node.executionState === 'completed' && nextNode.executionState === 'completed') {
          markerId = 'arrowhead-completed';
        } else if (node.executionState === 'failed') {
          markerId = 'arrowhead-failed';
        }

        return (
          <g key={`${node.id}-${nextNode.id}`}>
            {/* Main path */}
            <path
              d={path}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
              markerEnd={`url(#${markerId})`}
              className="transition-all duration-300"
            />

            {/* Conditional path styling (dashed) */}
            {node.type === 'conditional' && (
              <path
                d={path}
                stroke={color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray="5,5"
                markerEnd={`url(#${markerId})`}
                className="transition-all duration-300"
              />
            )}

            {/* Animated dot during execution */}
            {node.executionState === 'completed' && nextNode.executionState === 'running' && (
              <circle r="4" fill="rgb(59, 130, 246)">
                <animateMotion
                  dur="1.5s"
                  repeatCount="indefinite"
                  path={path}
                />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
