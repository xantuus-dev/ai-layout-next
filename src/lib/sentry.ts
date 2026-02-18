/**
 * Sentry Error Tracking Utilities
 *
 * Provides helper functions for error tracking and monitoring throughout the application.
 */

import * as Sentry from '@sentry/nextjs';

/**
 * Capture an error with additional context
 */
export function captureError(
  error: Error,
  context?: {
    userId?: string;
    taskId?: string;
    tool?: string;
    action?: string;
    extra?: Record<string, any>;
  }
): string {
  Sentry.withScope((scope) => {
    // Set user context if provided
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }

    // Set tags for better filtering
    if (context?.taskId) {
      scope.setTag('task_id', context.taskId);
    }
    if (context?.tool) {
      scope.setTag('tool', context.tool);
    }
    if (context?.action) {
      scope.setTag('action', context.action);
    }

    // Add extra context
    if (context?.extra) {
      scope.setContext('additional', context.extra);
    }

    Sentry.captureException(error);
  });

  return error.message;
}

/**
 * Capture a message with severity level
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: Record<string, any>
): void {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setTag(key, String(value));
      });
    }

    Sentry.captureMessage(message, level);
  });
}

/**
 * Add breadcrumb for tracking user actions
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for error tracking
 */
export function setUser(userId: string, email?: string, username?: string): void {
  Sentry.setUser({
    id: userId,
    email,
    username,
  });
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearUser(): void {
  Sentry.setUser(null);
}

/**
 * Track performance of async operations
 */
export async function trackPerformance<T>(
  operationName: string,
  operation: () => Promise<T>,
  tags?: Record<string, string>
): Promise<T> {
  return await Sentry.startSpan(
    {
      name: operationName,
      op: 'function',
      attributes: tags || {},
    },
    async (span) => {
      try {
        const result = await operation();
        span?.setStatus({ code: 1 }); // OK status
        return result;
      } catch (error) {
        span?.setStatus({ code: 2 }); // Error status
        throw error;
      }
    }
  );
}

/**
 * Wrapper for agent executor errors
 */
export function captureAgentError(
  error: Error,
  taskId: string,
  userId: string,
  step?: number,
  tool?: string
): void {
  captureError(error, {
    userId,
    taskId,
    tool,
    action: `step_${step || 'unknown'}`,
    extra: {
      step,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Wrapper for tool execution errors
 */
export function captureToolError(
  error: Error,
  toolName: string,
  params: any,
  userId?: string
): void {
  captureError(error, {
    userId,
    tool: toolName,
    action: 'tool_execution',
    extra: {
      params: JSON.stringify(params),
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Wrapper for API route errors
 */
export function captureAPIError(
  error: Error,
  route: string,
  method: string,
  userId?: string
): void {
  captureError(error, {
    userId,
    action: `${method} ${route}`,
    extra: {
      route,
      method,
      timestamp: new Date().toISOString(),
    },
  });
}
