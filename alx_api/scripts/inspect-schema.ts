import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  for (const table of ['couriers', 'employees', 'users']) {
    const res = await pool.query(
      `SELECT column_name, data_type, is_nullable 
       FROM information_schema.columns 
       WHERE table_name = $1 AND table_schema = 'public'
       ORDER BY ordinal_position`,
      [table]
    );
    console.log(`=== ${table.toUpperCase()} COLUMNS ===`);
    for (const r of res.rows) {
      console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`);
    }
  }

  await pool.end();
}

main().catch(console.error);
