const pg = require('pg');
const fs = require('fs');
const path = require('path');
function readEnv(f) { const o = {}; if (!fs.existsSync(f)) return o; for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=["']?(.*?)["']?\s*$/); if (m) o[m[1]] = m[2]; } return o; }
(async () => {
  const root = path.join(__dirname, '..');
  const env = { ...readEnv(path.join(root, '.env')), ...readEnv(path.join(root, 'alx_api/.env')) };
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000, max: 1, statement_timeout: 60000 });
  const q = async (sql, p) => (await pool.query(sql, p)).rows;

  const trig = await q(`
    select c.relname, t.tgname,
           split_part(pg_get_triggerdef(t.oid), 'EXECUTE FUNCTION ', 2) as fn
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
     where not t.tgisinternal and n.nspname='public'
       and c.relname in ('orders','shipments','activity_logs','main_entry') order by 1,2`);
  console.table(trig);

  for (const t of trig.filter((x) => x.fn.startsWith('orders_history'))) {
    const fname = t.fn.replace(/\(.*/, '').trim().split('.').pop();
    if (!fname) continue;
    const d = await q(`select n.nspname || '.' || p.proname as fqn, pg_get_functiondef(p.oid) as def
                          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                         where p.proname = $1 order by 1`, [fname]);
    console.log(`\n===== ${t.relname} :: ${t.tgname} =====`);
    for (const row of d) { console.log(`--- ${row.fqn} ---`); console.log(row.def); }
  }
  await pool.end();
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
