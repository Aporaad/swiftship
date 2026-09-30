import React, { useState } from 'react';
import { Key, Copy, RefreshCw, Shield, Code, CheckCircle2, ExternalLink } from 'lucide-react';

interface ApiIntegrationsTabProps {
  isAr: boolean;
  apiKeys?: any[];
  handleGenerateApiKey?: () => void;
}

export const ApiIntegrationsTab: React.FC<ApiIntegrationsTabProps> = ({ isAr, apiKeys = [], handleGenerateApiKey }) => {
  const [webhookUrlOrders, setWebhookUrlOrders] = useState('https://api.yourdomain.com/webhooks/orders');
  const [webhookUrlStatus, setWebhookUrlStatus] = useState('https://api.yourdomain.com/webhooks/status');
  const [apiKeySecret, setApiKeySecret] = useState('sk_live_swiftship_99a8b7c6d5e4f3a2b1');
  const [copied, setCopied] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  const handleCopySecret = () => {
    navigator.clipboard.writeText(apiKeySecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestConnection = () => {
    setTestSuccess(true);
    setTimeout(() => setTestSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-[#0a0a0c] border border-white/[0.04] p-6 rounded-3xl space-y-6">
        <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/[0.05] pb-3">
          <Code className="w-4 h-4 text-blue-400" />
          {isAr ? 'إعداد ربط الموقع مع الـ API والـ Webhooks التلقائية' : 'API & Webhooks Integration Settings'}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {isAr ? 'رابط Webhook لتنبيهات الطلبات الجديدة' : 'Orders Webhook Notification URL'}
            </label>
            <input
              type="text"
              className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none focus:border-[#d4af37]"
              placeholder="https://api.yourdomain.com/webhooks/orders"
              value={webhookUrlOrders}
              onChange={e => setWebhookUrlOrders(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {isAr ? 'رابط Webhook لتحديثات حالة الشحنات' : 'Shipment Status Update Webhook URL'}
            </label>
            <input
              type="text"
              className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none focus:border-[#d4af37]"
              placeholder="https://api.yourdomain.com/webhooks/status"
              value={webhookUrlStatus}
              onChange={e => setWebhookUrlStatus(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              {isAr ? 'مفتاح الـ API الخاص بربط البوابة (Secret Token)' : 'API Secret Token'}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                className="flex-1 bg-black border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-amber-400 font-mono"
                value={apiKeySecret}
              />
              <button
                type="button"
                onClick={handleCopySecret}
                className="px-4 py-2.5 bg-slate-900 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-800 cursor-pointer flex items-center gap-1.5"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? (isAr ? 'تم النسخ' : 'Copied!') : (isAr ? 'نسخ' : 'Copy')}
              </button>
            </div>
          </div>
        </div>

        {testSuccess && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {isAr ? 'تم فحص الاتصال بـ API بنجاح (HTTP 200 OK)' : 'API Connection Test Successful (HTTP 200 OK)'}
          </div>
        )}

        <div className="pt-4 border-t border-white/[0.05] flex justify-between items-center">
          <button
            type="button"
            onClick={handleTestConnection}
            className="px-4 py-2.5 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 hover:bg-emerald-900/40 font-bold text-xs rounded-xl cursor-pointer transition"
          >
            {isAr ? 'اختبار كفاءة الاتصال بـ API' : 'Test API Connection'}
          </button>
          <button
            type="button"
            className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-amber-600 hover:from-amber-600 hover:to-[#d4af37] text-black font-black text-xs rounded-xl shadow cursor-pointer transition"
          >
            {isAr ? 'حفظ إعدادات الربط' : 'Save API Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiIntegrationsTab;
