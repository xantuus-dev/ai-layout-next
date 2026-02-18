/**
 * Redis Connection Configuration with Health Checks and Graceful Degradation
 *
 * Provides:
 * - Health check monitoring
 * - Connection state tracking
 * - Graceful degradation when Redis is unavailable
 * - Circuit breaker pattern for retries
 * - Error recovery strategies
 */

import { Redis } from 'ioredis';
import { captureMessage } from '@/lib/sentry';

// Connection states
export enum RedisState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

// Circuit breaker states
enum CircuitState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Too many failures, stop trying
  HALF_OPEN = 'half_open', // Testing if Redis recovered
}

/**
 * Redis Connection Manager
 */
class RedisConnectionManager {
  private connection: Redis | null = null;
  private state: RedisState = RedisState.DISCONNECTED;
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Circuit breaker configuration
  private readonly FAILURE_THRESHOLD = 5;
  private readonly CIRCUIT_OPEN_TIME = 60000; // 1 minute
  private readonly HALF_OPEN_RETRY_TIME = 30000; // 30 seconds
  private readonly HEALTH_CHECK_INTERVAL = 10000; // 10 seconds

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Redis connection
   */
  private initialize(): void {
    // In build/CI environments, skip Redis connection
    if (process.env.CI || process.env.NEXT_PHASE === 'phase-production-build') {
      console.log('⏭️  Redis: Skipping connection in build environment');
      return;
    }

    // Check if Redis is required
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    this.state = RedisState.CONNECTING;

    this.connection = new Redis({
      host: redisHost,
      port: redisPort,
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: true,
      enableOfflineQueue: true,
      lazyConnect: true, // Don't connect immediately
      retryStrategy: (times) => {
        // Exponential backoff with max delay of 5 seconds
        const delay = Math.min(times * 100, 5000);

        // Stop retrying after failure threshold
        if (times > this.FAILURE_THRESHOLD) {
          this.openCircuit();
          return null; // Stop retrying
        }

        return delay;
      },
      reconnectOnError: (error) => {
        // Only reconnect for network errors, not auth errors
        const targetErrors = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
        if (targetErrors.some(target => error.message.includes(target))) {
          return true; // Reconnect
        }
        return false; // Don't reconnect for other errors
      },
    });

    this.setupEventHandlers();
    this.startHealthCheck();

    // Attempt initial connection
    this.connect();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    if (!this.connection) return;

    this.connection.on('connect', () => {
      console.log('✅ Redis connected');
      this.state = RedisState.CONNECTED;
      this.failureCount = 0;
      this.circuitState = CircuitState.CLOSED;
    });

    this.connection.on('ready', () => {
      console.log('✅ Redis ready');
      this.state = RedisState.CONNECTED;
    });

    this.connection.on('error', (error) => {
      // Filter out connection errors in development/build
      if (process.env.NODE_ENV !== 'production' && error.message.includes('ECONNREFUSED')) {
        // Silent in development
        return;
      }

      console.error('❌ Redis connection error:', error.message);
      this.state = RedisState.ERROR;
      this.failureCount++;
      this.lastFailureTime = Date.now();

      // Track in Sentry (only in production)
      if (process.env.NODE_ENV === 'production') {
        captureMessage(`Redis error: ${error.message}`, 'warning', {
          failureCount: String(this.failureCount),
          circuitState: this.circuitState,
        });
      }

      // Open circuit if too many failures
      if (this.failureCount >= this.FAILURE_THRESHOLD) {
        this.openCircuit();
      }
    });

    this.connection.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
      this.state = RedisState.RECONNECTING;
    });

    this.connection.on('close', () => {
      console.log('🔌 Redis connection closed');
      this.state = RedisState.DISCONNECTED;
    });

    this.connection.on('end', () => {
      console.log('🔚 Redis connection ended');
      this.state = RedisState.DISCONNECTED;
    });
  }

  /**
   * Attempt to connect to Redis
   */
  private async connect(): Promise<void> {
    if (!this.connection || this.circuitState === CircuitState.OPEN) {
      return;
    }

    try {
      await this.connection.connect();
    } catch (error) {
      // Connection failed, but event handler will track it
    }
  }

  /**
   * Open the circuit breaker
   */
  private openCircuit(): void {
    console.log('🔴 Redis circuit breaker OPEN - stopping connection attempts');
    this.circuitState = CircuitState.OPEN;

    // Try to close circuit after timeout
    setTimeout(() => {
      this.halfOpenCircuit();
    }, this.CIRCUIT_OPEN_TIME);
  }

  /**
   * Half-open the circuit breaker (test if Redis recovered)
   */
  private halfOpenCircuit(): void {
    console.log('🟡 Redis circuit breaker HALF-OPEN - testing connection');
    this.circuitState = CircuitState.HALF_OPEN;
    this.failureCount = 0;

    // Try to reconnect
    this.connect();

    // If still failing after timeout, open circuit again
    setTimeout(() => {
      if (this.state !== RedisState.CONNECTED) {
        this.openCircuit();
      }
    }, this.HALF_OPEN_RETRY_TIME);
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    // Only health check in production
    if (process.env.NODE_ENV !== 'production') {
      return;
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.connection || this.circuitState === CircuitState.OPEN) {
      return;
    }

    try {
      await this.connection.ping();

      // If ping succeeds, reset failure count
      if (this.failureCount > 0) {
        console.log('✅ Redis health check passed - connection recovered');
        this.failureCount = 0;
        this.circuitState = CircuitState.CLOSED;
      }
    } catch (error) {
      console.error('❌ Redis health check failed');
      this.failureCount++;

      if (this.failureCount >= this.FAILURE_THRESHOLD) {
        this.openCircuit();
      }
    }
  }

  /**
   * Check if Redis is available
   */
  public isAvailable(): boolean {
    return (
      this.state === RedisState.CONNECTED &&
      this.circuitState !== CircuitState.OPEN
    );
  }

  /**
   * Get current Redis state
   */
  public getState(): RedisState {
    return this.state;
  }

  /**
   * Get circuit breaker state
   */
  public getCircuitState(): CircuitState {
    return this.circuitState;
  }

  /**
   * Get Redis connection (or null if unavailable)
   */
  public getConnection(): Redis | null {
    if (!this.isAvailable()) {
      console.warn('⚠️  Redis unavailable - operations will be skipped');
      return null;
    }
    return this.connection;
  }

  /**
   * Check health status
   */
  public async getHealthStatus(): Promise<{
    connected: boolean;
    state: RedisState;
    circuitState: CircuitState;
    failureCount: number;
    lastFailure: number | null;
  }> {
    return {
      connected: this.isAvailable(),
      state: this.state,
      circuitState: this.circuitState,
      failureCount: this.failureCount,
      lastFailure: this.lastFailureTime > 0 ? this.lastFailureTime : null,
    };
  }

  /**
   * Gracefully close connection
   */
  public async close(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }

    this.state = RedisState.DISCONNECTED;
  }
}

// Singleton instance
const redisManager = new RedisConnectionManager();

// Export manager methods
export const redisConnection = redisManager.getConnection();
export const isRedisAvailable = () => redisManager.isAvailable();
export const getRedisState = () => redisManager.getState();
export const getRedisHealth = () => redisManager.getHealthStatus();
export const closeRedisConnection = () => redisManager.close();

// Export connection config for BullMQ
export const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

/**
 * Helper function to execute Redis operations with graceful degradation
 */
export async function executeWithRedis<T>(
  operation: (redis: Redis) => Promise<T>,
  fallback: () => T | Promise<T>,
  operationName: string = 'Redis operation'
): Promise<T> {
  const redis = redisManager.getConnection();

  if (!redis) {
    console.warn(`⚠️  ${operationName}: Redis unavailable, using fallback`);
    return await Promise.resolve(fallback());
  }

  try {
    return await operation(redis);
  } catch (error) {
    console.error(`❌ ${operationName} failed:`, error);
    console.warn(`⚠️  ${operationName}: Using fallback`);
    return await Promise.resolve(fallback());
  }
}

export default redisManager;
