/**
 * Workflow Builder Store (Zustand)
 *
 * Manages state for the visual workflow builder:
 * - Canvas nodes and their positions
 * - Selected node for configuration
 * - Workflow metadata (name, description)
 * - Canvas viewport (zoom, pan)
 * - Execution state during monitoring
 */

import { create } from 'zustand';

// Node types supported by the workflow builder
export type NodeType = 'navigate' | 'click' | 'type' | 'extract' | 'wait' | 'conditional';

// Execution states for real-time monitoring
export type ExecutionState = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

// Error handling strategies
export type ErrorHandlingStrategy = 'stop' | 'continue' | 'retry' | 'ai_recovery';

/**
 * Canvas Node - Visual representation of a workflow step
 */
export interface CanvasNode {
  id: string;
  type: NodeType;
  position: {
    x: number;
    y: number;
  };
  config: {
    // Type-specific action configuration
    action: any;

    // Error handling
    onError: ErrorHandlingStrategy;
    maxRetries: number;
    retryDelay: number;

    // Conditional execution
    condition?: {
      variable: string;
      operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'exists';
      value: any;
    };
    skipIfFalse: boolean;

    // Output capture
    saveOutput: boolean;
    outputName?: string;
  };

  // Execution state (populated during monitoring)
  executionState?: ExecutionState;
  executionOutput?: any;
  executionError?: string;
}

/**
 * Workflow Builder State Interface
 */
interface WorkflowBuilderState {
  // ========== Canvas State ==========
  nodes: CanvasNode[];
  selectedNodeId: string | null;

  // Viewport controls
  zoom: number;
  panX: number;
  panY: number;

  // ========== Workflow Metadata ==========
  workflowId: string | null;
  workflowName: string;
  workflowDescription: string;

  // ========== UI State ==========
  isPalettePanelOpen: boolean;
  isConfigPanelOpen: boolean;
  isExecuting: boolean;
  executionId: string | null;

  // ========== Node Actions ==========
  /**
   * Add a new node to the canvas
   */
  addNode: (type: NodeType, position?: { x: number; y: number }) => void;

  /**
   * Remove a node from the canvas
   */
  removeNode: (id: string) => void;

  /**
   * Update a node's configuration
   */
  updateNode: (id: string, updates: Partial<CanvasNode>) => void;

  /**
   * Select a node for configuration
   */
  selectNode: (id: string | null) => void;

  /**
   * Reorder nodes (changes execution order)
   */
  reorderNodes: (fromIndex: number, toIndex: number) => void;

  /**
   * Update node position (for drag operations)
   */
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;

  // ========== Canvas Actions ==========
  /**
   * Set canvas zoom level (0.5 - 2.0)
   */
  setZoom: (zoom: number) => void;

  /**
   * Set canvas pan offset
   */
  setPan: (x: number, y: number) => void;

  /**
   * Reset viewport to default
   */
  resetView: () => void;

  // ========== Workflow Actions ==========
  /**
   * Load workflow from database
   */
  loadWorkflow: (workflowData: {
    id: string;
    name: string;
    description: string;
    nodes: CanvasNode[];
  }) => void;

  /**
   * Clear canvas and reset state
   */
  clearWorkflow: () => void;

  /**
   * Set workflow metadata
   */
  setWorkflowMetadata: (name: string, description: string) => void;

  // ========== Execution Monitoring ==========
  /**
   * Start execution monitoring
   */
  startExecution: (executionId: string) => void;

  /**
   * Update node execution states from trace
   */
  updateExecutionStates: (trace: Array<{
    stepId: string;
    status: ExecutionState;
    output?: any;
    error?: string;
  }>) => void;

  /**
   * Stop execution monitoring
   */
  stopExecution: () => void;

  // ========== UI Panel Toggles ==========
  togglePalettePanel: () => void;
  toggleConfigPanel: () => void;
}

/**
 * Generate unique node ID
 */
function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate auto-layout position for a node
 * Nodes are stacked vertically with 120px spacing (100px node + 20px gap)
 */
function calculateAutoPosition(index: number): { x: number; y: number } {
  return {
    x: 400, // Centered (assuming 300px node width)
    y: index * 120,
  };
}

/**
 * Default node configuration based on type
 */
function getDefaultConfig(type: NodeType): CanvasNode['config'] {
  const baseConfig: CanvasNode['config'] = {
    action: {},
    onError: 'retry',
    maxRetries: 3,
    retryDelay: 1000,
    skipIfFalse: false,
    saveOutput: false,
  };

  // Type-specific defaults
  switch (type) {
    case 'navigate':
      baseConfig.action = { url: '' };
      break;
    case 'click':
      baseConfig.action = { selector: '' };
      break;
    case 'type':
      baseConfig.action = { selector: '', value: '' };
      break;
    case 'extract':
      baseConfig.action = { selector: '' };
      baseConfig.saveOutput = true;
      baseConfig.outputName = 'extractedValue';
      break;
    case 'wait':
      baseConfig.action = { duration: 1000 };
      break;
    case 'conditional':
      baseConfig.condition = {
        variable: '',
        operator: 'equals',
        value: '',
      };
      baseConfig.skipIfFalse = true;
      break;
  }

  return baseConfig;
}

/**
 * Workflow Builder Store
 */
