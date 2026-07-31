const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, 'supabase', 'migrations', '0013_fix_scenes_table.sql'), 'utf8');
    await client.query(sql);
    console.log('Migration 0013 applied successfully.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

runMigration();
