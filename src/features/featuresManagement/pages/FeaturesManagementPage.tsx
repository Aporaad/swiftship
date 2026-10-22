import React, { useState } from "react";
import { Trophy, Gift, Ticket } from "lucide-react";
import { useSettings } from "../../../context/SettingsContext";
import { useFeaturesManagementData } from "../hooks/useFeaturesManagementData";
import { ContestsTab } from "../components/ContestsTab";
import { PrizesTab } from "../components/PrizesTab";
import { CouponsTab } from "../components/CouponsTab";
import { ReportsSummaryBar } from "../components/ReportsSummaryBar";

type FeaturesTab = "contests" | "prizes" | "coupons";

/**
 * FeaturesManagementPage — قسم إدارة الميزات في النظام الأساسي (P10).
 * Core-system admin section for competitions, prizes and customer coupons (P10).
 *
 * الفصل الحاسم: الواجهة تجمع المدخلات وتعرض النتائج عبر `featuresManagementService` فقط؛
 * لا تقرر الأهلية ولا تحسب الخصم ولا تلمس قاعدة البيانات. كل إجراء محكوم بصلاحية في الواجهة
 * ويُتحقّق منه مجددًا في alx_api (المرجع الوحيد للحقيقة).
 * Strict separation: the UI collects input and renders results through the typed gateway only;
 * it never decides eligibility, never computes a discount, and never touches the DB. Every action is
 * permission-gated in the UI and revalidated in alx_api (the single source of truth).
 */
export default function FeaturesManagementPage() {
  const { settings } = useSettings();
  const isAr = settings.language === "ar";
  const [activeTab, setActiveTab] = useState<FeaturesTab>("contests");
  // مفتاح تحديث شريط الملخص — يُرفع عند أي انتقال حالة في التبويبات.
  // Reports summary refresh key — bumped on any tab status transition.
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
  const bumpSummary = () => setSummaryRefreshKey(v => v + 1);
  const {
    loading,
    contests,
    prizes,
    coupons,
    setContests,
    setPrizes,
    setCoupons,
  } = useFeaturesManagementData(isAr);

  const addContest = (contest: (typeof contests)[number]) =>
    setContests(prev => [contest, ...prev]);
  const patchContest = (contest: (typeof contests)[number]) => {
    setContests(prev =>
      prev.map(c => (c.contestId === contest.contestId ? contest : c))
    );
    bumpSummary();
  };
  const addPrize = (prize: (typeof prizes)[number]) =>
    setPrizes(prev => [prize, ...prev]);
  const addCoupon = (coupon: (typeof coupons)[number]) =>
    setCoupons(prev => [coupon, ...prev]);
  const patchCoupon = (coupon: (typeof coupons)[number]) => {
    setCoupons(prev =>
      prev.map(c => (c.couponId === coupon.couponId ? coupon : c))
    );
    bumpSummary();
  };

  const tabs: {
    id: FeaturesTab;
    ar: string;
    en: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "contests",
      ar: "المسابقات",
      en: "Contests",
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: "prizes",
      ar: "الجوائز",
      en: "Prizes",
      icon: <Gift className="w-4 h-4" />,
    },
    {
      id: "coupons",
      ar: "الكوبونات",
      en: "Coupons",
      icon: <Ticket className="w-4 h-4" />,
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">
            {isAr
              ? "إدارة المسابقات والجوائز والكوبونات"
              : "Features Management"}
          </h1>
          <p className="text-xs text-slate-400">
            {isAr
              ? "تحكّم كامل عبر الخادم — لا حساب ولا أهلية داخل الواجهة"
              : "Server-authoritative — no eligibility or discount computed in the UI"}
          </p>
        </div>
      </div>

      <ReportsSummaryBar isAr={isAr} refreshKey={summaryRefreshKey} />

      <div className="flex items-center gap-2 border-b border-[#d4af37]/15 pb-2 overflow-x-auto custom-scrollbar">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? "bg-gradient-to-r from-[#d4af37]/20 to-amber-900/20 text-[#d4af37] border border-[#d4af37]/40 shadow-lg shadow-black/30"
                : "bg-black/30 hover:bg-white/[0.03] text-slate-400 hover:text-white border border-white/[0.03]"
            }`}
          >
            {tab.icon}
            <span>{isAr ? tab.ar : tab.en}</span>
          </button>
        ))}
      </div>

      {activeTab === "contests" && (
        <ContestsTab
          isAr={isAr}
          contests={contests}
          loading={loading}
          onContestCreated={addContest}
          onContestUpdated={patchContest}
        />
      )}
      {activeTab === "prizes" && (
        <PrizesTab
          isAr={isAr}
          prizes={prizes}
          contests={contests}
          loading={loading}
          onPrizeCreated={addPrize}
        />
      )}
      {activeTab === "coupons" && (
        <CouponsTab
          isAr={isAr}
          coupons={coupons}
          loading={loading}
          onCouponCreated={addCoupon}
          onCouponUpdated={patchCoupon}
        />
      )}
    </div>
  );
}
