import React from 'react';
import { Globe, Activity, Users, User, Package, Briefcase, MessageSquare, Megaphone, Shield, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, RefreshCw, Plus, Trash2, Check, X, Eye, Edit2, Send, Server, Key, Lock, Settings as SettingsIcon, ChevronRight, ArrowUpRight, Award, UserCheck, ShieldAlert, Cpu, Phone, Mail, MapPin } from 'lucide-react';

export interface AnnouncementsTabProps {
  [key: string]: any;
}

export const AnnouncementsTab: React.FC<AnnouncementsTabProps> = (props) => {
  const { activeTab, isAr, showAnnForm, setShowAnnForm, handleCreateAnnouncement, annForm, setAnnForm, announcements, handleToggleAnnActive, handleDeleteAnn } = props;

  return (
    <>
      {/* ── TAB 5: Announcements Management ──────────────────────────────── */}
      {activeTab === 'announcements' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-purple-400" />
              {isAr ? 'إدارة ونشر الإعلانات والعروض للبوابة' : 'Announcements & Offers Manager'}
            </h3>
            <button
              onClick={() => setShowAnnForm(!showAnnForm)}
              className="px-4 py-2 bg-gradient-to-r from-[#d4af37] to-amber-600 text-black font-black text-xs rounded-xl hover:from-amber-400 cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {isAr ? 'إعلان جديد' : 'New Announcement'}
            </button>
          </div>

          {/* Form */}
          {showAnnForm && (
            <form onSubmit={handleCreateAnnouncement} className="bg-[#0a0a0c] border border-[#d4af37]/30 p-5 rounded-2xl space-y-4">
              <h4 className="font-bold text-white text-sm">{isAr ? 'إنشاء إعلان أو عرض جديد' : 'Create New Announcement'}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text" required
                  placeholder={isAr ? 'عنوان الإعلان' : 'Title'}
                  className="bg-black border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  value={annForm.title}
                  onChange={e => setAnnForm({ ...annForm, title: e.target.value })}
                />
                <div className="flex gap-2">
                  <select
                    className="bg-black border border-slate-800 rounded-xl px-3 py-2 text-xs text-white flex-1"
                    value={annForm.targetAudience}
                    onChange={e => setAnnForm({ ...annForm, targetAudience: e.target.value })}
                  >
                    <option value="all">{isAr ? 'جميع مستخدمي البوابة' : 'All Users'}</option>
                    <option value="customer">{isAr ? 'العملاء فقط' : 'Customers Only'}</option>
                    <option value="courier">{isAr ? 'المناديب فقط' : 'Couriers Only'}</option>
                    <option value="supplier">{isAr ? 'الموردين فقط' : 'Suppliers Only'}</option>
                  </select>
                  <select
                    className="bg-black border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    value={annForm.priority}
                    onChange={e => setAnnForm({ ...annForm, priority: e.target.value })}
                  >
                    <option value="normal">{isAr ? 'عادي' : 'Normal'}</option>
                    <option value="urgent">{isAr ? 'عاجل' : 'Urgent'}</option>
                  </select>
                </div>
              </div>
              <textarea
                required rows={3}
                placeholder={isAr ? 'محتوى الإعلان أو العرض...' : 'Content...'}
                className="w-full bg-black border border-slate-800 rounded-xl p-3 text-xs text-white"
                value={annForm.content}
                onChange={e => setAnnForm({ ...annForm, content: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAnnForm(false)} className="px-4 py-2 bg-slate-900 text-slate-400 text-xs rounded-xl cursor-pointer">
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl cursor-pointer">
                  {isAr ? 'نشر الإعلان' : 'Publish'}
                </button>
              </div>
            </form>
          )}

          {/* List */}
          <div className="space-y-3">
            {announcements.map(ann => (
              <div key={ann.id} className="bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl flex justify-between items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{ann.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ann.priority === 'urgent' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-300'
                      }`}>
                      {ann.priority === 'urgent' ? (isAr ? 'عاجل' : 'Urgent') : (isAr ? 'عادي' : 'Normal')}
                    </span>
                    <span className="text-[10px] text-slate-500">مستهدف: {ann.targetAudience || 'الكل'}</span>
                  </div>
                  <p className="text-xs text-slate-400">{ann.content}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleAnnActive(ann)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer border ${ann.isActive || ann.is_active ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40' : 'bg-slate-900 text-slate-500 border-slate-800'
                      }`}
                  >
                    {ann.isActive || ann.is_active ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطل' : 'Inactive')}
                  </button>
                  <button onClick={() => handleDeleteAnn(ann.id)} className="p-2 text-rose-400 hover:bg-rose-950/40 rounded-xl cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default AnnouncementsTab;
