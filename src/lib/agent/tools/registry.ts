/**
 * Tool Registry - Central registry for all agent tools
 *
 * This manages all available tools that agents can use.
 */

import { AgentTool } from '../types';

/**
 * Central registry for agent tools
 */
export class ToolRegistry {
  private tools = new Map<string, AgentTool>();

  /**
   * Register a tool
   */
  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }

    this.tools.set(tool.name, tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.name}`);
  }

  /**
   * Get a specific tool
   */
  getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAllTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getToolsByCategory(category: AgentTool['category']): AgentTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.category === category);
  }

  /**
   * Check if tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

/**
 * Global tool registry instance
 */
export const toolRegistry = new ToolRegistry();
