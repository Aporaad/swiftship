/**
 * سكريبت تشخيص مباشر - يستخدم pg مباشرة بدلاً من Drizzle
 * Direct PG diagnostic - bypasses Drizzle to expose raw DB errors
 */
import { Pool } from 'pg';

const DATABASE_URL = process.env['DATABASE_URL'];
const DATABASE_SSL_MODE = process.env['DATABASE_SSL_MODE'] ?? 'require';

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL missing');
  process.exitCode = 1;
  process.exit(1);
}

console.log(`=== تشخيص قاعدة البيانات المباشر ===`);
console.log(`SSL Mode: ${DATABASE_SSL_MODE}\n`);

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_SSL_MODE === 'disable' ? undefined : { rejectUnauthorized: false },
  max: 2,
  connectionTimeoutMillis: 10_000,
});

async function run(): Promise<void> {
  const client = await pool.connect();
  try {
    // 1. معلومات الاتصال
    const conn = await client.query('SELECT current_user, current_database(), session_user');
    const row = conn.rows[0] as { current_user: string; current_database: string; session_user: string };
    console.log(`✅ متصل كـ: current_user=${row.current_user}, session_user=${row.session_user}`);
    console.log(`   قاعدة البيانات: ${row.current_database}\n`);

    // 2. اختبار الوصول للـ view
    console.log('🔍 اختبار الوصول لـ alx_api_private.api_login_users...');
    try {
      const viewResult = await client.query(
        `SELECT user_id, role, disabled, email 
         FROM alx_api_private.api_login_users 
         WHERE lower(username) = $1 OR lower(email) = $2 
         LIMIT 2`,
        ['admin', 'admin']
      );
      console.log(`✅ نجح! عدد النتائج: ${viewResult.rows.length}`);
      for (const r of viewResult.rows as Array<{ user_id: string; role: string; disabled: boolean }>) {
        console.log(`   user_id=${r.user_id}, role=${r.role}, disabled=${r.disabled}`);
      }
    } catch (e) {
      const err = e as Error & { code?: string; detail?: string; hint?: string };
      console.error(`❌ خطأ في الوصول للـ view:`);
      console.error(`   message: ${err.message}`);
      if (err.code) console.error(`   code: ${err.code}`);
      if (err.detail) console.error(`   detail: ${err.detail}`);
      if (err.hint) console.error(`   hint: ${err.hint}`);
    }

    // 3. اختبار وجود schema
    console.log('\n🏗️ اختبار وجود alx_api_private schema...');
    try {
      const schemaResult = await client.query(
        `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'alx_api_private'`
      );
      console.log(`   Schema موجود: ${schemaResult.rowCount! > 0 ? '✅' : '❌ غير موجود!'}`);
    } catch (e) {
      const err = e as Error;
      console.error(`❌ خطأ في فحص schema: ${err.message}`);
    }

    // 4. اختبار الصلاحيات مباشرة
    console.log('\n🔐 فحص الصلاحيات على الـ view...');
    try {
      const privResult = await client.query(
        `SELECT has_table_privilege(current_user, 'alx_api_private.api_login_users', 'SELECT') AS can_select`
      );
      const priv = privResult.rows[0] as { can_select: boolean };
      console.log(`   SELECT على api_login_users: ${priv.can_select ? '✅' : '❌'}`);
    } catch (e) {
      const err = e as Error;
      console.error(`❌ خطأ في فحص الصلاحيات: ${err.message}`);
    }

    // 5. اختبار verify_legacy_password function
    console.log('\n🔑 اختبار الوصول لـ verify_legacy_password...');
    try {
      const fnResult = await client.query(
        `SELECT alx_api_private.verify_legacy_password($1, $2) AS valid`,
        ['0ddcaebd-e4e1-4057-9cf4-b648db516fdd', 'swiftship@system_pw_2026']
      );
      const fn = fnResult.rows[0] as { valid: boolean };
      console.log(`   نتيجة verify_legacy_password: ${fn.valid ? '✅ كلمة المرور صحيحة' : '❌ كلمة المرور خاطئة'}`);
    } catch (e) {
      const err = e as Error & { code?: string };
      console.error(`❌ خطأ في verify_legacy_password:`);
      console.error(`   message: ${err.message}`);
      if (err.code) console.error(`   code: ${err.code}`);
    }

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e: unknown) => {
  const err = e as Error;
  console.error('💥 Fatal error:', err.message);
  process.exitCode = 1;
});
