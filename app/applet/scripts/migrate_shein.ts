import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore/lite";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentFilePath = (typeof import.meta !== 'undefined' && import.meta.url) 
  ? fileURLToPath(import.meta.url) 
  : (typeof __filename !== 'undefined' ? __filename : '');

const currentDirPath = (currentFilePath) 
  ? path.dirname(currentFilePath) 
  : (typeof __dirname !== 'undefined' ? __dirname : process.cwd());
const configPath = path.resolve(currentDirPath, '../firebase-applet-config.json');

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (err) {
  console.log("No config found, skipping setup");
  process.exit(0);
}

const app = initializeApp(config);
const db = getFirestore(app);

async function run() {
  console.log("Starting Migration...");

  const sourcesSnap = await getDocs(collection(db, 'sources'));
  for (const docSnap of sourcesSnap.docs) {
    const data = docSnap.data();
    const name = (data.name || data.source_name || '').toLowerCase();
    
    if (data.type === 'App' && name.includes('shein')) {
      await updateDoc(doc(db, 'sources', docSnap.id), { type: 'SHEIN' });
      console.log(`Updated source: ${name} to SHEIN`);
    } else if (data.type === 'App' && name.includes('شي ان')) {
      await updateDoc(doc(db, 'sources', docSnap.id), { type: 'SHEIN' });
      console.log(`Updated source: ${name} to SHEIN`);
    }
  }

  const ordersSnap = await getDocs(collection(db, 'orders'));
  for (const docSnap of ordersSnap.docs) {
    const data = docSnap.data();
    const name = (data.orderSourceName || '').toLowerCase();

    if (data.orderSourceType === 'App' && (name.includes('shein') || name.includes('شي ان'))) {
      await updateDoc(doc(db, 'orders', docSnap.id), { orderSourceType: 'SHEIN' });
      console.log(`Updated order: ${data.orderNumber} to SHEIN`);
    }
  }

  console.log("Migration Complete!");
}

run().catch(console.error);
