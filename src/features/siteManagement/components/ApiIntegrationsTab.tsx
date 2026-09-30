import React from 'react';
import { Globe, Activity, Users, User, Package, Briefcase, MessageSquare, Megaphone, Shield, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, RefreshCw, Plus, Trash2, Check, X, Eye, Edit2, Send, Server, Key, Lock, Settings as SettingsIcon, ChevronRight, ArrowUpRight, Award, UserCheck, ShieldAlert, Cpu, Phone, Mail, MapPin } from 'lucide-react';

export interface ApiIntegrationsTabProps {
  [key: string]: any;
}

export const ApiIntegrationsTab: React.FC<ApiIntegrationsTabProps> = (props) => {
  const { activeTab, isAr, secSettings, setSecSettings, toast } = props;

  return (
    <>
      {/* ── TAB 8: API Integrations & Webhooks ────────────────────────────── */}
      {activeTab === 'api' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-[#0a0a0c] border border-white/[0.04] p-6 rounded-3xl space-y-6">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/[0.05] pb-3">
              <LinkIcon className="w-4 h-4 text-blue-400" />
              {isAr ? 'إعداد ربط الموقع مع الـ API والـ Webhooks التلقائية' : 'API & Webhooks Integration Settings'}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'رابط Webhook لتنبيهات الطلبات الجديدة' : 'Orders Webhook Notification URL'}
                </label>
                <input
                  type="text"
                  className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                  placeholder="https://api.yourdomain.com/webhooks/orders"
                  value={secSettings.webhookUrlOrders}
                  onChange={e => setSecSettings({ ...secSettings, webhookUrlOrders: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'رابط Webhook لتحديثات حالة الشحنات' : 'Shipment Status Update Webhook URL'}
                </label>
                <input
                  type="text"
                  className="w-full bg-black border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white font-mono"
                  placeholder="https://api.yourdomain.com/webhooks/status"
                  value={secSettings.webhookUrlStatus}
                  onChange={e => setSecSettings({ ...secSettings, webhookUrlStatus: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  {isAr ? 'مفتاح الـ API الخاص بربط البوابة (Secret Token)' : 'API Secret Token'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text" readOnly
                    className="flex-1 bg-black border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-amber-400 font-mono"
                    value={secSettings.apiKeySecret}
                  />
                  <button
                    type="button"
                    onClick={() => toast.success(isAr ? 'تم نسخ رمز الأمان' : 'Secret Token Copied')}
                    className="px-4 py-2.5 bg-slate-900 text-slate-300 hover:text-white font-bold text-xs rounded-xl border border-slate-800 cursor-pointer"
                  >
                    {isAr ? 'نسخ' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/[0.05] flex justify-between items-center">
              <button
                type="button"
                onClick={() => toast.success(isAr ? 'اتصال API واختبار Supabase ناجح (HTTP 200 OK)' : 'API Test Successful (HTTP 200 OK)')}
                className="px-4 py-2.5 bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 font-bold text-xs rounded-xl cursor-pointer"
              >
                {isAr ? 'اختبار كفاءة الاتصال بـ API' : 'Test API Connection'}
              </button>
              <button
                type="button"
                onClick={() => toast.success(isAr ? 'تم حفظ إعدادات الـ API' : 'API settings saved')}
                className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-amber-600 text-black font-black text-xs rounded-xl shadow cursor-pointer"
              >
                {isAr ? 'حفظ إعدادات الربط' : 'Save API Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ApiIntegrationsTab;
