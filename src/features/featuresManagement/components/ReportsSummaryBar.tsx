/**
 * ReportsSummaryBar.tsx — شريط ملخص تقارير الميزات (§11.1 رأس الصفحة).
 * Features-management reports summary header: server-computed counters only (no UI logic).
 */
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BarChart3 } from "lucide-react";
import { PermissionGate } from "../../auth/components/PermissionGate";
import { PERM } from "../../../shared/permissions/PERMISSION_NAMES";
import {
  featuresManagementService,
  type FeaturesReportsSummary,
} from "../../../services/featuresManagementService";
import { errorMessage } from "../lib/featuresUi";

interface ReportsSummaryBarProps {
  isAr: boolean;
  /** إعادة الجلب عند تغير المفتاح (انتقالات المسابقات/الكوبونات). */
  /** Refetch trigger, bumped after contest/coupon transitions. */
  refreshKey?: number;
}

export const ReportsSummaryBar: React.FC<ReportsSummaryBarProps> = ({
  isAr,
  refreshKey = 0,
}) => {
  const [summary, setSummary] = useState<FeaturesReportsSummary | null>(null);

  useEffect(() => {
    let active = true;
    // العدّادات كلها تُحسب داخل alx_api — الواجهة تعرض فقط.
    // Every counter is computed inside alx_api — the UI just renders them.
    featuresManagementService
      .reportsSummary()
      .then(data => {
        if (active) setSummary(data);
      })
      .catch(error =>
        toast.error(
          errorMessage(
            error,
            isAr ? "تعذر تحميل الملخص" : "Failed to load summary"
          )
        )
      );
    return () => {
      active = false;
    };
  }, [refreshKey, isAr]);

  if (!summary) return null;

  const cells: { ar: string; en: string; value: number }[] = [
    {
      ar: "مسابقات نشطة",
      en: "active contests",
      value: summary.contestsActive,
    },
    { ar: "مسابقات (كل)", en: "contests (all)", value: summary.contestsTotal },
    {
      ar: "مشاركات مؤهلة",
      en: "eligible entries",
      value: summary.entriesEligible,
    },
    { ar: "فائزون", en: "winners", value: summary.entriesWinners },
    { ar: "جوائز مفتوحة", en: "open awards", value: summary.awardsOpen },
    {
      ar: "جوائز مُسلّمة",
      en: "delivered awards",
      value: summary.awardsDelivered,
    },
    { ar: "كوبونات نشطة", en: "active coupons", value: summary.couponsActive },
    {
      ar: "إصدارات سارية",
      en: "issued coupons",
      value: summary.issuancesIssued,
    },
    {
      ar: "استردادات",
      en: "redemptions",
      value: summary.redemptionsRedeemed,
    },
  ];

  return (
    <PermissionGate permission={PERM.FEATURES_REPORTS_READ}>
      <div className="flex items-center gap-3 flex-wrap bg-[#0a0a0c] border border-white/[0.04] rounded-2xl px-4 py-3">
        <BarChart3 className="w-4 h-4 text-emerald-400 shrink-0" />
        {cells.map(cell => (
          <div key={cell.en} className="text-[11px] text-slate-400">
            <span className="font-black text-white text-sm me-1">
              {cell.value}
            </span>
            {isAr ? cell.ar : cell.en}
          </div>
        ))}
      </div>
    </PermissionGate>
  );
};

export default ReportsSummaryBar;
