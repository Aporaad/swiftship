import React from 'react';
import { Globe, Activity, Users, User, Package, Briefcase, MessageSquare, Megaphone, Shield, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, RefreshCw, Plus, Trash2, Check, X, Eye, Edit2, Send, Server, Key, Lock, Settings as SettingsIcon, ChevronRight, ArrowUpRight, Award, UserCheck, ShieldAlert, Cpu, Phone, Mail, MapPin } from 'lucide-react';

export interface WebsiteSecurityTabProps {
  [key: string]: any;
}

export const WebsiteSecurityTab: React.FC<WebsiteSecurityTabProps> = (props) => {
  const { activeTab, isAr, secSettings, setSecSettings, toast } = props;

  return (
    <>
      {/* ── TAB 7: Website Security & Governance ──────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-[#0a0a0c] border border-white/[0.04] p-6 rounded-3xl space-y-6">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/[0.05] pb-3">
              <Shield className="w-4 h-4 text-emerald-400" />
              {isAr ? 'إعدادات وأمان وحوكمة موقع الويب للبوابة' : 'Website Security & Governance Configuration'}
            </h3>

            <div className="space-y-4">
              {[
                { key: 'allowPortalRegistration', title: isAr ? 'السماح بالتسجيل المباشر للحسابات الجديدة' : 'Allow Direct User Registrations', desc: isAr ? 'تمكين نموذج التسجيل للعملاء والمناديب عبر الموقع' : 'Enable registration form on public web portal' },
                { key: 'requireAdminApproval', title: isAr ? 'اشتراط موافقة الأدمن قبل تفعيل أي حساب جديد' : 'Require Admin Approval For New Accounts', desc: isAr ? 'توجيه أي حساب جديد إلى طابور الموافقة والمعاينة أولاً' : 'Put new accounts in pending queue until manually approved' },
                { key: 'allowGuestJobApplications', title: isAr ? 'السماح للزوار بالتقديم على الوظائف بدون حساب' : 'Allow Public Guest Job Applications', desc: isAr ? 'تمكين الزوار من التقديم عبر نموذج التوظيف بدون تسجيل الدخول' : 'Allow non-logged in visitors to submit job applications' },
                { key: 'portalMaintenanceMode', title: isAr ? 'وضع الصيانة لنموذج التوظيف والبوابة' : 'Maintenance Mode', desc: isAr ? 'توقيف استقبال الطلبات والتسجيل مؤقتاً للتحديث' : 'Temporarily disable portal registration & order submissions' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between p-4 bg-black/40 border border-white/[0.02] rounded-2xl">
                  <div>
                    <h4 className="font-bold text-white text-xs">{item.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => setSecSettings({ ...secSettings, [item.key]: !(secSettings as any)[item.key] })}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${(secSettings as any)[item.key] ? 'bg-emerald-500' : 'bg-slate-800'
                      }`}
                  >
                    <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${(secSettings as any)[item.key] ? 'right-0.5' : 'left-0.5'
                      }`} />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-white/[0.05] flex justify-end">
              <button
                onClick={() => toast.success(isAr ? 'تم حفظ إعدادات الأمان بنجاح' : 'Security settings saved')}
                className="px-6 py-2.5 bg-gradient-to-r from-[#d4af37] to-amber-600 text-black font-black text-xs rounded-xl shadow cursor-pointer"
              >
                {isAr ? 'حفظ إعدادات الأمان' : 'Save Security Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WebsiteSecurityTab;
