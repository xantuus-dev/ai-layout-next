/**
 * Agent System - Core Type Definitions
 *
 * This file defines all types and interfaces for the autonomous agent system.
 */

// ============================================================================
// AGENT TYPES
// ============================================================================

/**
 * Types of agents available in the system
 */
export type AgentType =
  | 'browser_automation'    // Web scraping and browser control
  | 'email_campaign'        // Email automation
  | 'data_processing'       // Data manipulation and enrichment
  | 'research'              // Information gathering and analysis
  | 'social_media'          // Social media management
  | 'custom';               // User-defined agent

/**
 * Agent execution status
 */
export type AgentStatus =
  | 'pending'      // Waiting to start
  | 'planning'     // Creating execution plan
  | 'executing'    // Running the plan
  | 'paused'       // Temporarily stopped
  | 'completed'    // Successfully finished
  | 'failed'       // Execution failed
  | 'cancelled';   // User cancelled

/**
 * Step execution status
 */
export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

// ============================================================================
// AGENT CONFIGURATION
// ============================================================================

/**
 * Base configuration for all agents
 */
export interface AgentConfig {
  model?: string;           // AI model to use
  temperature?: number;     // Response randomness (0-1)
  maxTokens?: number;       // Max tokens per step
  maxSteps?: number;        // Max steps before stopping
  timeout?: number;         // Max execution time (ms)
  retryCount?: number;      // Number of retries on failure
  requireApproval?: boolean; // Require human approval for critical actions
}

/**
 * Browser automation agent config
 */
export interface BrowserAgentConfig extends AgentConfig {
  headless?: boolean;
  userAgent?: string;
  viewport?: { width: number; height: number };
  waitForNetwork?: boolean;
}

/**
 * Email campaign agent config
 */
export interface EmailAgentConfig extends AgentConfig {
  sender?: string;
  replyTo?: string;
  batchSize?: number;
  delayBetweenEmails?: number; // ms
}

/**
 * Data processing agent config
 */
export interface DataAgentConfig extends AgentConfig {
  inputFormat?: 'csv' | 'json' | 'xml' | 'database';
  outputFormat?: 'csv' | 'json' | 'xml' | 'database';
  validationRules?: Record<string, any>;
}

// ============================================================================
// EXECUTION PLAN
// ============================================================================

/**
 * A single step in the execution plan
 */
export interface ExecutionStep {
  id: string;
  stepNumber: number;
  action: string;          // e.g., "browser.navigate", "email.send"
  description: string;     // Human-readable description
  tool: string;            // Tool name (browser, email, http, etc.)
  params: Record<string, any>; // Tool parameters
  dependencies?: string[]; // IDs of steps that must complete first
  retryable?: boolean;     // Can this step be retried?
  requiresApproval?: boolean; // Needs human approval before execution?
  estimatedCredits?: number;
  estimatedDuration?: number; // ms
}

/**
 * Complete execution plan created by the planner
 */
export interface ExecutionPlan {
  taskId: string;
  steps: ExecutionStep[];
  totalSteps: number;
  estimatedCredits: number;
  estimatedDuration: number; // ms
  createdAt: Date;
  metadata?: Record<string, any>;
}

// ============================================================================
// AGENT STATE
// ============================================================================

/**
 * Current state of an executing agent
 */
export interface AgentState {
  taskId: string;
  status: AgentStatus;
  currentStep: number;
  totalSteps: number;
  progress: number;         // 0-100

  // Execution tracking
  startedAt?: Date;
  lastActivityAt?: Date;
  completedAt?: Date;

  // Resources
  creditsUsed: number;
  tokensUsed: number;
  executionTime: number;    // ms

  // Results
  result?: any;
  error?: string;

  // Context that persists between steps
  context: Record<string, any>;

  // Trace of all actions taken
  trace: ExecutionTrace[];
}

/**
 * A single entry in the execution trace
 */
export interface ExecutionTrace {
  stepNumber: number;
  timestamp: Date;
  action: string;
  tool: string;
  reasoning?: string;       // Agent's reasoning for this action
  input: any;
  output?: any;
  error?: string;
  status: StepStatus;
  duration: number;         // ms
  credits: number;
  tokens: number;
}

// ============================================================================
// TOOLS
// ============================================================================

/**
 * Base interface for all agent tools
 */
export interface AgentTool {
  name: string;
  description: string;
  category: 'browser' | 'communication' | 'data' | 'integration' | 'utility';

  // Validate tool parameters
  validate(params: any): { valid: boolean; error?: string };

