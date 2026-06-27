import './loadEnv'; // Loaded first to populate process.env before other modules are imported
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


import admin, {
  initializeApp,
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  limit,
  getDocs,
  updateDoc,
  onSnapshot,
  initializeAuth,
  inMemoryPersistence,
  signInWithEmailAndPassword,
  setDoc,
  createUserWithEmailAndPassword
} from './src/lib/supabase-firebase-adapter';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  app.use(express.json());

  // Initialize Firebase Adapter Services (Backed by Supabase)
  let firebaseApp: any = null;
  let db: any = null;
  let auth: any = null;

  // Initialize Firebase Admin SDK Mock
  try {
    admin.initializeApp();
    console.log('Backend Adapter Admin SDK initialized successfully');
  } catch (adminErr: any) {
    console.error('Backend Adapter Admin SDK init failed:', adminErr.message);
  }

  try {
    firebaseApp = initializeApp({});
    db = getFirestore(firebaseApp);
    auth = initializeAuth(firebaseApp, {
      persistence: inMemoryPersistence
    });
    console.log('[Server] Initialize Backend Adapter Services supporting Supabase on server successfully');
  } catch (e: any) {
    console.error('Backend Adapter Client SDK init failed:', e.message);
  }

  // Authenticate the server session using system administrative account to secure backend operations
  const systemEmail = 'admin@swiftship.system';
  const systemPassword = 'swiftship@system_pw_2026'; // Standard master password for system synchronization
  
  if (auth && db) {
    try {
      await signInWithEmailAndPassword(auth, systemEmail, systemPassword);
      console.log('Backend server authenticated securely as admin@swiftship.system using Web SDK');
    } catch (authErr: any) {
      console.warn('Backend failed standard authentication with system master password:', authErr.message);
      if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/user-not-found') {
        try {
          const { createUserWithEmailAndPassword } = await import('./src/lib/supabase-firebase-adapter');
          await createUserWithEmailAndPassword(auth, systemEmail, systemPassword);
          console.log('Backend server successfully registered admin@swiftship.system on-the-fly');

          // Auto-seed admin user document in Firestore to enable immediate resolve-identifier and verify-login lookup list
          try {
            const { doc: fDoc, setDoc } = await import('./src/lib/supabase-firebase-adapter');
            await setDoc(fDoc(db, 'users', auth.currentUser!.uid), {
              email: systemEmail,
              username: 'admin',
              fullName: 'System Root Administrator',
              role: 'Admin',
              isRoot: true,
              disabled: false,
              systemPin: '000000',
              password: systemPassword,
              createdAt: Date.now()
            });
            console.log('Successfully seeded admin user doc on startup');
          } catch (seedErr: any) {
            console.error('Could not seed admin user doc on startup:', seedErr.message);
          }
        } catch (regErr: any) {
          console.error('Backend failed to register administrative account:', regErr.message);
          // Fallback: Try legacy standard password
          try {
            await signInWithEmailAndPassword(auth, systemEmail, 'password123');
            console.log('Backend server authenticated securely using legacy password123');
          } catch (legacyErr: any) {
            console.error('Backend fallback authentication failed:', legacyErr.message);
          }
        }
      }
    }
  }

  // --- EMULATED CLOUD FUNCTIONS (FIREBASE FUNCTIONS TRIGGERS) ---
  if (db) {
    try {
      console.log('[System Triggers] Setting up emulated real-time Firebase Cloud Functions on server backend...');
      
      const getExchangeRatesBackend = async () => {
        try {
          const snap = await getDoc(doc(db, 'settings', 'general'));
          if (snap.exists()) {
            const data = snap.data();
            return {
              USD: data.exchangeRateUSD || 535,
              SAR: data.exchangeRateSAR || 140,
              YER: 1
            };
          }
        } catch (e) {
          console.warn('Could not fetch exchange rates on server, using defaults', e);
        }
        return { USD: 535, SAR: 140, YER: 1 };
      };

      const convertToTargetCurrencyBackend = (
        amount: number,
        fromCurrency: string,
        targetCurrency: string,
        exchangeRates: { USD?: number; SAR?: number; YER?: number }
      ): number => {
        if (fromCurrency === targetCurrency) return amount;
        let baseAmountYER = amount;
        if (fromCurrency === 'USD') baseAmountYER = amount * (exchangeRates.USD || 535);
        else if (fromCurrency === 'SAR') baseAmountYER = amount * (exchangeRates.SAR || 140);
        else if (fromCurrency === 'YER') baseAmountYER = amount;

        if (targetCurrency === 'USD') return baseAmountYER / (exchangeRates.USD || 535);
        if (targetCurrency === 'SAR') return baseAmountYER / (exchangeRates.SAR || 140);
        if (targetCurrency === 'YER') return baseAmountYER;
        return baseAmountYER;
      };

      const settlePendingCustodiesForCourierBackend = async (courierId: string, amountToSettle: number, currency: string) => {
        if (amountToSettle <= 0) return;
        try {
          const exchangeRates = await getExchangeRatesBackend();
          const q = query(
            collection(db, 'expenses'),
            where('recipientEntityId', '==', courierId),
            where('status', '==', 'Pending')
          );
          const snap = await getDocs(q);
          const pending = snap.docs
            .map(d => ({id: d.id, ...d.data()} as any))
            .filter((e: any) => e.type === 'Custody')
            .sort((a: any, b: any) => a.createdAt - b.createdAt);

          console.log(`[System Triggers] Found ${pending.length} pending custodies for courier ${courierId}. Amount to settle: ${amountToSettle} ${currency}`);

          let remainingToSettle = amountToSettle;
          let settled = false;

          for (const expense of pending) {
            if (remainingToSettle <= 0) break;

            const expenseCurrency = expense.currency || 'YER';
            const currentRemitted = parseFloat(expense.remittedAmount) || 0;
            const totalAmount = parseFloat(expense.amount) || 0;
            const availableToSettleExpenseCurrency = totalAmount - currentRemitted;
            
            if (availableToSettleExpenseCurrency <= 0) continue;

            const availableToSettleBudgetCurrency = convertToTargetCurrencyBackend(
              availableToSettleExpenseCurrency,
              expenseCurrency,
              currency,
              exchangeRates
            );

            const settleAmountBudgetCurrency = Math.min(remainingToSettle, availableToSettleBudgetCurrency);
            
            const settleAmountExpenseCurrency = convertToTargetCurrencyBackend(
              settleAmountBudgetCurrency,
              currency,
              expenseCurrency,
              exchangeRates
            );
            
            const newRemitted = currentRemitted + settleAmountExpenseCurrency;
            const isFullySettled = newRemitted >= totalAmount - 0.01;

            console.log(`[System Triggers] Auto-Settling custody expense ${expense.id}: settling ${settleAmountBudgetCurrency} ${currency} (${settleAmountExpenseCurrency} ${expenseCurrency}). New remitted: ${newRemitted}. Fully settled: ${isFullySettled}`);

            await updateDoc(doc(db, 'expenses', expense.id), {
              status: isFullySettled ? 'Settled' : 'Pending',
              remittedAmount: newRemitted,
              updatedAt: Date.now()
            });

            remainingToSettle -= settleAmountBudgetCurrency;
            settled = true;

            // Log activity log
            try {
              await addDoc(collection(db, 'activity_logs'), {
                action: 'settle_custody',
                targetId: expense.id,
                metadata: { 
                   amount: settleAmountBudgetCurrency, 
                   currency,
                   automated: true,
                   source: 'System Trigger on Credit Transaction'
                },
                createdAt: Date.now(),
                userId: 'system'
              });
            } catch (logErr) {
              console.error('[System Triggers] Failed to save activity log for auto-settle:', logErr);
            }
          }
        } catch (settleErr: any) {
          console.error('[System Triggers] Error in auto-settling pending custodies:', settleErr.message);
        }
      };

      // Reconciles an account's balances when its account_transactions are written, deleted, or updated.
      onSnapshot(collection(db, 'account_transactions'), async (snapshot) => {
        const changes = snapshot.docChanges();
        if (changes.length === 0) return;
        
        console.log(`[System Triggers] Detected ${changes.length} change(s) in account_transactions`);
        
        const affectedAccountIds = new Set<string>();
        for (const change of changes) {
          const data = change.doc.data();
          if (data && data.accountId) {
            affectedAccountIds.add(data.accountId);

            // Auto-settle custody if a NEW Credit transaction is added
            if (change.type === 'added' && data.type === 'Credit') {
              try {
                const accountRef = doc(db, 'accounts', data.accountId);
                const accountSnap = await getDoc(accountRef);
                if (accountSnap.exists()) {
                  const accountData = accountSnap.data();
                  if (accountData.entityType === 'courier') {
                    const courierId = accountData.entityId;
                    const txAmount = parseFloat(data.amountOriginal) || parseFloat(data.amount) || 0;
                    const txCurrency = data.currencyOriginal || accountData.currency || 'YER';
                    
                    console.log(`[System Triggers] Credit transaction of ${txAmount} ${txCurrency} registered on Courier: ${accountData.entityName}. ID: ${courierId}. Processing automatic custody settlement...`);
                    
                    await settlePendingCustodiesForCourierBackend(courierId, txAmount, txCurrency);
                  }
                }
              } catch (cErr: any) {
                console.error('[System Triggers] Error checking courier for custody settlement:', cErr.message);
              }
            }
          }
        }
        
        for (const accountId of affectedAccountIds) {
          try {
            console.log(`[System Triggers] Reconciling ledger account ID: ${accountId}`);
            
            // Query all transactions for this accountId
            const txsQuery = query(collection(db, 'account_transactions'), where('accountId', '==', accountId));
            const txsSnap = await getDocs(txsQuery);
            
            let debitTotal = 0;
            let creditTotal = 0;
            
            txsSnap.forEach(txDoc => {
              const tx = txDoc.data();
              const amt = parseFloat(tx.amount) || 0;
              if (tx.type === 'Debit') {
                debitTotal += amt;
              } else if (tx.type === 'Credit') {
                creditTotal += amt;
              }
            });
            
            // Read account information
            const accountRef = doc(db, 'accounts', accountId);
            const accountSnap = await getDoc(accountRef);
            
            if (accountSnap.exists()) {
              const accountData = accountSnap.data();
              const prefix = accountData.accountPrefix || '';
              
              const isAsset = prefix.startsWith('1');
              const balance = isAsset ? (debitTotal - creditTotal) : (creditTotal - debitTotal);
              
              console.log(`[System Triggers] Reconciled and Synced Account ${accountData.accountCode} (${accountData.entityName}): Balance=${balance}, DebitTotal=${debitTotal}, CreditTotal=${creditTotal}`);
              
              await updateDoc(accountRef, {
                balance,
                debitTotal,
                creditTotal,
                updatedAt: Date.now()
              });
            }
          } catch (reconErr: any) {
            console.error(`[System Triggers] Reconcile error for account ${accountId}:`, reconErr.message);
          }
        }
      });
      
    } catch (triggerErr: any) {
      console.error('[System Triggers] Could not start real-time Firebase Triggers:', triggerErr.message);
    }
  }

  // API Routes
  // Middleware to ensure database is online and initialized before performing database-driven API calls
  app.use('/api/*', (req, res, next) => {
    if (req.path === '/api/health') {
      return next();
    }
    if (!db || !auth) {
      return res.status(503).json({ 
        error: 'خدمات قاعدة البيانات غير مهيأة أو غير متصلة بالإنترنت حالياً. يرجى التأكد من تهيئة Supabase بشكل صحيح عبر متغيرات البيئة.' 
      });
    }
    next();
  });
  app.post('/api/auth/resolve-identifier', async (req, res) => {
    const { identifier } = req.body;
    if (!identifier) return res.status(400).json({ error: 'Identifier required' });

    try {
      const idLower = identifier.toLowerCase();

      // Hardcoded fallback for root admin
      if (idLower === 'admin') {
         return res.json({ email: 'admin@swiftship.system' });
      }

      // If it looks like an email, we just return it
      if (idLower.includes('@')) {
         return res.json({ email: idLower });
      }

      // Lookup username in Firestore via Client SDK
      const snap = await getDocs(query(collection(db, 'users'), where('username', '==', identifier), limit(1)));
      if (snap.empty) {
        return res.status(404).json({ error: 'User not found' });
      }

      const userData = snap.docs[0].data();
      res.json({ email: userData.email });
    } catch (err: any) {
      console.error('Resolve identifier error:', err);
      // Fallback: if identifier resolution fails, we return original and let client-side login handle it
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', project: 'supabase-backend' });
  });

  // Direct administrative password update using Firestore to bypass disabled Identity Toolkit API
  app.post('/api/auth/admin-change-password', async (req, res) => {
    const { uid, newPassword } = req.body;
    if (!uid || !newPassword) {
      return res.status(400).json({ error: 'User ID and password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { password: newPassword });
      console.log(`Successfully changed password in Firestore for user ${uid}`);
      return res.json({ success: true });
    } catch (err: any) {
      console.error('Failed to change user password in Firestore:', err);
      return res.status(500).json({ error: err.message || 'Failed to change password' });
    }
  });

  // Dual-logic login validation (supports custom/override Firestore passwords and Firebase Auth verification)
  app.post('/api/auth/verify-login', async (req, res) => {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password are required' });
    }

    try {
      const idLower = identifier.toLowerCase();
      let email = idLower;

      const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'engaporaad1@gmail.com', 'admin@swiftship.system', 'apo.1.read@gmail.com'];
      if (idLower === 'admin') {
        email = 'admin@swiftship.system';
      }

      let userDoc: any = null;
      let userDocId = '';

      if (email.includes('@')) {
        const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email), limit(1)));
        if (!snap.empty) {
          userDoc = snap.docs[0].data();
          userDocId = snap.docs[0].id;
        }
      } else {
        const snap = await getDocs(query(collection(db, 'users'), where('username', '==', identifier), limit(1)));
        if (!snap.empty) {
          userDoc = snap.docs[0].data();
          userDocId = snap.docs[0].id;
          email = userDoc.email;
        }
      }

      const isRoot = ROOT_EMAILS.includes(email.toLowerCase());

      if (!userDoc && isRoot) {
        // Automatically check/create Auth user and Firestore doc for root emails
        let uid = '';
        let createdSuccessfully = false;

        // Try Admin SDK first
        try {
          if (admin.apps.length > 0) {
            try {
              const authUser = await admin.auth().getUserByEmail(email);
              uid = authUser.uid;
            } catch (authErr: any) {
              if (authErr.code === 'auth/user-not-found' || authErr.code === 'user-not-found') {
                const userRecord = await admin.auth().createUser({
                  email: email,
                  emailVerified: true,
                  password: password
                });
                uid = userRecord.uid;
              } else {
                throw authErr;
              }
            }

            // Create/merge the user document in Firestore using Admin SDK
            await admin.firestore().collection('users').doc(uid).set({
              email: email.toLowerCase(),
              username: email.toLowerCase().split('@')[0],
              fullName: email.toLowerCase().split('@')[0].toUpperCase() + ' (Root)',
              role: 'Admin',
              isRoot: true,
              password: password,
              disabled: false,
              createdAt: Date.now()
            }, { merge: true });
            console.log(`Successfully created/merged Root admin document via Admin SDK for ${email}`);
            createdSuccessfully = true;
          }
        } catch (adminErr: any) {
          console.warn('Admin SDK failed for root creation, attempting Client Web SDK fallback:', adminErr.message);
        }

        // Fallback to Client Web SDK if Admin SDK was unavailable or failed
        if (!createdSuccessfully) {
          try {
            const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('./src/lib/supabase-firebase-adapter');
            const { setDoc, doc: fDoc } = await import('./src/lib/supabase-firebase-adapter');

            // Try to sign in as this user to see if they exist in auth
            try {
              const userCred = await signInWithEmailAndPassword(auth, email, password);
              uid = userCred.user.uid;
              console.log('Root user found in Auth via Client SDK sign-in');
            } catch (signInErr: any) {
              // If user is not found, let's create them
              if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/user-disabled') {
                try {
                  const userCred = await createUserWithEmailAndPassword(auth, email, password);
                  uid = userCred.user.uid;
                  console.log('Root user created on-the-fly via Client Web SDK');
                } catch (createErr: any) {
                  if (createErr.code === 'auth/email-already-in-use') {
                    console.log('Root email already exists, but password was wrong or auth unaligned.');
                  } else {
                    throw createErr;
                  }
                }
              } else {
                throw signInErr;
              }
            }

            // Write/merge the Firestore document via Web SDK if uid got resolved
            if (uid) {
              await setDoc(fDoc(db, 'users', uid), {
                email: email.toLowerCase(),
                username: email.toLowerCase().split('@')[0],
                fullName: email.toLowerCase().split('@')[0].toUpperCase() + ' (Root)',
                role: 'Admin',
                isRoot: true,
                password: password,
                disabled: false,
                createdAt: Date.now()
              }, { merge: true });
              console.log(`Successfully created/merged Root admin document via Client Web SDK for ${email}`);
              createdSuccessfully = true;
            }
          } catch (clientErr: any) {
            console.error('Client SDK root creation fallback failed:', clientErr.message);
          }
        }

        if (uid) {
          userDoc = {
            email: email,
            username: email.split('@')[0],
            fullName: email.split('@')[0].toUpperCase() + ' (Root)',
            role: 'Admin',
            isRoot: true,
            password: password,
            disabled: false
          };
          userDocId = uid;
        }
      }

      if (!userDoc) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (userDoc.disabled) {
        return res.status(403).json({ error: 'This account is currently disabled.' });
      }

      // If document has custom password, verify it directly
      if (userDoc.password) {
        if (userDoc.password === password) {
          // Generate secure customToken using firebase-admin to seamlessly sign in on-the-fly and self-heal any password/provider issues
          let customToken = '';
          try {
            customToken = await admin.auth().createCustomToken(userDocId);
            console.log('Successfully generated customToken for verified user:', userDocId);
          } catch (tokenErr: any) {
            console.warn('Could not generate customToken for user (will fall back to client password match):', tokenErr.message);
          }
          if (customToken) {
            return res.json({ success: true, customToken, email: email });
          } else {
            return res.json({ success: true, useClientAuth: true, email: email });
          }
        } else {
          return res.status(401).json({ error: 'Invalid login credentials' });
        }
      }

      // Legacy user/root verification with NO password field stored in Firestore
      let customToken = '';
      try {
        customToken = await admin.auth().createCustomToken(userDocId);
        console.log('Successfully generated customToken for legacy/root:', userDocId);
      } catch (tokenErr: any) {
        console.warn('Could not generate customToken for legacy/root:', tokenErr.message);
      }
      
      if (customToken) {
        return res.json({ success: true, customToken, email: email });
      } else {
        return res.json({ success: true, useClientAuth: true, email: email, isLegacyNoPasswordDoc: true });
      }

    } catch (err: any) {
      console.error('Verify login backend error:', err);
      return res.status(500).json({ error: err.message || 'Verification failed' });
    }
  });

  // Secure WhatsApp Notification Sender proxy
  app.post('/api/notifications/send-whatsapp', async (req, res) => {
    const { phone, message, orderId, eventType } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }

    try {
      // 1. Fetch settings from Firestore via Client SDK
      const settingsRef = doc(db, 'settings', 'whatsapp');
      const configSnap = await getDoc(settingsRef);
      const whatsappConfig = configSnap.exists() ? configSnap.data() : null;

      if (!whatsappConfig || !whatsappConfig.enabled) {
        // Log to Firestore even if disabled, showing Skipped
        await addDoc(collection(db, 'whatsapp_logs'), {
          phone,
          message,
          orderId: orderId || null,
          eventType: eventType || 'manual',
          status: 'Skipped',
          errorMsg: 'WhatsApp integrations are disabled in settings.',
          createdAt: Date.now()
        });
        return res.json({ success: true, status: 'Skipped', message: 'WhatsApp is disabled' });
      }

      const { provider, config } = whatsappConfig;
      let status = 'Success';
      let errorMsg = '';
      let externalResponse = '';

      if (provider === 'ultramsg') {
        const { instanceId, token } = config || {};
        if (!instanceId || !token) {
          throw new Error('UltraMsg Instance ID and Token are required.');
        }
        const url = `https://api.ultramsg.com/${instanceId}/messages/chat`;
        const params = new URLSearchParams();
        params.append('token', token);
        params.append('to', phone);
        params.append('body', message);

        const apiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params
        });
        const apiJson = await apiRes.json() as any;
        externalResponse = JSON.stringify(apiJson);
        if (!apiRes.ok || apiJson.error || (apiJson.success === false)) {
          status = 'Failed';
          errorMsg = apiJson.error || apiJson.message || 'UltraMsg API responded with error';
        }
      } else if (provider === 'twilio') {
        const { accountSid, token, sender } = config || {};
        if (!accountSid || !token || !sender) {
          throw new Error('Twilio Account SID, Token and Sender are required.');
        }
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${token}`).toString('base64');
        const params = new URLSearchParams();
        params.append('To', `whatsapp:${phone}`);
        params.append('From', `whatsapp:${sender.startsWith('whatsapp:') ? sender : 'whatsapp:' + sender}`);
        params.append('Body', message);

        const apiRes = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params
        });
        const apiJson = await apiRes.json() as any;
        externalResponse = JSON.stringify(apiJson);
        if (!apiRes.ok || apiJson.code || apiJson.status === 'failed') {
          status = 'Failed';
          errorMsg = apiJson.message || 'Twilio Error';
        }
      } else if (provider === 'custom') {
        const { customUrl, customMethod, customHeaders, customBody } = config || {};
        if (!customUrl) {
          throw new Error('Custom Destination URL is required.');
        }

        // Apply placeholders to URL or message body
        const finalUrl = customUrl.replace(/{phone}/g, encodeURIComponent(phone)).replace(/{message}/g, encodeURIComponent(message));
        let finalBody: any = null;

        if (customBody && (customMethod || 'POST') !== 'GET') {
          finalBody = customBody.replace(/{phone}/g, phone).replace(/{message}/g, message);
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (customHeaders) {
          const lines = customHeaders.split('\n');
          for (const line of lines) {
            const index = line.indexOf(':');
            if (index > -1) {
              const key = line.substring(0, index).trim();
              const val = line.substring(index + 1).trim();
              headers[key] = val;
            }
          }
        }

        const apiRes = await fetch(finalUrl, {
          method: customMethod || 'POST',
          headers,
          body: finalBody
        });
        const resText = await apiRes.text();
        externalResponse = resText;
        if (!apiRes.ok) {
          status = 'Failed';
          errorMsg = `HTTP Error ${apiRes.status}: ${resText.substring(0, 200)}`;
        }
      } else {
        status = 'Skipped';
        errorMsg = 'No active WhatsApp provider configured.';
      }

      // Add dispatch log to Firestore
      await addDoc(collection(db, 'whatsapp_logs'), {
        phone,
        message,
        orderId: orderId || null,
        eventType: eventType || 'manual',
        status,
        errorMsg: errorMsg || null,
        externalResponse: externalResponse.substring(0, 1000) || null,
        createdAt: Date.now()
      });

      return res.json({ success: status !== 'Failed' && status !== 'Skipped', status, errorMsg });
    } catch (e: any) {
      console.error('WhatsApp dispatch error:', e.message);
      try {
        await addDoc(collection(db, 'whatsapp_logs'), {
          phone,
          message,
          orderId: orderId || null,
          eventType: eventType || 'manual',
          status: 'Failed',
          errorMsg: e.message,
          createdAt: Date.now()
        });
      } catch (logErr) {
        console.error('Failed to write error log to Firestore:', logErr);
      }
      return res.status(500).json({ error: e.message });
    }
  });

  // Secure WhatsApp Credentials Test Connection endpoint
  app.post('/api/notifications/test-connection', async (req, res) => {
    const { provider, config } = req.body;
    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    try {
      if (provider === 'ultramsg') {
        const { instanceId, token } = config || {};
        if (!instanceId || !token) {
          throw new Error('UltraMsg Instance ID and Token are required.');
        }

        // Dummy call to check instance status instead of sending a message
        const url = `https://api.ultramsg.com/${instanceId}/instance/status?token=${token}`;
        const apiRes = await fetch(url);
        
        if (!apiRes.ok) {
          throw new Error(`UltraMsg returned HTTP error status ${apiRes.status}`);
        }

        const apiJson = await apiRes.json() as any;
        if (apiJson.error || apiJson.success === false) {
          throw new Error(apiJson.error || apiJson.message || 'Invalid UltraMsg Instance ID or Token');
        }

        return res.json({ 
          success: true, 
          message: 'UltraMsg connection verified successfully! Settings and Token are valid.',
          details: apiJson
        });

      } else if (provider === 'twilio') {
        const { accountSid, token } = config || {};
        if (!accountSid || !token) {
          throw new Error('Twilio Account SID and Token are required.');
        }

        // Fetch Twilio account info to verify auth keys without triggering message
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
        const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${token}`).toString('base64');

        const apiRes = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': authHeader
          }
        });

        if (!apiRes.ok) {
          const apiJson = await apiRes.json() as any;
          throw new Error(apiJson.message || `Twilio authentication failed with HTTP ${apiRes.status}`);
        }

        const apiJson = await apiRes.json() as any;
        return res.json({
          success: true,
          message: `Twilio connection verified successfully! Authorized account: "${apiJson.friendly_name}" with status: ${apiJson.status}.`,
          details: { status: apiJson.status, type: apiJson.type }
        });

      } else if (provider === 'custom') {
        const { customUrl, customMethod, customHeaders, customBody } = config || {};
        if (!customUrl) {
          throw new Error('Custom Destination URL is required.');
        }

        // Test if the endpoint is reachable. Since there's no generic status endpoint, 
        // we execute a dry-run test using dummy placeholders for {phone} and {message}
        let finalUrl = customUrl
          .replace(/{phone}/g, encodeURIComponent('0000000000'))
          .replace(/{message}/g, encodeURIComponent('Ping Connection Test'));

        // Optionally, append dryRun parameters
        if (finalUrl.includes('?')) {
          finalUrl += '&dryRun=true';
        } else {
          finalUrl += '?dryRun=true';
        }

        let finalBody: any = null;
        if (customBody && (customMethod || 'POST') !== 'GET') {
          finalBody = customBody
            .replace(/{phone}/g, '0000000000')
            .replace(/{message}/g, 'Ping Connection Test');
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };

        if (customHeaders) {
          const lines = customHeaders.split('\n');
          for (const line of lines) {
            const index = line.indexOf(':');
            if (index > -1) {
              const key = line.substring(0, index).trim();
              const val = line.substring(index + 1).trim();
              headers[key] = val;
            }
          }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        try {
          const apiRes = await fetch(finalUrl, {
            method: customMethod || 'POST',
            headers,
            body: finalBody,
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (apiRes.ok) {
            return res.json({
              success: true,
              message: `Custom endpoint URL has returned status HTTP ${apiRes.status}. Server verified online directly!`
            });
          } else {
            return res.json({
              success: true,
              message: `Custom host resolved successfully and replied with HTTP status ${apiRes.status} (${apiRes.statusText || 'Response Received'}). This confirms network connection and reachability.`,
              isWarning: apiRes.status >= 400
            });
          }
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          throw new Error(`Hostname connection or timeout error: ${fetchErr.message}`);
        }

      } else {
        throw new Error('Unsupported provider.');
      }

    } catch (e: any) {
      console.error('Test Connection Error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  });

  // ========== LOGISTICS HELPER FUNCTIONS ==========

  const STATUS_MAP_TO_AR: Record<string, string> = {
    'InfoReceived': 'تم تسجيل الطلب',
    'InTransit': 'جاري الشحن لليمن',
    'OutForDelivery': 'مع المندوب للتوصيل',
    'Delivered': 'تم التسليم',
    'Exception': 'ملغي',
    'Processing': 'تم تسجيل الطلب',
    'Shipped': 'جاري الشحن لليمن',
    'Arrived': 'وصل مركز التوزيع في اليمن',
    'Held': 'في التخليص الجمركي',
    'Customs': 'في التخليص الجمركي',
    'Available for pickup': 'وصل مركز التوزيع في اليمن',
    'Pending': 'تم تسجيل الطلب',
    'Packed': 'وصل مستودع السعودية',
    'Received': 'تم تسجيل الطلب',
    'Departed': 'جاري الشحن لليمن',
    'Picked Up': 'تم تسجيل الطلب',
    'Collection': 'تم التسليم',
    'Dispatched': 'جاري الشحن لليمن',
    'Sorted': 'وصل مستودع السعودية',
    'Out for delivery': 'مع المندوب للتوصيل',
    'Ready for collection': 'وصل مركز التوزيع في اليمن',
    'archive': 'تم التسليم',
    'active': 'جاري الشحن لليمن',
    'expired': 'ملغي',
    'undelivered': 'ملغي',
    'pickup': 'وصل مركز التوزيع في اليمن',
    'transit': 'جاري الشحن لليمن',
    'delivered': 'تم التسليم',
    'out_for_delivery': 'مع المندوب للتوصيل',
    'info_received': 'تم تسجيل الطلب',
    'alert': 'ملغي',
    'notfound': 'رقم تتبع غير معروف'
  };

  function normalizeStatus(status: string | undefined): string {
      if (!status) return 'تم تسجيل الطلب';
      // Direct lookup
      if (STATUS_MAP_TO_AR[status]) return STATUS_MAP_TO_AR[status];
      // Case insensitive check
      for (const key of Object.keys(STATUS_MAP_TO_AR)) {
          if (status.toLowerCase().includes(key.toLowerCase())) return STATUS_MAP_TO_AR[key];
      }
      return status; // Fallback to original
  }
  
  async function fetchExternalTracking(trackingNumber: string, apiConfig: any) {
      if (!apiConfig || !apiConfig.enabled) return null;
      
      let externalHistory: any[] | null = null;
      let externalStatus: string | null = null;
      let externalLocation: string | null = null;

      try {
          // AfterShip
          if (!externalHistory && apiConfig.provider === 'aftership' && apiConfig.apiKey) {
            const response = await fetch(`https://api.aftership.com/v4/trackings/${trackingNumber}`, {
              headers: { 'aftership-api-key': apiConfig.apiKey, 'Content-Type': 'application/json' }
            });
            if (response.ok) {
              const json = await response.json() as any;
              if (json.data && json.data.tracking) {
                 const t = json.data.tracking;
                 externalHistory = t.checkpoints.map((c: any) => ({
                    status: c.tag || 'Processing',
                    timestamp: new Date(c.checkpoint_time).getTime(),
                    location: [c.city, c.state, c.country_name].filter(Boolean).join(', ') || 'Global Transit Hub',
                    notes: c.message,
                    coordinates: c.coordinates || null 
                 }));
                 if (externalHistory && externalHistory.length > 0) {
                     externalStatus = t.tag;
                     externalLocation = externalHistory[externalHistory.length-1].location;
                 }
              }
            }
          }

          // 17TRACK
          if (!externalHistory && apiConfig.provider === '17track' && apiConfig.apiKey) {
            const headers = { '17token': apiConfig.apiKey, 'Content-Type': 'application/json' };
            const body = JSON.stringify([{ number: trackingNumber }]);
            let response = await fetch(`https://api.17track.net/track/v2.2/gettrackinfo`, { method: 'POST', headers, body });
            let json = await response.json() as any;

            if (json?.data?.accepted?.[0]?.track?.z1?.length > 0) {
                const t = json.data.accepted[0].track;
                externalHistory = t.z1.map((c: any) => ({
                    status: c.z || 'Processing',
                    timestamp: c.a ? new Date(c.a.replace(' ', 'T') + ':00Z').getTime() : Date.now(),
                    location: c.c || 'Global Transit Hub',
                    notes: c.z || '',
                    coordinates: null 
                })).sort((a: any, b: any) => a.timestamp - b.timestamp);
                
                externalStatus = t.e === 10 ? 'Delivered' : (t.e === 30 || t.e === 40 ? 'InTransit' : 'Processing');
                externalLocation = externalHistory && externalHistory.length > 0 ? externalHistory[externalHistory.length-1].location : 'Unknown';
            }
          }

          // TrackingMore
          if (!externalHistory && apiConfig.provider === 'trackingmore' && apiConfig.apiKey) {
            const response = await fetch(`https://api.trackingmore.com/v4/trackings/get?tracking_numbers=${trackingNumber}`, {
              headers: { 'Tracking-Api-Key': apiConfig.apiKey, 'Content-Type': 'application/json' }
            });
            if (response.ok) {
              const json = await response.json() as any;
              const t = json.data?.[0];
              if (t?.tracking_detail?.length > 0) {
                 externalHistory = t.tracking_detail.map((c: any) => ({
                    status: c.sub_status_id || c.status || 'Processing',
                    timestamp: new Date(c.checkpoint_date).getTime(),
                    location: c.location || 'Global Transit Hub',
                    notes: c.checkpoint_status || '',
                    coordinates: null 
                 })).sort((a: any, b: any) => a.timestamp - b.timestamp);
                 externalStatus = t.delivery_status || 'InTransit';
                 externalLocation = externalHistory && externalHistory.length > 0 ? externalHistory[externalHistory.length-1].location : 'Unknown';
              }
            }
          }

          // ParcelsApp v3 Integration
          if (!externalHistory && apiConfig.provider === 'parcelsapp' && apiConfig.apiKey) {
            const destCountry = apiConfig.defaultDestinationCountry || 'Yemen';
            
            // Phase 1: Initiate Tracking Request
            const initResponse = await fetch(`https://parcelsapp.com/api/v3/shipments/tracking`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                shipments: [{ trackingId: trackingNumber, destinationCountry: destCountry }], 
                language: 'en', 
                apiKey: apiConfig.apiKey 
              })
            });

            if (initResponse.ok) {
              let json = await initResponse.json() as any;
              
              // Phase 2: Polling if not done (Limit attempts to avoid hanging the request)
              let uuid = json.uuid;
              let attempts = 0;
              const maxAttempts = 6; 
              
              while (!json.done && uuid && attempts < maxAttempts) {
                await new Promise(r => setTimeout(r, 1500));
                const pollRes = await fetch(`https://parcelsapp.com/api/v3/shipments/tracking?apiKey=${apiConfig.apiKey}&uuid=${uuid}`);
                if (pollRes.ok) {
                   json = await pollRes.json();
                } else {
                   break;
                }
                attempts++;
              }

              const shipment = json.shipments?.find((s: any) => s.trackingId.toUpperCase() === trackingNumber.toUpperCase());
              
              if (shipment && shipment.states && shipment.states.length > 0) {
                 externalHistory = shipment.states.map((s: any) => ({
                    status: s.state || s.status || s.header || s.description || 'Processing',
                    timestamp: s.date ? new Date(s.date).getTime() : Date.now(),
                    location: s.location || 'Global Transit Hub',
                    notes: s.info || s.header || s.description || '',
                    coordinates: s.coordinates || null
                 })).sort((a: any, b: any) => a.timestamp - b.timestamp);
                 
                 externalStatus = shipment.status || (shipment.states && shipment.states.length > 0 ? (shipment.states[shipment.states.length-1].state || shipment.states[shipment.states.length-1].status) : 'InTransit');
                 externalLocation = externalHistory && externalHistory.length > 0 ? externalHistory[externalHistory.length-1].location : 'Unknown';
              }
            }
          }

      } catch (err: any) {
          console.error(`Fetch external tracking error (${trackingNumber}):`, err.message);
      }

      if (externalHistory) {
          return { history: externalHistory, status: externalStatus, location: externalLocation };
      }
      return null;
  }

  // ========== PERIODIC BACKGROUND SYNC TASK ==========

  async function syncActiveOrders() {
      console.log('[Sync] Starting periodic tracking synchronization...');
      try {
          const configSnap = await getDoc(doc(db, 'settings', 'logistics_api'));
          const apiConfig = configSnap.exists() ? configSnap.data() : null;
          if (!apiConfig || !apiConfig.enabled) return;

          const activeStatuses = ['تم تسجيل الطلب', 'جاري الشحن لليمن', 'في التخليص الجمركي', 'مع المندوب للتوصيل'];
          const ordersSnap = await getDocs(query(collection(db, 'orders'), where('orderStatus', 'in', activeStatuses)));
          
          if (ordersSnap.empty) return;

          for (const orderDoc of ordersSnap.docs) {
              const data = orderDoc.data();
              const trackingNumber = data.trackingNumber;
              if (!trackingNumber) continue;

              const result = await fetchExternalTracking(trackingNumber, apiConfig);
              if (result) {
                  const normalizedStatus = normalizeStatus(result.status);
                  const historyChanged = (result.history.length > (data.history?.length || 0));
                  const statusChanged = normalizedStatus !== data.orderStatus;

                  if (historyChanged || statusChanged) {
                      const updatePayload: any = {
                          history: result.history,
                          updatedAt: Date.now()
                      };
                      updatePayload.orderStatus = normalizedStatus;
                      if (result.location) updatePayload.locationYemen = result.location;

                      await updateDoc(doc(db, 'orders', orderDoc.id), updatePayload);

                      const publicRef = doc(db, 'public_tracking', trackingNumber.toUpperCase());
                      const publicSnap = await getDoc(publicRef);
                      if (publicSnap.exists()) {
                          await updateDoc(publicRef, {
                              status: normalizedStatus,
                              locationYemen: result.location || publicSnap.data().locationYemen,
                              history: result.history,
                              updatedAt: Date.now()
                          });
                      }
                  }
              }
              await new Promise(r => setTimeout(r, 500));
          }
          console.log('[Sync] Synchronization cycle completed.');
      } catch (err: any) {
          console.error('[Sync] Background synchronization failed:', err.message);
      }
  }

  // Start background sync loop (6 hours for full sweep)
  setInterval(syncActiveOrders, 6 * 60 * 60 * 1000);
  setTimeout(syncActiveOrders, 10000); 

  // ========== TRACKING AND LOGISTICS API INTEGRATION ==========
  
  // Real-time tracking resolution and telemetry fetch API
  // This acts as a proxy to third-party shipping APIs (like AfterShip, 17Track) 
  // safely obscuring API Keys from the frontend client.
  app.get('/api/tracking/live/:trackingId', async (req, res) => {
    const { trackingId } = req.params;
    if (!trackingId) return res.status(400).json({ error: 'Tracking number is required.' });

    try {
      const trackingNumber = trackingId.toUpperCase();
      // 1. Fetch Internal Document
      let internalDocData: any = null;
      const publicRef = await getDoc(doc(db, 'public_tracking', trackingNumber));
      if (publicRef.exists()) {
          internalDocData = publicRef.data();
      } else {
          // Robust query supporting case insensitivity by trying exact match and upper case
          const ordersSnap = await getDocs(query(collection(db, 'orders'), where('trackingNumber', 'in', [trackingId, trackingNumber]), limit(1)));
          if (!ordersSnap.empty) internalDocData = ordersSnap.docs[0].data();
      }

      // 2. Fetch external data using shared helper
      const configSnap = await getDoc(doc(db, 'settings', 'logistics_api'));
      const apiConfig = configSnap.exists() ? configSnap.data() : { enabled: false, provider: 'none' }; 
      
      const externalResult = await fetchExternalTracking(trackingNumber, apiConfig);

      // 3. Synthesize
      let trackingData: any = null;
      if (internalDocData || externalResult) {
          const statusToUse = normalizeStatus(externalResult?.status || internalDocData?.status || internalDocData?.orderStatus);
          const historyToUse = externalResult?.history || internalDocData?.history || [];
          
          trackingData = {
             status: statusToUse,
             currentLocation: externalResult?.location || internalDocData?.locationYemen || internalDocData?.location || 'مستودع الفرز والتبريد',
             history: historyToUse,
             isLiveApi: !!externalResult,
             docData: internalDocData || null 
          };

          // AUTO-SYNC: Persist external updates back to the primary record immediately
          if (externalResult && internalDocData) {
              try {
                  const historyChanged = (externalResult.history.length > (internalDocData.history?.length || 0));
                  const statusChanged = (statusToUse !== (internalDocData.status || internalDocData.orderStatus));
                  
                  if (historyChanged || statusChanged) {
                      const updatePayload: any = {
                          history: externalResult.history,
                          orderStatus: statusToUse,
                          updatedAt: Date.now()
                      };
                      if (externalResult.location) updatePayload.locationYemen = externalResult.location;

                      // Update the order if it was an order doc
                      const ordersSnap = await getDocs(query(collection(db, 'orders'), where('trackingNumber', '==', trackingNumber), limit(1)));
                      if (!ordersSnap.empty) {
                          await updateDoc(doc(db, 'orders', ordersSnap.docs[0].id), updatePayload);
                      }

                      // Update public tracking doc
                      const publicRef = doc(db, 'public_tracking', trackingNumber.toUpperCase());
                      const publicData = (await getDoc(publicRef));
                      if (publicData.exists()) {
                          await updateDoc(publicRef, {
                              ...updatePayload,
                              status: statusToUse // alignment
                          });
                      }
                      console.log(`[AutoSync] Live update persisted for ${trackingNumber}`);
                  }
              } catch (persistenceErr: any) {
                  console.error('[AutoSync] Failed to persist live update:', persistenceErr.message);
              }
          }
      } else if (externalResult) {
          trackingData = {
             status: externalResult.status || 'Processing',
             currentLocation: externalResult.location || 'Unknown',
             history: externalResult.history,
             isLiveApi: true
          };
      }

      if (!trackingData) return res.status(404).json({ error: 'Tracking not found neither externally nor internally.' });

      // Geocoding Coordinates Resolution:
      // Real tracking APIs usually only return text ("Riyadh", "Sanaa"). We need Lat/Lng for Maps.
      // So we map common hubs to coordinates.
      const locationMap: Record<string, [number, number]> = {
          'جدة': [21.4858, 39.1925],
          'مستودع السعودية': [21.4858, 39.1925],
          'مستودع الشحن الرئيسي (جدة - الرياض)': [24.7136, 46.6753],
          'أوتوستراد حرض': [16.4026, 43.1099],
          'في التخليص الجمركي': [16.4820, 42.9230], // الوديعة 
          'صنعاء': [15.3694, 44.1910],
          'مركز التوزيع في اليمن': [15.3694, 44.1910],
          'مستودع الفرز والترحيل': [15.4, 44.2],
          'تم التسليم': [15.3500, 44.2000],
      };

      // Best effort attach coordinates to live history array
      let currentLocCoords: [number, number] | null = null;
      if (trackingData.history && trackingData.history.length > 0) {
         trackingData.history = trackingData.history.map((h: any) => {
             let coords = h.coordinates || null;
             if (!coords) {
                 // Try exact or partial match
                 const locText = ((h.location || '') + ' ' + (h.status || '') + ' ' + (h.notes || '')).toLowerCase();
                 for (const key of Object.keys(locationMap)) {
                     if (locText.includes(key.toLowerCase())) {
                         coords = locationMap[key];
                         break;
                     }
                 }
             }
             if (coords) currentLocCoords = coords;

             return { ...h, coordinates: coords };
         });
      }

      trackingData.currentCoordinates = currentLocCoords || [15.3694, 44.1910]; // Default to Sanaa

      return res.json({ success: true, tracking: trackingData });
    } catch (e: any) {
      console.error('Tracking Read Error:', e.message);
      return res.status(500).json({ error: 'Failed to fetch live logistics payload.' });
    }
  });

  // Webhook Receiver for Automatic Third-Party Tracking status push updates
  app.post('/api/tracking/webhook', async (req, res) => {
    // Return 200 immediately to acknowledge webhook receipt
    res.status(200).json({ received: true });
    
    // Process payload asynchronously to avoid timeouts
    (async () => {
       try {
           const payload = req.body;
           // Example AfterShip webhook format: payload.msg.tracking_number, payload.msg.tag
           if (!payload || !payload.msg || !payload.msg.tracking_number) return;
           
           const trackingNumber = payload.msg.tracking_number;
           const newTag = payload.msg.tag; // 'Delivered', 'InTransit'
           const locationStr = payload.msg.checkpoint?.location || 'Unknown Checkpoint';
           
           // Query the order
           const ordersSnap = await getDocs(query(collection(db, 'orders'), where('trackingNumber', '==', trackingNumber), limit(1)));
           if (ordersSnap.empty) return;
           
           const orderDoc = ordersSnap.docs[0];
           const orderData = orderDoc.data();
           
           // Standardise tracking phase translation
           const historyMap: Record<string, string> = {
                'InfoReceived': 'تم تسجيل الطلب',
                'InTransit': 'جاري الشحن لليمن',
                'OutForDelivery': 'مع المندوب للتوصيل',
                'Delivered': 'تم التسليم',
                'Exception': 'ملغي'
            };
            const newStatusMap = historyMap[newTag] || 'جاري الشحن لليمن';
            const newHistoryEntry = {
                status: newStatusMap,
                location: locationStr,
                timestamp: Date.now(),
                notes: payload.msg.checkpoint?.message || 'Automatic third-party checkpoint update',
                createdBy: 'API_WEBHOOK'
            };
            const updatedHistory = [...(orderData.history || []), newHistoryEntry];
            // Update secured backend Order document
            await updateDoc(doc(db, 'orders', orderDoc.id), {
                orderStatus: newStatusMap,
                locationYemen: locationStr,
                history: updatedHistory,
                updatedAt: Date.now()
            });
            
            // If tracking interface was public, update that too
            const publicRef = doc(db, 'public_tracking', trackingNumber.toUpperCase());
            const publicSnap = await getDoc(publicRef);
            if (publicSnap.exists()) {
                await updateDoc(publicRef, {
                    status: newStatusMap,
                    locationYemen: locationStr,
                    history: updatedHistory,
                    updatedAt: Date.now()
                });
            }
            console.log(`[Webhook] Tracking ${trackingNumber} state machine advanced to ${newStatusMap}`);
        } catch (err: any) {
            console.error('[Webhook] Failed to process logistics update:', err.message);
        }
     })();
  });

  // Secure Logistics Credentials Test Connection
  app.post('/api/tracking/test-connection', async (req, res) => {
    const { provider, apiKey, defaultDestinationCountry } = req.body;
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and API Key are required' });
    }

    try {
      if (provider === 'parcelsapp') {
        const response = await fetch(`https://parcelsapp.com/api/v3/shipments/tracking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            shipments: [{ trackingId: 'PING_TEST_AUTH_CHECK', destinationCountry: defaultDestinationCountry || 'Yemen' }], 
            language: 'en', 
            apiKey 
          })
        });

        const json = await response.json() as any;
        if (response.ok && !json.error) {
          return res.json({ success: true, message: 'ParcelsApp v3 authenticated successfully!' });
        } else {
          throw new Error(json.error || 'ParcelsApp authentication failed');
        }
      } else if (provider === 'aftership') {
        const response = await fetch('https://api.aftership.com/v4/couriers', {
          headers: { 'aftership-api-key': apiKey, 'Content-Type': 'application/json' }
        });
        const json = await response.json() as any;
        if (response.ok && json.meta && json.meta.code === 200) {
          return res.json({ success: true, message: 'AfterShip API key is valid!' });
        } else {
          throw new Error(json.meta?.message || 'AfterShip authentication failed');
        }
      } else if (provider === 'sandbox') {
         return res.json({ success: true, message: 'Sandbox mode is virtualized and always ready.' });
      }

      return res.status(400).json({ error: 'Provider test not yet implemented' });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // API Fallback to prevent returning HTML for missing API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Vite Middleware / Static Files
  const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RESOURCES_PATH;

  if (!isProduction) {
    // وضع التطوير: استخدام Vite dev server
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // وضع الإنتاج: خدمة ملفات dist الثابتة
    // electron-builder يضع extraResources في process.resourcesPath
    // الـ dist مُضاف الآن كـ extraResource → resources/app/dist/
    const resourcesPath2 = process.env.RESOURCES_PATH || '';
    const possibleDistPaths = [
      // المسار الأساسي: resources/app/dist/ (extraResource)
      resourcesPath2 ? path.join(resourcesPath2, 'app', 'dist') : '',
      // نفس مجلد server.cjs → resources/app/dist/
      path.join(__dirname, 'dist'),
      // مستوى أعلى → resources/dist/
      path.join(__dirname, '..', 'dist'),
      // CWD
      path.resolve(process.cwd(), 'dist'),
    ].filter(Boolean);

    let distPath: string | undefined;
    for (const p of possibleDistPaths) {
      const indexFile = path.join(p, 'index.html');
      const exists = fs.existsSync(indexFile);
      console.log(`Production: Checking distPath: ${p} Exists: ${exists}`);
      if (exists) { distPath = p; break; }
    }

    if (distPath) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath!, 'index.html'));
      });
      console.log('Production: Serving static files from:', distPath);
    } else {
      console.error('CRITICAL: dist directory missing in production');
      app.get('*', (req, res) => {
        res.status(503).send(`
          <!DOCTYPE html><html dir="rtl" lang="ar">
          <head><meta charset="UTF-8"><title>alx</title>
          <style>body{font-family:sans-serif;background:#0a0f1e;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column}
          h1{color:#f59e0b}p{color:#94a3b8;max-width:400px;text-align:center}</style></head>
          <body><h1>⚠️ خطأ في التثبيت</h1>
          <p>ملفات التطبيق مفقودة. يرجى إعادة تثبيت alx.</p>
          <p style="font-size:12px;color:#475569">dist not found in: ${possibleDistPaths.join(', ')}</p>
          </body></html>`);
      });
    }
  }


  app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on port 3000');
  });
}

startServer();
