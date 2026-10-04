export interface DatabaseHealthClient {
  query(queryText: string): Promise<unknown>;
}

export async function isDatabaseReady(client: DatabaseHealthClient | undefined): Promise<boolean> {
  if (!client) return false;

  try {
    await client.query('SELECT 1 FROM alx_api_private.api_sessions LIMIT 0');
    await client.query('SELECT 1 FROM alx_api_private.api_login_users LIMIT 0');
    await client.query('SELECT 1 FROM alx_api_private.user_credentials LIMIT 0');
    await client.query('SELECT 1 FROM alx_api_private.roles LIMIT 0');
    await client.query('SELECT 1 FROM alx_api_private.permissions LIMIT 0');
    await client.query('SELECT 1 FROM alx_api_private.user_roles LIMIT 0');
    await client.query('SELECT 1 FROM alx_api_private.role_permissions LIMIT 0');
    await client.query("SELECT alx_api_private.verify_legacy_password('', '') LIMIT 1");
    await client.query("SELECT alx_api_private.migrate_legacy_password('', '', '') LIMIT 1");
    await client.query("SELECT alx_api_private.update_password_hash('', '', now()) LIMIT 1");
    await client.query("SELECT alx_api_private.create_password_reset_token('', '', now(), now()) LIMIT 1");
    await client.query("SELECT alx_api_private.complete_password_reset('', '', now()) LIMIT 1");
    return true;
  } catch {
    return false;
  }
}
