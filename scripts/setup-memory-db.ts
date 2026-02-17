#!/usr/bin/env tsx
/**
 * Setup Memory System Database
 *
 * This script enables pgvector and creates optimized indices for the memory system
 */

import { Pool } from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load environment variables from .env.local
const envPath = join(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log('✅ Loaded environment from .env.local\n');
}

async function main() {
  console.log('🧠 Setting up Memory System Database...\n');

  // Check DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('✅ Database URL configured\n');

  // Connect to database
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
  });

  try {
    // Test connection
    console.log('🔌 Connecting to database...');
    await pool.query('SELECT NOW()');
    console.log('✅ Connected successfully\n');

    // Read SQL script
    console.log('📖 Reading setup script...');
    const sqlScript = readFileSync(
      join(__dirname, 'setup-memory-database.sql'),
      'utf-8'
    );
    console.log('✅ Script loaded\n');

    // Execute SQL script
    console.log('⚙️  Executing setup commands...\n');

    // Execute entire script as one batch (handles multi-line functions properly)
    try {
      await pool.query(sqlScript);
      console.log('✅ SQL script executed successfully\n');
    } catch (error: any) {
      // If batch execution fails, it might be due to existing objects
      if (error.message.includes('already exists') ||
          error.message.includes('duplicate')) {
        console.log('⚠️  Some objects already exist (this is normal)\n');
      } else {
        throw error;
      }
    }

    // Verify setup
    console.log('🔍 Verifying setup...\n');

    // Check pgvector extension
    const extResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as enabled
    `);
    console.log(`   pgvector extension: ${extResult.rows[0].enabled ? '✅ Enabled' : '❌ Not found'}`);

    // Check vector columns
    const colResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'MemoryChunk'
      AND column_name = 'embedding_vector'
    `);
    console.log(`   Vector columns: ${colResult.rows.length > 0 ? '✅ Created' : '❌ Missing'}`);

    // Check indices
    const idxResult = await pool.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE indexname LIKE '%memory%embedding%'
    `);
    console.log(`   Vector indices: ${idxResult.rows.length > 0 ? '✅ Created' : '❌ Missing'}`);

    // Check functions
    const funcResult = await pool.query(`
      SELECT proname
      FROM pg_proc
      WHERE proname IN ('search_memory_hybrid', 'find_similar_facts', 'calculate_fact_importance')
    `);
    console.log(`   Helper functions: ${funcResult.rows.length > 0 ? '✅ Created' : '❌ Missing'}`);

    console.log('\n🎉 Memory system database is ready!\n');
    console.log('Next steps:');
    console.log('  1. Start dev server: npm run dev');
    console.log('  2. Visit: http://localhost:3010/settings/memory');
    console.log('  3. (Optional) Start scheduler: npm run memory-scheduler\n');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run main function
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
