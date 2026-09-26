import { initializeApp, cert } from './src/lib/supabase-adapter';
import { getAuth } from './src/lib/supabase-adapter';
import { getPostgreSQL } from './src/lib/supabase-adapter';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'supabase-applet-config.json');
const supabaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Initialize Admin SDK
// Note: In this environment, it uses the same project ID.
// If a service account is needed, it would be in the config, but usually 
// it works with ADC or the provided project ID in this specific platform.
initializeApp({
  projectId: supabaseConfig.projectId,
});

const auth = getAuth();
const db = getPostgreSQL();

async function seedRoot() {
  const rootEmail = 'admin@swiftship.system';
  const rootPassword = 'password123';
  const rootUsername = 'root';

  console.log(`[ADMIN] Checking if root user exists: ${rootEmail}...`);

  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(rootEmail);
      console.log('Root user already exists in Auth.');
    } catch (e: any) {
      if (e.code === 'auth/user-not-found') {
        console.log('Creating root user in Auth via Admin SDK...');
        userRecord = await auth.createUser({
          email: rootEmail,
          password: rootPassword,
          displayName: 'System Admin',
        });
        console.log('Auth user created successfully.');
      } else {
        throw e;
      }
    }

    // Create/Update PostgreSQL doc
    console.log('Seeding PostgreSQL document...');
    await db.collection('users').doc(userRecord.uid).set({
      email: rootEmail,
      username: rootUsername,
      fullName: 'System Root Administrator',
      role: 'Admin',
      isRoot: true,
      disabled: false,
      systemPin: '000000',
      createdAt: Date.now(),
    }, { merge: true });
    
    console.log('PostgreSQL document synced.');

    console.log('--------------------------------------------------');
    console.log('ROOT USER SEEDED SUCCESSFULLY');
    console.log(`Email: ${rootEmail}`);
    console.log(`Username: ${rootUsername}`);
    console.log(`Password: ${rootPassword}`);
    console.log('--------------------------------------------------');
    console.log('CRITICAL: You MUST enable "Email/Password" in the');
    console.log('Supabase Console -> Authentication -> Sign-in method');
    console.log('for the login to work on the client side.');
    console.log('--------------------------------------------------');

  } catch (error) {
    console.error('Error seeding root user:', error);
  }
}

seedRoot().then(() => process.exit(0));
