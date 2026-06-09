import express from 'express';
import path from 'path';
import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc, query, where, limit, getDocs, updateDoc } from 'firebase/firestore';
import { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword } from 'firebase/auth';

async function startServer() {
  const app = express();
  app.use(express.json());

  // Safe configuration reading to prevent startup crashes if config file doesn't exist
  let firebaseConfig: any = {};
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('Successfully loaded firebase-applet-config.json');
    } else {
      console.warn('firebase-applet-config.json not found, proceeding with process.env / ADC fallback.');
    }
  } catch (err: any) {
    console.error('Error reading firebase-applet-config.json:', err.message);
  }

  // Initialize Firebase Client (Web) SDK
  let firebaseApp;
  try {
    firebaseApp = initializeApp(firebaseConfig);
    console.log('Firebase Client SDK initialized on server successfully');
  } catch (e: any) {
    console.error('Firebase Client SDK init failed:', e.message);
  }

  const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  const auth = initializeAuth(firebaseApp, {
    persistence: inMemoryPersistence
  });

  // Authenticate the server session using system administrative account to secure backend operations
  const systemEmail = 'admin@swiftship.system';
  const systemPassword = 'swiftship@system_pw_2026'; // Standard master password for system synchronization
  try {
    await signInWithEmailAndPassword(auth, systemEmail, systemPassword);
    console.log('Backend server authenticated securely as admin@swiftship.system using Web SDK');
  } catch (authErr: any) {
    console.warn('Backend failed standard authentication with system master password:', authErr.message);
    if (authErr.code === 'auth/invalid-credential' || authErr.code === 'auth/user-not-found') {
      try {
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        await createUserWithEmailAndPassword(auth, systemEmail, systemPassword);
        console.log('Backend server successfully registered admin@swiftship.system on-the-fly');

        // Auto-seed admin user document in Firestore to enable immediate resolve-identifier and verify-login lookup list
        try {
          const { doc: fDoc, setDoc } = await import('firebase/firestore');
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

  // API Routes
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
    res.json({ status: 'ok', project: firebaseConfig.projectId || 'unknown' });
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

      const ROOT_EMAILS = ['alsrhyarslan5@gmail.com', 'arslan.alshamari@gmail.com', 'admin@swiftship.system'];
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
        // Return isLegacyNoPasswordDoc to force the client-side to authenticate actual entered password directly against Firebase Auth!
        // This ensures the custom password input cannot be bypassed or accepted with mock values for first-time root logins.
        return res.json({ success: true, useClientAuth: true, email: email, isLegacyNoPasswordDoc: true });
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
          return res.json({ success: true, useClientAuth: true, email: email });
        } else {
          return res.status(401).json({ error: 'Invalid login credentials' });
        }
      }

      // Legacy user/root verification with NO password field stored in Firestore
      // tag it as legacy, forcing client to authenticate with real user password
      return res.json({ success: true, useClientAuth: true, email: email, isLegacyNoPasswordDoc: true });

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

  // API Fallback to prevent returning HTML for missing API routes
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Standard path for build artifacts in AI Studio is 'dist' 
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
    } else {
        console.error('CRITICAL: dist directory missing in production');
        app.get('*', (req, res) => {
           res.status(500).send('Application is still building or dist directory is missing.');
        });
    }
  }

  // Secure Logistics Credentials Test Connection
  app.post('/api/tracking/test-connection', async (req, res) => {
    const { provider, apiKey, defaultDestinationCountry } = req.body;
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and API Key are required' });
    }

    try {
      if (provider === 'parcelsapp') {
        // v3 Ping test: initiate with a dummy ID (invalid but should auth properly)
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

  app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on port 3000');
  });
}

startServer();