  // Execute the tool
  execute(params: any, context: AgentContext): Promise<ToolResult>;

  // Estimate credit cost for this operation
  estimateCost(params: any): number;
}

/**
 * Result from tool execution
 */
export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    duration: number;     // ms
    credits: number;
    tokens?: number;
  };
}

/**
 * Context passed to tools during execution
 */
export interface AgentContext {
  userId: string;
  taskId: string;
  stepNumber: number;
  state: AgentState;

  // Available services
  prisma: any;              // Database client
  aiRouter: any;            // AI provider router

  // User's integrations
  googleAuth?: {
    accessToken: string;
    refreshToken: string;
  };

  // Shared state between steps
  memory: Record<string, any>;
}

// ============================================================================
// AGENT INTERFACES
// ============================================================================

/**
 * Main agent interface
 */
export interface Agent {
  readonly type: AgentType;
  readonly config: AgentConfig;

  /**
   * Create execution plan for a task
   */
  plan(task: AgentTask): Promise<ExecutionPlan>;

  /**
   * Execute a task with the given plan
   */
  execute(task: AgentTask, plan: ExecutionPlan): Promise<AgentResult>;

  /**
   * Pause execution (save state for later resume)
   */
  pause(): Promise<void>;

  /**
   * Resume paused execution
   */
  resume(state: AgentState): Promise<AgentResult>;

  /**
   * Cancel execution
   */
  cancel(): Promise<void>;
}

/**
 * Task to be executed by an agent
 */
export interface AgentTask {
  id: string;
  userId: string;
  type: AgentType;
  goal: string;             // User's goal in natural language
  config: AgentConfig;
  context?: Record<string, any>; // Additional context
  priority?: number;
  createdAt: Date;
}

/**
 * Final result from agent execution
 */
export interface AgentResult {
  taskId: string;
  status: AgentStatus;
  result?: any;
  error?: string;

  // Metrics
  steps: number;
  duration: number;         // ms
  creditsUsed: number;
  tokensUsed: number;

  // Full trace
  trace: ExecutionTrace[];

  completedAt: Date;
}

// ============================================================================
// PLANNER
// ============================================================================

/**
 * Agent planner interface
 */
export interface AgentPlanner {
  /**
   * Analyze task and create execution plan
   */
  createPlan(task: AgentTask, availableTools: AgentTool[]): Promise<ExecutionPlan>;

  /**
   * Refine plan based on execution results
   */
  refinePlan(
    plan: ExecutionPlan,
    currentStep: number,
    stepResult: ToolResult
  ): Promise<ExecutionPlan>;
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

/**
 * Agent orchestrator configuration
 */
export interface OrchestratorConfig {
  maxConcurrentAgents: number;
  pollInterval: number;         // ms
  defaultTimeout: number;       // ms
  maxRetries: number;
}

/**
 * Agent orchestrator interface
 */
export interface AgentOrchestrator {
  /**
   * Start the orchestrator (begin polling for tasks)
   */
  start(): Promise<void>;

  /**
   * Stop the orchestrator
   */
  stop(): Promise<void>;

  /**
   * Get current status
   */
  getStatus(): OrchestratorStatus;

  /**
   * Manually trigger execution of a specific task
   */
  executeTask(taskId: string): Promise<void>;
}

/**
 * Orchestrator status
 */
export interface OrchestratorStatus {
  running: boolean;
  activeAgents: number;
  queuedTasks: number;
  completedToday: number;
  failedToday: number;
  uptime: number;             // ms
}

// ============================================================================
// EVENTS
// ============================================================================

/**
 * Events emitted by the agent system
 */
export type AgentEvent =
  | { type: 'task.created'; taskId: string; userId: string }
  | { type: 'task.started'; taskId: string; plan: ExecutionPlan }
  | { type: 'task.step.started'; taskId: string; stepNumber: number }
  | { type: 'task.step.completed'; taskId: string; stepNumber: number; result: ToolResult }
  | { type: 'task.step.failed'; taskId: string; stepNumber: number; error: string }
  | { type: 'task.paused'; taskId: string; state: AgentState }
  | { type: 'task.resumed'; taskId: string }
  | { type: 'task.completed'; taskId: string; result: AgentResult }
  | { type: 'task.failed'; taskId: string; error: string }
  | { type: 'task.cancelled'; taskId: string }
  | { type: 'approval.required'; taskId: string; stepNumber: number; action: string };

/**
 * Event handler type
 */
export type AgentEventHandler = (event: AgentEvent) => void | Promise<void>;
