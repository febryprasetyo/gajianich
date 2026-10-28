import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import path from 'path';
import { loadEnv } from '../config/env';

export async function runMigrations(databaseUrl: string, migrationsFolder?: string, runtimeRole = process.env.HR_AUDIT_RUNTIME_ROLE): Promise<void> {
  const resolvedFolder = migrationsFolder || path.resolve(__dirname, '../../drizzle');
  console.log(`⚡ Running journal-based Drizzle migrations from: ${resolvedFolder}`);

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const client = await pool.connect();
    try {
      // The role setting and migrator must use the same PostgreSQL session.
      if (runtimeRole) {
        await client.query("SELECT set_config('gajianich.hr_audit_runtime_role', $1, false)", [runtimeRole]);
      }
      await migrate(drizzle(client), { migrationsFolder: resolvedFolder });
    } finally {
      client.release();
    }
    console.log('✅ Drizzle migrations applied successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'))) {
  const env = loadEnv();
  runMigrations(process.env.MIGRATION_DATABASE_URL?.trim() || env.databaseUrl)
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal migration error:', err);
      process.exit(1);
    });
}
