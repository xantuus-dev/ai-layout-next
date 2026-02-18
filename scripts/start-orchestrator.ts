#!/usr/bin/env tsx
/**
 * Start Orchestrator Script
 *
 * This script starts the agent worker and orchestrator for local development.
 * It's useful for testing the autonomous agent scheduling system.
 *
 * Usage:
 *   npm run orchestrator
 *   or
 *   tsx scripts/start-orchestrator.ts
 *
 * Requirements:
 *   - Redis running on localhost:6379 (or configured via REDIS_HOST/REDIS_PORT)
 *   - Database configured and migrated
 *
 * The orchestrator will:
 *   - Poll for scheduled tasks every 60 seconds
 *   - Queue tasks for execution
 *   - Process tasks using the worker
 */

import { getAgentWorker, closeAgentWorker } from '../src/lib/queue/agent-worker';
import { getOrchestrator, stopOrchestrator } from '../src/lib/agent/orchestrator';
import { redisConnection } from '../src/lib/queue/redis';

// Handle graceful shutdown
let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log('\n🛑 Shutting down orchestrator...');

  try {
    // Stop orchestrator
    await stopOrchestrator();

    // Close worker
    await closeAgentWorker();

    // Close Redis connection
    await redisConnection.quit();

    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function main() {
  console.log('🚀 Starting Agent Orchestrator...\n');

  // Check Redis connection
  console.log('🔌 Connecting to Redis...');
  try {
    await redisConnection.ping();
    console.log('✅ Redis connected\n');
  } catch (error) {
    console.error('❌ Redis connection failed:', error);
    console.error('\nPlease ensure Redis is running:');
    console.error('  - macOS: brew services start redis');
    console.error('  - Linux: sudo systemctl start redis');
    console.error('  - Docker: docker run -d -p 6379:6379 redis:latest');
    console.error('  - Or configure REDIS_HOST and REDIS_PORT environment variables\n');
    process.exit(1);
  }

  // Start worker
  console.log('👷 Starting agent worker...');
  const worker = getAgentWorker();
  console.log('✅ Worker started\n');

  // Start orchestrator
  console.log('🎯 Starting orchestrator...');
  const orchestrator = getOrchestrator({
    maxConcurrentAgents: 10,
    pollInterval: 60000, // Check every minute
    defaultTimeout: 300000, // 5 minutes
    maxRetries: 3,
  });

  await orchestrator.start();
  console.log('✅ Orchestrator started\n');

  // Display status every 30 seconds
  setInterval(async () => {
    try {
      const status = await orchestrator.getDetailedStatus();
      console.log('\n📊 Orchestrator Status:');
      console.log(`   Running: ${status.running}`);
      console.log(`   Active agents: ${status.activeAgents}`);
      console.log(`   Queued tasks: ${status.queuedTasks}`);
      console.log(`   Completed today: ${status.completedToday}`);
      console.log(`   Failed today: ${status.failedToday}`);
      console.log(`   Uptime: ${Math.floor(status.uptime / 1000)}s`);
      console.log(`\n   Queue Stats:`);
      console.log(`     - Waiting: ${status.queue.waiting}`);
      console.log(`     - Active: ${status.queue.active}`);
      console.log(`     - Completed: ${status.queue.completed}`);
      console.log(`     - Failed: ${status.queue.failed}`);
      console.log(`     - Delayed: ${status.queue.delayed}`);
    } catch (error) {
      console.error('Error getting status:', error);
    }
  }, 30000);

  console.log('🎉 Orchestrator is running!');
  console.log('Press Ctrl+C to stop\n');
}

// Run main function
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
