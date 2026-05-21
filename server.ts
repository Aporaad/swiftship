import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, addDoc, query, where, limit, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';

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
  
  let firebaseApp;
  try {
    firebaseApp = initializeApp(firebaseConfig);
    console.log('Firebase Client SDK initialized on server successfully');
  } catch (e: any) {
    console.error('Firebase Client SDK init failed:', e.message);
  }

  const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  const auth = getAuth(firebaseApp);

  // Authenticate the server session using system administrative account
  const systemEmail = 'admin@swiftship.system';
  const systemPassword = 'password123';
  try {
    await signInWithEmailAndPassword(auth, systemEmail, systemPassword);
    console.log('Backend server authenticated securely as admin@swiftship.system');
  } catch (authErr: any) {
    console.error('WARNING: Backend failed to authenticate session on startup:', authErr.message);
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

      // Lookup username in Firestore via authenticated Web SDK
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

  // Secure WhatsApp Notification Sender proxy
  app.post('/api/notifications/send-whatsapp', async (req, res) => {
    const { phone, message, orderId, eventType } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }

    try {
      // 1. Fetch settings from Firestore via authenticated Web SDK
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
      } else if (provider === 'sandbox') {
        status = 'Simulated';
        externalResponse = 'Simulated Delivery Successful (Sandbox Mode)';
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
      if (provider === 'sandbox') {
        return res.json({ 
          success: true, 
          message: 'Sandbox mode is fully simulated and virtualized. No real credentials needed.' 
        });
      }

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

  // Vite Middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(3000, '0.0.0.0', () => {
    console.log('Server running on port 3000');
  });
}

startServer();
