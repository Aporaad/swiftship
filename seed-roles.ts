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
  
  const roles = [
    {
      id: 'Admin',
      name: 'مدير النظام الشامل',
      nameEn: 'System Administrator',
      permissions: ['*'],
      description: 'صلاحيات كاملة للنظام والتحكم الكلي',
      createdAt: Date.now()
    },
    {
      id: 'Employee',
      name: 'أمين السر والتشغيل',
      nameEn: 'Operations Employee',
      permissions: ['view_dashboard', 'view_orders', 'manage_orders', 'view_customers', 'manage_customers', 'delete_orders', 'delete_customers', 'manage_couriers', 'delete_couriers'],
      description: 'إدخال ومقايسة الحركات المباشرة والطرود',
      createdAt: Date.now()
    },
    {
      id: 'Accountant',
      name: 'المحاسب المالي للشركة',
      nameEn: 'Financial Accountant',
      permissions: ['view_dashboard', 'view_orders', 'view_finance', 'manage_finance', 'manage_sources', 'delete_sources'],
      description: 'تحكم شامل بقضايا تدقيق النقد والمدفوعات',
      createdAt: Date.now()
    },
    {
      id: 'Courier',
      name: 'مندوب توزيع',
      nameEn: 'Delivery Courier',
      permissions: ['view_orders', 'update_order_status'],
      description: 'تحديث خطوات الترانزيت اللوجستي ومواقعه باليمن',
      createdAt: Date.now()
    }
  ];

  try {
    for (const role of roles) {
      const { id, ...roleData } = role;
      await db.collection('roles').doc(id).set(roleData, { merge: true });
      console.log(`Role ${id} created/updated successfully.`);
    }
    console.log('Roles seeding completed.');
  } catch (error) {
    console.error('Error seeding roles:', error);
  }
}

seedRoles().then(() => process.exit(0));
