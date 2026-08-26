import React, { useState, useEffect } from 'react';
import { X, Check, ShieldAlert, UserCheck, RefreshCw } from 'lucide-react';
import { supabase, doc, updateDoc, setDoc, db } from '../lib/supabase-firebase-adapter';
import { financialAccountService } from '../services/financialAccountService';

function extractRows(data: any[]): any[] {
  return (data || []).map(row => {
    const payload = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
    return { id: row.id, ...payload };
  });
}

export default function PendingPortalApprovalsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) loadPending();
  }, [isOpen]);

  const loadPending = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('portal_users').select('*');
      const allUsers = extractRows(data || []);
      const pending = allUsers.filter((u: any) => u.approvalStatus === 'pending_approval' || u.approval_status === 'pending_approval');
      setPendingUsers(pending);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (user: any) => {
    setActioningId(user.id);
    try {
      const userRole = user.portalRole || user.portal_role;
      const targetEntityId = user.linkedAccId || user.id;

      // 1. Update portal_users table status to approved
      const existingUserDoc = pendingUsers.find(u => u.id === user.id) || {};
      const updatedUserPayload = {
        ...existingUserDoc,
        approvalStatus: 'approved',
        approval_status: 'approved',
        updatedAt: Date.now()
      };
      const { id: _, ...cleanPayload } = updatedUserPayload;
      await supabase.from('portal_users').update({ data: cleanPayload }).eq('id', user.id);

      // 2. If Courier, activate courier record in main system couriers collection & ensure financial account
      if (userRole === 'courier') {
        const courierData = {
          fullName: user.fullName || user.full_name || '',
          phone: user.phone || '',
          email: user.email || '',
          address: user.address || '',
          disabled: false,
          notes: 'تم اعتماده وتنشيط حسابه عبر البوابة',
          createdAt: Date.now(),
        };
        await setDoc(doc(db, 'couriers', targetEntityId), courierData, { merge: true });

        try {
          await financialAccountService.createAccountForEntity(
            'courier',
            targetEntityId,
            user.fullName || user.full_name || 'مندوب جديد',
            'YER'
          );
        } catch (accErr) {
          console.warn('[PendingPortalApprovalsModal] Account auto-creation warning for courier:', accErr);
        }
      }

      // 3. If Supplier, activate source record in main system sources collection
      if (userRole === 'supplier') {
        const sourceData = {
          name: user.fullName || user.full_name || '',
          phone: user.phone || '',
          email: user.email || '',
          notes: 'مورد معتمد من بوابة الويب',
          createdAt: Date.now(),
        };
        await setDoc(doc(db, 'sources', targetEntityId), sourceData, { merge: true });
      }

      await loadPending();
    } catch (err) {
      console.error("Error approving portal user:", err);
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (userId: string) => {
    setActioningId(userId);
    try {
      const existingUserDoc = pendingUsers.find(u => u.id === userId) || {};
      const updatedUserPayload = {
        ...existingUserDoc,
        approvalStatus: 'rejected',
        approval_status: 'rejected',
        updatedAt: Date.now()
      };
      const { id: _, ...cleanPayload } = updatedUserPayload;
      await supabase.from('portal_users').update({ data: cleanPayload }).eq('id', userId);
      await loadPending();
    } catch (err) {
      console.error("Error rejecting portal user:", err);
    } finally {
      setActioningId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-[#0d0d0f] border border-[#d4af37]/30 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl relative">
        <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-[#d4af37]/60 to-transparent" />

        <div className="p-4 sm:p-6 border-b border-slate-900 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">مراجعة واعتماد حسابات البوابة المعلقة</h2>
              <p className="text-xs text-slate-400">طلبات انضمام المناديب والموردين الجدد من موقع الويب</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-xs text-slate-400">جاري تحميل الطلبات المعلقة...</p>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <UserCheck className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-sm font-medium">لا توجد طلبات انضمام معلقة حالياً</p>
              <p className="text-xs text-slate-500">تمت مراجعة واعتماد جميع الحسابات المسجلة عبر البوابة.</p>
            </div>
          ) : (
            pendingUsers.map(u => (
              <div key={u.id} className="bg-slate-950/60 border border-slate-900 hover:border-amber-500/30 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{u.fullName || u.full_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      (u.portalRole || u.portal_role) === 'courier'
                        ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                        : 'bg-purple-950/40 text-purple-400 border border-purple-800/40'
                    }`}>
                      {(u.portalRole || u.portal_role) === 'courier' ? '🚚 مندوب' : '🏭 مورد'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-3">
                    <span>📱 {u.phone}</span>
                    <span>✉️ {u.email}</span>
                  </div>
                  {(u.city || u.address) && (
                    <div className="text-[11px] text-slate-500">📍 {u.city} {u.address}</div>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    disabled={actioningId === u.id}
                    onClick={() => handleReject(u.id)}
                    className="px-3 py-2 rounded-lg bg-rose-950/30 text-rose-400 hover:bg-rose-900/50 border border-rose-800/30 text-xs font-bold transition-all cursor-pointer"
                  >
                    رفض
                  </button>
                  <button
                    disabled={actioningId === u.id}
                    onClick={() => handleApprove(u)}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black text-xs font-bold shadow-md shadow-amber-950/30 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {actioningId === u.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    اعتماد وتفعيل الحساب
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
