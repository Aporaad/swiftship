import React from 'react';
import { Globe, Activity, Users, User, Package, Briefcase, MessageSquare, Megaphone, Shield, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, RefreshCw, Plus, Trash2, Check, X, Eye, Edit2, Send, Server, Key, Lock, Settings as SettingsIcon, ChevronRight, ArrowUpRight, Award, UserCheck, ShieldAlert, Cpu, Phone, Mail, MapPin } from 'lucide-react';

export interface PortalOrdersTabProps {
  [key: string]: any;
}

export const PortalOrdersTab: React.FC<PortalOrdersTabProps> = (props) => {
  const { activeTab, isAr, portalOrders } = props;

  return (
    <>
      {/* ── TAB 3: Web Portal Orders ──────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              {isAr ? 'استقبال وتوجيه طلبات البوابة الإلكترونية' : 'Web Portal Orders Routing'}
            </h3>
            <span className="text-xs text-slate-400 font-bold">{portalOrders.length} طلبات موقع</span>
          </div>

          {portalOrders.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-[#0a0a0c] border border-white/[0.04] rounded-3xl">
              <Package className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-sm font-bold text-white">{isAr ? 'لا توجد طلبات جديدة من البوابة حالياً' : 'No web portal orders found'}</p>
            </div>
          ) : (
            <div className="bg-[#0a0a0c] border border-white/[0.04] rounded-3xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right text-slate-300">
                  <thead className="bg-black/50 text-slate-400 font-bold border-b border-white/[0.05]">
                    <tr>
                      <th className="p-3.5">رقم الطلب</th>
                      <th className="p-3.5">التاريخ</th>
                      <th className="p-3.5">العميل / المستلم</th>
                      <th className="p-3.5">مصدر الشراء</th>
                      <th className="p-3.5">الحالة</th>
                      <th className="p-3.5">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {portalOrders.map(ord => (
                      <tr key={ord.id} className="hover:bg-white/[0.02]">
                        <td className="p-3.5 font-bold font-mono text-[#d4af37]">{ord.orderNumber || ord.trackingNumber || ord.id.slice(0, 10)}</td>
                        <td className="p-3.5 font-mono text-slate-400">{ord.createdAt ? new Date(ord.createdAt).toLocaleDateString('en-GB') : '—'}</td>
                        <td className="p-3.5">
                          <div className="font-bold text-white">{ord.customerName || ord.recipientName || '—'}</div>
                          <div className="text-[10px] text-slate-500">{ord.customerPhone || ord.deliveryCity}</div>
                        </td>
                        <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-bold">{ord.orderSourceName || 'البوابة'}</span></td>
                        <td className="p-3.5"><span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">{ord.orderStatus || ord.status || 'معلق'}</span></td>
                        <td className="p-3.5 font-bold text-white">{ord.totalPrice || ord.totalAmount || 0} YER</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default PortalOrdersTab;
