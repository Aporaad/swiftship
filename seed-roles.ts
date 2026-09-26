import { initializeApp } from './src/lib/supabase-adapter';
import { getPostgreSQL } from './src/lib/supabase-adapter';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'supabase-applet-config.json');
const supabaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

initializeApp({
  projectId: supabaseConfig.projectId,
});

const db = supabaseConfig.supabaseDatabaseId && supabaseConfig.supabaseDatabaseId !== '(default)'
    ? getPostgreSQL(undefined, supabaseConfig.supabaseDatabaseId)
    : getPostgreSQL();

async function seedRoles() {
  console.log('Seeding Roles collection...');
  
  const adminRole = {
    name: 'مدير النظام',
    nameEn: 'System Administrator',
    permissions: ['*'], // All permissions
    description: 'صلاحيات كاملة للنظام',
    createdAt: Date.now()
  };

  try {
    await db.collection('roles').doc('Admin').set(adminRole, { merge: true });
    console.log('Admin role created/updated successfully.');
    
    // Also ensure Root Admin user exists in PostgreSQL if we can find any UID
    // But since we don't have UID, we wait for login auto-seed.
    
    console.log('Roles seeding completed.');
  } catch (error) {
    console.error('Error seeding roles:', error);
  }
}

seedRoles();
