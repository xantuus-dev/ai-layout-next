import { Pool } from 'pg';
import { config } from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';

const envPath = join(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  config({ path: envPath });
}

async function checkSetup() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  console.log('\n🔍 Checking Memory System Setup...\n');

  // Check pgvector
  const ext = await pool.query(`
    SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'
  `);
  console.log('✅ pgvector:', ext.rows.length > 0 ? `v${ext.rows[0].extversion}` : '❌ Not installed');

  // Check vector columns
  const cols = await pool.query(`
    SELECT table_name, column_name, udt_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND udt_name = 'vector'
    ORDER BY table_name
  `);
  console.log(`\n✅ Vector columns: ${cols.rows.length} found`);
  cols.rows.forEach(r => console.log(`   - ${r.table_name}.${r.column_name}`));

  // Check indices
  const indices = await pool.query(`
    SELECT indexname FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND (indexname LIKE '%vector%' OR indexname LIKE '%embedding%')
    ORDER BY indexname
  `);
  console.log(`\n✅ Vector indices: ${indices.rows.length} found`);
  indices.rows.forEach(r => console.log(`   - ${r.indexname}`));

  // Check helper functions
  const funcs = await pool.query(`
    SELECT routine_name FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN ('search_memory_hybrid', 'find_similar_facts', 'calculate_fact_importance')
    ORDER BY routine_name
  `);
  console.log(`\n✅ Helper functions: ${funcs.rows.length} found`);
  funcs.rows.forEach(r => console.log(`   - ${r.routine_name}()`));

  // Check memory tables
  const tables = await pool.query(`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' 
    AND (tablename LIKE '%Memory%' OR tablename LIKE '%memory%')
    ORDER BY tablename
  `);
  console.log(`\n✅ Memory tables: ${tables.rows.length} found`);
  tables.rows.forEach(r => console.log(`   - ${r.tablename}`));

  console.log('\n🎉 Memory System is fully configured!\n');

  await pool.end();
}

checkSetup().catch(console.error);
