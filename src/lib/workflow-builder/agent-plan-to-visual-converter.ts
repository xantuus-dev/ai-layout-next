/**
 * Agent Plan to Visual Converter
 *
 * Converts existing agent execution plans (like competitor-price-monitor.ts)
 * to visual workflow canvas nodes for the workflow builder.
 */

import { CanvasNode } from '@/stores/workflow-builder-store';
import { ExecutionPlan, ExecutionStep } from '@/lib/agent/types';

/**
 * Convert an agent execution plan to visual canvas nodes
 */
export function convertAgentPlanToVisualNodes(plan: ExecutionPlan): CanvasNode[] {
  const nodes: CanvasNode[] = [];

  plan.steps.forEach((step, index) => {
    const node = convertExecutionStepToCanvasNode(step, index);
    if (node) {
      nodes.push(node);
    }
  });

  return nodes;
}

/**
 * Convert a single execution step to a canvas node
 */
function convertExecutionStepToCanvasNode(
  step: ExecutionStep,
  index: number
): CanvasNode | null {
  const baseNode = {
    id: `node_${Date.now()}_${index}`,
    position: { x: 100, y: index * 120 },
    config: {
      action: {},
      onError: (step.retryable ? 'retry' : 'stop') as 'stop' | 'continue' | 'retry' | 'ai_recovery',
      maxRetries: step.retryable ? 2 : 0,
      retryDelay: 1000,
      skipIfFalse: false,
      saveOutput: true,
      outputName: `step${step.stepNumber}_result`,
    },
  };

  // Map action to node type and configuration
  switch (step.action) {
    case 'browser.navigate':
      return {
        ...baseNode,
        type: 'navigate' as const,
        config: {
          ...baseNode.config,
          action: {
            url: step.params?.url || '',
            waitUntil: 'networkidle2',
            timeout: 30000,
          },
        },
      };

    case 'browser.waitFor':
      return {
        ...baseNode,
        type: 'wait' as const,
        config: {
          ...baseNode.config,
          action: {
            type: 'selector',
            selector: step.params?.selector || '',
            duration: step.params?.timeout || 5000,
          },
        },
      };

    case 'browser.extract':
      return {
        ...baseNode,
        type: 'extract' as const,
        config: {
          ...baseNode.config,
          action: {
            selector: step.params?.selector || '',
            extractType: 'text',
            multiple: false,
          },
          outputName: `price_text`,
        },
      };

    case 'browser.click':
      return {
        ...baseNode,
        type: 'click' as const,
        config: {
          ...baseNode.config,
          action: {
            selector: step.params?.selector || '',
            waitForNavigation: false,
            clickCount: 1,
          },
        },
      };

    case 'browser.type':
      return {
        ...baseNode,
        type: 'type' as const,
        config: {
          ...baseNode.config,
          action: {
            selector: step.params?.selector || '',
            text: step.params?.text || '',
            delay: 50,
            clearFirst: true,
          },
        },
      };

    case 'browser.screenshot':
    case 'ai.extract':
    case 'ai.chat':
    case 'email.send':
      // These actions aren't directly supported in the visual builder yet
      // We'll skip them or show as "advanced" nodes in the future
      console.log(`Skipping unsupported action: ${step.action}`);
      return null;

    default:
      console.warn(`Unknown action type: ${step.action}`);
      return null;
  }
}

/**
 * Convert competitor price monitor plan to canvas nodes
 * This is a specialized converter for the price monitoring workflow
 */
export function convertPriceMonitorToVisualNodes(config: {
  competitorUrl: string;
  priceSelector: string;
  thresholdPrice: number;
  alertEmail: string;
}): CanvasNode[] {
  return [
    {
      id: `node_${Date.now()}_1`,
      type: 'navigate',
      position: { x: 100, y: 0 },
      config: {
        action: {
          url: config.competitorUrl,
          waitUntil: 'networkidle2',
          timeout: 30000,
        },
        onError: 'retry',
        maxRetries: 2,
        retryDelay: 2000,
        skipIfFalse: false,
        saveOutput: true,
        outputName: 'navigation_result',
      },
    },
    {
      id: `node_${Date.now()}_2`,
      type: 'wait',
      position: { x: 100, y: 120 },
      config: {
        action: {
          type: 'selector',
          selector: config.priceSelector,
          duration: 10000,
        },
        onError: 'retry',
        maxRetries: 2,
        retryDelay: 1000,
        skipIfFalse: false,
        saveOutput: false,
      },
    },
    {
      id: `node_${Date.now()}_3`,
      type: 'extract',
      position: { x: 100, y: 240 },
      config: {
        action: {
          selector: config.priceSelector,
          extractType: 'text',
          multiple: false,
        },
        onError: 'ai_recovery',
        maxRetries: 2,
        retryDelay: 1000,
        skipIfFalse: false,
        saveOutput: true,
        outputName: 'competitor_price',
      },
    },
  ];
}

/**
 * Create template metadata for price monitor
 */
export function createPriceMonitorTemplate() {
  return {
    id: 'price-monitor-template',
    name: 'Competitor Price Monitor',
    description: 'Automatically track competitor prices and get alerts when prices drop below your threshold',
    category: 'E-commerce',
    difficulty: 'beginner',
    estimatedCredits: 200,
    estimatedDuration: 15000, // 15 seconds
    tags: ['price-tracking', 'competitor-analysis', 'e-commerce', 'automation'],
    icon: 'DollarSign',
    configurable: [
      {
        key: 'competitorUrl',
        label: 'Competitor URL',
        type: 'text',
        placeholder: 'https://example.com/product',
        required: true,
        description: 'The URL of your competitor\'s product page',
      },
      {
        key: 'priceSelector',
        label: 'Price CSS Selector',
        type: 'text',
        placeholder: '.price',
        required: true,
        description: 'CSS selector that targets the price element (e.g., .price, #product-price)',
      },
      {
        key: 'thresholdPrice',
        label: 'Alert Threshold',
        type: 'number',
        placeholder: '99.99',
        required: true,
        description: 'Get alerted when the price drops below this amount',
      },
      {
        key: 'alertEmail',
        label: 'Alert Email',
        type: 'email',
        placeholder: 'you@example.com',
        required: true,
        description: 'Where to send price drop alerts',
      },
    ],
  };
}

/**
 * Get all available workflow templates
 */
export function getWorkflowTemplates() {
  return [
    createPriceMonitorTemplate(),
    // Future templates can be added here:
    // - Product availability checker
    // - Form auto-filler
    // - Content scraper
    // - Social media poster
    // - Website uptime monitor
  ];
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string) {
  const templates = getWorkflowTemplates();
  return templates.find((t) => t.id === id);
}