export const useWorkflowBuilderStore = create<WorkflowBuilderState>((set, get) => ({
  // ========== Initial State ==========
  nodes: [],
  selectedNodeId: null,
  zoom: 1.0,
  panX: 0,
  panY: 0,
  workflowId: null,
  workflowName: '',
  workflowDescription: '',
  isPalettePanelOpen: true,
  isConfigPanelOpen: true,
  isExecuting: false,
  executionId: null,

  // ========== Node Actions ==========
  addNode: (type, position) => {
    const { nodes } = get();
    const newNode: CanvasNode = {
      id: generateNodeId(),
      type,
      position: position || calculateAutoPosition(nodes.length),
      config: getDefaultConfig(type),
    };

    set({
      nodes: [...nodes, newNode],
      selectedNodeId: newNode.id, // Auto-select new node
      isConfigPanelOpen: true, // Open config panel
    });
  },

  removeNode: (id) => {
    const { nodes, selectedNodeId } = get();
    const newNodes = nodes.filter((n) => n.id !== id);

    set({
      nodes: newNodes,
      selectedNodeId: selectedNodeId === id ? null : selectedNodeId,
    });
  },

  updateNode: (id, updates) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, ...updates } : node
      ),
    });
  },

  selectNode: (id) => {
    set({
      selectedNodeId: id,
      isConfigPanelOpen: id !== null, // Open panel when node selected
    });
  },

  reorderNodes: (fromIndex, toIndex) => {
    const { nodes } = get();
    const newNodes = [...nodes];
    const [movedNode] = newNodes.splice(fromIndex, 1);
    newNodes.splice(toIndex, 0, movedNode);

    // Recalculate positions for auto-layout
    newNodes.forEach((node, index) => {
      node.position = calculateAutoPosition(index);
    });

    set({ nodes: newNodes });
  },

  updateNodePosition: (id, position) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, position } : node
      ),
    });
  },

  // ========== Canvas Actions ==========
  setZoom: (zoom) => {
    // Clamp zoom between 0.5 and 2.0
    const clampedZoom = Math.max(0.5, Math.min(2.0, zoom));
    set({ zoom: clampedZoom });
  },

  setPan: (x, y) => {
    set({ panX: x, panY: y });
  },

  resetView: () => {
    set({ zoom: 1.0, panX: 0, panY: 0 });
  },

  // ========== Workflow Actions ==========
  loadWorkflow: (workflowData) => {
    set({
      workflowId: workflowData.id,
      workflowName: workflowData.name,
      workflowDescription: workflowData.description,
      nodes: workflowData.nodes,
      selectedNodeId: null,
      zoom: 1.0,
      panX: 0,
      panY: 0,
    });
  },

  clearWorkflow: () => {
    set({
      workflowId: null,
      workflowName: '',
      workflowDescription: '',
      nodes: [],
      selectedNodeId: null,
      zoom: 1.0,
      panX: 0,
      panY: 0,
      isExecuting: false,
      executionId: null,
    });
  },

  setWorkflowMetadata: (name, description) => {
    set({ workflowName: name, workflowDescription: description });
  },

  // ========== Execution Monitoring ==========
  startExecution: (executionId) => {
    set({
      isExecuting: true,
      executionId,
      // Reset all node states to pending
      nodes: get().nodes.map((node) => ({
        ...node,
        executionState: 'pending',
        executionOutput: undefined,
        executionError: undefined,
      })),
    });
  },

  updateExecutionStates: (trace) => {
    const { nodes } = get();
    const traceMap = new Map(trace.map((t) => [t.stepId, t]));

    set({
      nodes: nodes.map((node) => {
        const traceEntry = traceMap.get(node.id);
        if (!traceEntry) return node;

        return {
          ...node,
          executionState: traceEntry.status,
          executionOutput: traceEntry.output,
          executionError: traceEntry.error,
        };
      }),
    });
  },

  stopExecution: () => {
    set({
      isExecuting: false,
      executionId: null,
    });
  },

  // ========== UI Panel Toggles ==========
  togglePalettePanel: () => {
    set({ isPalettePanelOpen: !get().isPalettePanelOpen });
  },

  toggleConfigPanel: () => {
    set({ isConfigPanelOpen: !get().isConfigPanelOpen });
  },
}));

/**
 * Selectors for computed values
 */

/**
 * Get selected node
 */
export const useSelectedNode = () => {
  const nodes = useWorkflowBuilderStore((state) => state.nodes);
  const selectedNodeId = useWorkflowBuilderStore((state) => state.selectedNodeId);

  return nodes.find((n) => n.id === selectedNodeId) || null;
};

/**
 * Check if workflow is valid (ready to save/execute)
 */
export const useIsWorkflowValid = () => {
  const nodes = useWorkflowBuilderStore((state) => state.nodes);
  const workflowName = useWorkflowBuilderStore((state) => state.workflowName);

  // Must have name and at least one node
  if (!workflowName.trim() || nodes.length === 0) {
    return false;
  }

  // Check all nodes have required config
  return nodes.every((node) => {
    switch (node.type) {
      case 'navigate':
        return !!node.config.action.url;
      case 'click':
      case 'type':
      case 'extract':
        return !!node.config.action.selector;
      case 'wait':
        return node.config.action.duration > 0;
      case 'conditional':
        return !!node.config.condition?.variable && !!node.config.condition?.operator;
      default:
        return true;
    }
  });
};
