/**
 * مسارات إشعارات WhatsApp
 * WhatsApp Notification Routes — send and test WhatsApp notifications via various providers.
 *
 * هذه المسارات مُستخرجة من server.ts لعزل منطق الإشعارات.
 * Extracted from server.ts to isolate WhatsApp notification logic.
 */

import type { Express } from 'express';
import { addDoc, collection, doc, getDoc } from '../current-db/client';

/**
 * تسجيل مسارات إشعارات WhatsApp.
 * Registers WhatsApp notification routes on the Express app.
 *
 * @param app - تطبيق Express / Express application
 * @param db - عميل قاعدة البيانات / Database client
 */
export function registerWhatsAppRoutes(app: Express, db: any): void {
  // ── إرسال إشعار WhatsApp ─────────────────────────────────────
  // Secure WhatsApp notification sender proxy
  app.post('/api/notifications/send-whatsapp', async (req, res) => {
    const { phone, message, orderId, eventType } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ error: 'Phone and message are required' });
    }

    try {
      // جلب إعدادات WhatsApp من قاعدة البيانات / Fetch WhatsApp settings from DB
      const settingsRef = doc(db, 'settings', 'whatsapp');
      const configSnap = await getDoc(settingsRef);
      const whatsappConfig = configSnap.exists() ? configSnap.data() : null;

      if (!whatsappConfig?.enabled) {
        await addDoc(null, collection(db, 'whatsapp_logs'), {
          phone, message, orderId: orderId || null,
          eventType: eventType || 'manual',
          status: 'Skipped',
          errorMsg: 'WhatsApp integrations are disabled in settings.',
          createdAt: Date.now(),
        });
        return res.json({ success: true, status: 'Skipped', message: 'WhatsApp is disabled' });
      }

      const { provider, config } = whatsappConfig;
      let status = 'Success';
      let errorMsg = '';
      let externalResponse = '';

      // ── UltraMsg ────────────────────────────────────────────────
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
          body: params,
        });
        const apiJson = await apiRes.json() as any;
        externalResponse = JSON.stringify(apiJson);
        if (!apiRes.ok || apiJson.error || apiJson.success === false) {
          status = 'Failed';
          errorMsg = apiJson.error || apiJson.message || 'UltraMsg API responded with error';
        }

      // ── Twilio ──────────────────────────────────────────────────
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
          headers: { 'Authorization': authHeader, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params,
        });
        const apiJson = await apiRes.json() as any;
        externalResponse = JSON.stringify(apiJson);
        if (!apiRes.ok || apiJson.code || apiJson.status === 'failed') {
          status = 'Failed';
          errorMsg = apiJson.message || 'Twilio Error';
        }

      // ── Custom Provider ─────────────────────────────────────────
      } else if (provider === 'custom') {
        const { customUrl, customMethod, customHeaders, customBody } = config || {};
        if (!customUrl) throw new Error('Custom Destination URL is required.');

        const finalUrl = customUrl
          .replace(/{phone}/g, encodeURIComponent(phone))
          .replace(/{message}/g, encodeURIComponent(message));

        let finalBody: string | null = null;
        if (customBody && (customMethod || 'POST') !== 'GET') {
          finalBody = customBody.replace(/{phone}/g, phone).replace(/{message}/g, message);
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (customHeaders) {
          for (const line of customHeaders.split('\n')) {
            const index = line.indexOf(':');
            if (index > -1) {
              headers[line.substring(0, index).trim()] = line.substring(index + 1).trim();
            }
          }
        }

        const apiRes = await fetch(finalUrl, {
          method: customMethod || 'POST',
          headers,
          body: finalBody,
        });
        externalResponse = await apiRes.text();
        if (!apiRes.ok) {
          status = 'Failed';
          errorMsg = `HTTP Error ${apiRes.status}: ${externalResponse.substring(0, 200)}`;
        }

      } else {
        status = 'Skipped';
        errorMsg = 'No active WhatsApp provider configured.';
      }

      // تسجيل نتيجة الإرسال / Log dispatch result
      await addDoc(null, collection(db, 'whatsapp_logs'), {
        phone, message, orderId: orderId || null,
        eventType: eventType || 'manual',
        status,
        errorMsg: errorMsg || null,
        externalResponse: externalResponse.substring(0, 1000) || null,
        createdAt: Date.now(),
      });

      return res.json({ success: status !== 'Failed' && status !== 'Skipped', status, errorMsg });
    } catch (e: any) {
      console.error('[WhatsApp] Dispatch error:', e.message);
      try {
        await addDoc(null, collection(db, 'whatsapp_logs'), {
          phone, message, orderId: orderId || null,
          eventType: eventType || 'manual',
          status: 'Failed',
          errorMsg: e.message,
          createdAt: Date.now(),
        });
      } catch (logErr) {
        console.error('[WhatsApp] Failed to write error log:', logErr);
      }
      return res.status(500).json({ error: e.message });
    }
  });

  // ── اختبار اتصال WhatsApp ────────────────────────────────────
  // Secure WhatsApp credentials test-connection endpoint
  app.post('/api/notifications/test-connection', async (req, res) => {
    const { provider, config } = req.body;
    if (!provider) {
      return res.status(400).json({ error: 'Provider is required' });
    }

    try {
      // ── UltraMsg ──────────────────────────────────────────────
      if (provider === 'ultramsg') {
        const { instanceId, token } = config || {};
        if (!instanceId || !token) {
          throw new Error('UltraMsg Instance ID and Token are required.');
        }
        const url = `https://api.ultramsg.com/${instanceId}/instance/status?token=${token}`;
        const apiRes = await fetch(url);
        if (!apiRes.ok) throw new Error(`UltraMsg returned HTTP error status ${apiRes.status}`);
        const apiJson = await apiRes.json() as any;
        if (apiJson.error || apiJson.success === false) {
          throw new Error(apiJson.error || apiJson.message || 'Invalid UltraMsg Instance ID or Token');
        }
        return res.json({
          success: true,
          message: 'UltraMsg connection verified successfully! Settings and Token are valid.',
          details: apiJson,
        });

      // ── Twilio ────────────────────────────────────────────────
      } else if (provider === 'twilio') {
        const { accountSid, token } = config || {};
        if (!accountSid || !token) throw new Error('Twilio Account SID and Token are required.');
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`;
        const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${token}`).toString('base64');
        const apiRes = await fetch(url, { method: 'GET', headers: { 'Authorization': authHeader } });
        if (!apiRes.ok) {
          const apiJson = await apiRes.json() as any;
          throw new Error(apiJson.message || `Twilio authentication failed with HTTP ${apiRes.status}`);
        }
        const apiJson = await apiRes.json() as any;
        return res.json({
          success: true,
          message: `Twilio connection verified! Account: "${apiJson.friendly_name}" status: ${apiJson.status}.`,
          details: { status: apiJson.status, type: apiJson.type },
        });

      // ── Custom ────────────────────────────────────────────────
      } else if (provider === 'custom') {
        const { customUrl, customMethod, customHeaders, customBody } = config || {};
        if (!customUrl) throw new Error('Custom Destination URL is required.');

        let finalUrl = customUrl
          .replace(/{phone}/g, encodeURIComponent('0000000000'))
          .replace(/{message}/g, encodeURIComponent('Ping Connection Test'));
        finalUrl += finalUrl.includes('?') ? '&dryRun=true' : '?dryRun=true';

        let finalBody: string | null = null;
        if (customBody && (customMethod || 'POST') !== 'GET') {
          finalBody = customBody
            .replace(/{phone}/g, '0000000000')
            .replace(/{message}/g, 'Ping Connection Test');
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (customHeaders) {
          for (const line of customHeaders.split('\n')) {
            const index = line.indexOf(':');
            if (index > -1) {
              headers[line.substring(0, index).trim()] = line.substring(index + 1).trim();
            }
          }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
          const apiRes = await fetch(finalUrl, {
            method: customMethod || 'POST',
            headers,
            body: finalBody,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          return res.json({
            success: true,
            message: apiRes.ok
              ? `Custom endpoint returned HTTP ${apiRes.status}. Server verified online!`
              : `Custom host replied with HTTP ${apiRes.status} — network reachable.`,
            isWarning: !apiRes.ok,
          });
        } catch (fetchErr: any) {
          clearTimeout(timeoutId);
          throw new Error(`Hostname connection or timeout error: ${fetchErr.message}`);
        }

      } else {
        throw new Error('Unsupported provider.');
      }
    } catch (e: any) {
      console.error('[WhatsApp] Test Connection Error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  });
}
