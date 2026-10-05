import 'dotenv/config';
import { parseEnvironment } from '../src/config/env';
import { createDatabaseConnection } from '../src/db/pool';
import { createAuthUseCases } from '../src/modules/auth/auth.factory';

async function main() {
  try {
    const env = parseEnvironment();
    console.log('Env parsed successfully.');
    console.log('Database URL present:', Boolean(env.databaseUrl));
    
    if (!env.databaseUrl) {
      throw new Error('DATABASE_URL is missing');
    }

    const db = createDatabaseConnection({
      connectionString: env.databaseUrl,
      nodeEnv: env.nodeEnv,
      sslMode: env.databaseSslMode,
    });

    const auth = createAuthUseCases(db, env);
    console.log('Attempting login for admin...');
    const result = await auth.login({
      identifier: 'admin',
      password: 'swiftship@system_pw_2026',
      ipAddress: '127.0.0.1',
      userAgent: 'test-script',
    });

    console.log('🎉 LOGIN RESULT:', JSON.stringify(result, null, 2));
    await db.pool.end();
  } catch (err) {
    console.error('❌ LOGIN ERROR:', err);
    process.exitCode = 1;
  }
}

main();
