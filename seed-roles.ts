import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

initializeApp({
  projectId: firebaseConfig.projectId,
});

const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(undefined, firebaseConfig.firestoreDatabaseId)
    : getFirestore();

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
    
    // Also ensure Root Admin user exists in Firestore if we can find any UID
    // But since we don't have UID, we wait for login auto-seed.
    
    console.log('Roles seeding completed.');
  } catch (error) {
    console.error('Error seeding roles:', error);
  }
}

seedRoles();
