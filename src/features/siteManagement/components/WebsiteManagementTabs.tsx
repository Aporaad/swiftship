import React from 'react';


type SiteTab = 'analytics' | 'portal_users' | 'pending' | 'orders' | 'tickets' | 'announcements' | 'jobs' | 'security' | 'api';
type TabTicket = { status?: string };
export interface WebsiteManagementTabsProps {
  isAr: boolean;
  activeTab: SiteTab;
  setActiveTab: (tab: SiteTab) => void;
  portalUsers: unknown[];
  pendingUsers: unknown[];
  portalOrders: unknown[];
  tickets: TabTicket[];
  announcements: unknown[];
  pendingJobs: unknown[];
}

export const WebsiteManagementTabs: React.FC<WebsiteManagementTabsProps> = (props) => {
  const { isAr, activeTab, setActiveTab, portalUsers, pendingUsers, portalOrders, tickets, announcements, pendingJobs } = props;

  return (
    <>
      <div className="flex items-center gap-2 border-b border-[#d4af37]/15 pb-2 overflow-x-auto custom-scrollbar">
        {[
          { id: 'analytics', label: isAr ? '📊 شاشة المراقبة والإحصائيات' : 'Monitoring & Analytics', badge: null },
          { id: 'portal_users', label: isAr ? '👥 مستخدمين الموقع (portal_users)' : 'Portal Users', badge: portalUsers.length },
          { id: 'pending', label: isAr ? '⏳ اعتماد الحسابات المعلقة' : 'Pending Approvals', badge: pendingUsers.length },
          { id: 'orders', label: isAr ? '📦 طلبات البوابة' : 'Portal Orders', badge: portalOrders.length },
          { id: 'tickets', label: isAr ? '🎧 الشكاوى والاقتراحات' : 'Support Tickets', badge: tickets.filter(t => t.status === 'open').length },
          { id: 'announcements', label: isAr ? '📢 الإعلانات والعروض' : 'Announcements', badge: announcements.length },
          { id: 'jobs', label: isAr ? '💼 طلبات التوظيف (jobs_req)' : 'Job Applications', badge: pendingJobs.length },
          { id: 'security', label: isAr ? '🛡️ أمان وإدارة الموقع' : 'Website Security', badge: null },
          { id: 'api', label: isAr ? '🔗 ربط API والـ Webhooks' : 'API & Webhooks', badge: null },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as SiteTab)}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${activeTab === tab.id
                ? 'bg-gradient-to-r from-[#d4af37]/20 to-amber-900/20 text-[#d4af37] border border-[#d4af37]/40 shadow-lg shadow-black/30'
                : 'bg-black/30 hover:bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.03]'
              }`}
          >
            <span>{tab.label}</span>
            {tab.badge !== null && tab.badge > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${activeTab === tab.id ? 'bg-[#d4af37] text-black' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </>
  );
};

export default WebsiteManagementTabs;
