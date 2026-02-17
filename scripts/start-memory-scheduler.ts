#!/usr/bin/env tsx
/**
 * Start Memory Scheduler Script
 *
 * This script starts the memory system scheduler for background consolidation
 * and maintenance tasks.
 *
 * Usage:
 *   npm run memory-scheduler
 *   or
 *   tsx scripts/start-memory-scheduler.ts
 *
 * Requirements:
 *   - PostgreSQL with pgvector extension installed
 *   - Database configured and migrated
 *   - ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable set
 *
 * The scheduler will:
 *   - Run memory consolidation every 6 hours (configurable)
 *   - Clean up embedding cache daily
 *   - Update fact importance scores daily
 *   - Clean up expired facts daily
 */

import { getMemoryScheduler, cleanup } from '../src/lib/memory/client';

// Handle graceful shutdown
let isShuttingDown = false;

async function shutdown() {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log('\n🛑 Shutting down memory scheduler...');

  try {
    // Cleanup memory connections
    await cleanup();

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
  console.log('🧠 Starting Memory System Scheduler...\n');

  // Check required environment variables
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ Missing API key!');
    console.error('Please set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable\n');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Missing DATABASE_URL!');
    console.error('Please set DATABASE_URL environment variable\n');
    process.exit(1);
  }

  console.log('✅ Environment variables configured\n');

  // Start memory scheduler
  console.log('📅 Starting memory scheduler...');
  try {
    const scheduler = getMemoryScheduler();
    scheduler.start();

    const stats = scheduler.getStats();
    console.log(`✅ Scheduler started with ${stats.tasks.length} tasks\n`);

    // Display scheduled tasks
    console.log('📋 Scheduled Tasks:');
    stats.tasks.forEach(task => {
      const intervalHours = task.intervalMs / (60 * 60 * 1000);
      console.log(`   - ${task.name}:`);
      console.log(`     Interval: ${intervalHours} hours`);
      console.log(`     Next run: ${task.nextRun?.toLocaleString() || 'N/A'}`);
      console.log(`     Runs: ${task.runCount}, Errors: ${task.errorCount}`);
    });

  } catch (error) {
    console.error('❌ Failed to start scheduler:', error);
    process.exit(1);
  }

  // Display status every 5 minutes
  setInterval(async () => {
    try {
      const scheduler = getMemoryScheduler();
      const stats = scheduler.getStats();

      console.log('\n📊 Memory Scheduler Status:');
      console.log(`   Uptime: ${Math.floor(stats.uptime / 1000)}s`);
      console.log(`   Total runs: ${stats.totalRuns}`);
      console.log(`   Total errors: ${stats.totalErrors}`);
      console.log(`\n   Task Status:`);
      stats.tasks.forEach(task => {
        const status = task.running ? '🔄 Running' : '⏸️  Idle';
        const nextRun = task.nextRun
          ? new Date(task.nextRun).toLocaleString()
          : 'N/A';
        console.log(`     - ${task.name}: ${status}`);
        console.log(`       Runs: ${task.runCount}, Errors: ${task.errorCount}`);
        console.log(`       Next: ${nextRun}`);
      });
    } catch (error) {
      console.error('Error getting status:', error);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  console.log('\n🎉 Memory scheduler is running!');
  console.log('Press Ctrl+C to stop\n');
  console.log('The scheduler will:');
  console.log('  - Consolidate memory every 6 hours');
  console.log('  - Clean embedding cache daily');
  console.log('  - Update importance scores daily');
  console.log('  - Clean expired facts daily\n');
}

// Run main function
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
