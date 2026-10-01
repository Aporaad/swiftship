import React from 'react';
import { Globe, Activity, Users, User, Package, Briefcase, MessageSquare, Megaphone, Shield, Link as LinkIcon, CheckCircle2, Clock, AlertCircle, RefreshCw, Plus, Trash2, Check, X, Eye, Edit2, Send, Server, Key, Lock, Settings as SettingsIcon, ChevronRight, ArrowUpRight, Award, UserCheck, ShieldAlert, Cpu, Phone, Mail, MapPin } from 'lucide-react';

type SiteTab = 'analytics' | 'portal_users' | 'pending' | 'orders' | 'tickets' | 'announcements' | 'jobs' | 'security' | 'api';
type TicketReply = { sender?: string; createdAt: string | number | Date; message: string };
type SupportTicket = { id: string; subject?: string; userName?: string; userEmail?: string; status?: string; message: string; replies?: TicketReply[] };
export interface SupportTicketsTabProps {
  activeTab: SiteTab;
  isAr: boolean;
  tickets: SupportTicket[];
  replyingTicketId: string | null;
  setReplyingTicketId: (id: string | null) => void;
  ticketReplyText: string;
  setTicketReplyText: (value: string) => void;
  handleReplyTicket: (id: string) => void;
  actionId: string | null;
}

export const SupportTicketsTab: React.FC<SupportTicketsTabProps> = (props) => {
  const { activeTab, isAr, tickets, replyingTicketId, setReplyingTicketId, ticketReplyText, setTicketReplyText, handleReplyTicket, actionId } = props;

  return (
    <>
      {/* ── TAB 4: Support Tickets View ───────────────────────────────────── */}
      {activeTab === 'tickets' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              {isAr ? 'شاشة الرد على الشكاوى والاقتراحات والدعم الفني' : 'Customer Support & Tickets Management'}
            </h3>
            <span className="text-xs text-slate-400 font-bold">{tickets.length} تذاكر</span>
          </div>

          {tickets.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2 bg-[#0a0a0c] border border-white/[0.04] rounded-3xl">
              <MessageSquare className="w-12 h-12 mx-auto text-slate-600" />
              <p className="text-sm font-bold text-white">{isAr ? 'لا توجد شكاوى أو تذاكر حالياً' : 'No support tickets found'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map(t => (
                <div key={t.id} className="bg-[#0a0a0c] border border-white/[0.04] p-5 rounded-2xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-white text-sm">{t.subject || 'بدون عنوان'}</h4>
                      <span className="text-xs text-slate-400 block">{t.userName || t.userEmail}</span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${t.status === 'open' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                      {t.status === 'open' ? (isAr ? 'مفتوحة' : 'Open') : (isAr ? 'تم الرد' : 'Resolved')}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 bg-black/40 p-3 rounded-xl border border-white/[0.02]">{t.message}</p>

                  {/* Replies history */}
                  {Array.isArray(t.replies) && t.replies.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/[0.03]">
                      <span className="text-[10px] text-slate-500 font-bold block">الردود السابقة:</span>
                      {t.replies.map((rep, idx) => (
                        <div key={idx} className="text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <span className="text-amber-400 font-bold block text-[10px]">{rep.sender} ({new Date(rep.createdAt).toLocaleTimeString('en-GB')}):</span>
                          <p className="text-slate-300">{rep.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Input */}
                  {replyingTicketId === t.id ? (
                    <div className="flex gap-2 pt-2">
                      <input
                        type="text"
                        className="flex-1 bg-black border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500"
                        placeholder={isAr ? 'اكتب ردك هنا...' : 'Type your response...'}
                        value={ticketReplyText}
                        onChange={e => setTicketReplyText(e.target.value)}
                      />
                      <button
                        onClick={() => handleReplyTicket(t.id)}
                        disabled={actionId === t.id}
                        className="px-4 py-2 bg-emerald-500 text-black font-bold text-xs rounded-xl hover:bg-emerald-400 cursor-pointer"
                      >
                        {isAr ? 'إرسال الرد' : 'Send'}
                      </button>
                      <button onClick={() => setReplyingTicketId(null)} className="px-3 py-2 bg-slate-900 text-slate-400 text-xs rounded-xl hover:text-white cursor-pointer">
                        {isAr ? 'إلغاء' : 'Cancel'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setReplyingTicketId(t.id); setTicketReplyText(''); }}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 cursor-pointer flex items-center gap-1"
                    >
                      <Send className="w-3 h-3 text-[#d4af37]" />
                      {isAr ? 'إضافة رد' : 'Reply'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SupportTicketsTab;
