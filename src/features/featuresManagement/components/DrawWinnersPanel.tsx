/**
 * DrawWinnersPanel.tsx — لوحة السحب وتعيين الفائزين والتسليم (§11.1 / P7–P8).
 * Admin draw-run panel: freeze → assign winners → approve (separation of duties) → fulfill awards.
 *
 * المبدأ الحاكم: الواجهة تعرض الخيارات وتجمع المدخلات فقط؛ آلالة حالة السحب والجوائز
 * كاملة داخل alx_api (لا تعيين تلقائي للفائزين ولا اعتماد دون مراجع مختلف).
 * Governing principle: the UI only renders choices and collects inputs; the draw/award state
 * machine lives entirely in alx_api (no automatic winner selection, no self-approval).
 */
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Swords, UserPlus, BadgeCheck } from "lucide-react";
import { PermissionGate } from "../../auth/components/PermissionGate";
import { PERM } from "../../../shared/permissions/PERMISSION_NAMES";
import {
  featuresManagementService,
  type FeatureContestDetail,
  type FeatureContestEntryRow,
  type FeatureDrawRunRow,
  type FeatureWinnerAwardRow,
} from "../../../services/featuresManagementService";
import {
  AWARD_ACTIONS,
  AWARD_ACTION_LABELS,
  type AwardAction,
  errorMessage,
  formatDateTime,
  makeIdempotencyKey,
  statusTone,
} from "../lib/featuresUi";
import {
  LoadingState,
  StatusBadge,
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
} from "./ui";

interface DrawWinnersPanelProps {
  isAr: boolean;
  contestId: string;
  /** عملية السحب الناتجة عن التجميد؛=null يعني لم تُجمّد قائمة المؤهلين بعد. */
  /** Draw run produced by the freeze step; null means eligibility is not frozen yet. */
  drawRun: FeatureDrawRunRow | null;
  onDrawRunUpdated: (run: FeatureDrawRunRow) => void;
}

export const DrawWinnersPanel: React.FC<DrawWinnersPanelProps> = props => {
  const { isAr, contestId, drawRun, onDrawRunUpdated } = props;
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<FeatureContestDetail | null>(null);
  const [eligible, setEligible] = useState<FeatureContestEntryRow[]>([]);
  const [awards, setAwards] = useState<FeatureWinnerAwardRow[]>([]);
  // اختيار فائز واحد لكل صف تخصيص جائزة (contestPrizeId → entryId).
  // One selected entry per prize-allocation row (contestPrizeId → entryId).
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // تحميل تفاصيل المسابقة + المشاركات المؤهلة فقط للعرض (التحقق خادمي).
    // Load contest detail + eligible entries for display only; validation stays server-side.
    Promise.all([
      featuresManagementService.getContestDetail(contestId),
      featuresManagementService.listContestEntries(contestId, {
        status: "eligible",
      }),
    ])
      .then(([contestDetail, entries]) => {
        if (!active) return;
        setDetail(contestDetail);
        setEligible(entries);
      })
      .catch(error =>
        toast.error(
          errorMessage(
            error,
            isAr ? "تعذر تحميل تفاصيل السحب" : "Failed to load draw detail"
          )
        )
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contestId, isAr]);

  async function assignWinners() {
    if (!drawRun) return;
    const winners = Object.entries(selections)
      .filter(([, entryId]) => Boolean(entryId))
      .map(([contestPrizeId, entryId]) => ({ contestPrizeId, entryId }));
    if (winners.length === 0) {
      toast.error(
        isAr ? "اختر فائزًا واحدًا على الأقل" : "Select at least one winner"
      );
      return;
    }
    setBusy(true);
    try {
      const result = await featuresManagementService.assignWinners(
        drawRun.drawRunId,
        { idempotencyKey: makeIdempotencyKey("draw"), winners }
      );
      setAwards(prev => [...prev, ...result.awards]);
      if (result.drawRun) onDrawRunUpdated(result.drawRun);
      setSelections({});
      toast.success(
        isAr
          ? `تم تعيين ${result.awards.length} فائزًا`
          : `Assigned ${result.awards.length} winner(s)`
      );
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isAr ? "تعذر تعيين الفائزين" : "Failed to assign winners"
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!drawRun) return;
    setBusy(true);
    try {
      // فصل المهام: الخادم يرفض اعتماد المنفّذ نفسه — الواجهة تعرض الرفض فقط.
      // Separation of duties: the server rejects self-approval; the UI only surfaces the refusal.
      const run = await featuresManagementService.approveDrawRun(
        drawRun.drawRunId
      );
      onDrawRunUpdated(run);
      toast.success(isAr ? "تم اعتماد نتيجة السحب" : "Draw result approved");
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isAr ? "تعذر اعتماد النتيجة" : "Failed to approve draw"
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function fulfill(award: FeatureWinnerAwardRow, action: AwardAction) {
    const reason =
      action === "expire" || action === "reject"
        ? (window.prompt(isAr ? "سبب الإجراء:" : "Reason:") ?? "").trim()
        : "";
    if ((action === "expire" || action === "reject") && !reason) {
      toast.error(isAr ? "السبب مطلوب" : "Reason is required");
      return;
    }
    const deliveryReference =
      action === "ship"
        ? (
            window.prompt(
              isAr ? "مرجع الشحن (اختياري):" : "Delivery reference (optional):"
            ) ?? ""
          ).trim()
        : "";
    setBusy(true);
    try {
      const updated = await featuresManagementService.fulfillAward(
        award.awardId,
        {
          action,
          ...(reason ? { reason } : {}),
          ...(deliveryReference ? { deliveryReference } : {}),
        }
      );
      setAwards(prev =>
        prev.map(a =>
          a.awardId === award.awardId
            ? {
                ...a,
                status: updated.status || action,
                claimDeadline: updated.claimDeadline || a.claimDeadline,
              }
            : a
        )
      );
      toast.success(isAr ? "تم تحديث حالة الجائزة" : "Award status updated");
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isAr ? "تعذر تحديث الجائزة" : "Failed to update award"
        )
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return <LoadingState text={isAr ? "جارٍ التحميل..." : "Loading..."} />;

  const runStatus = drawRun?.status ?? "none";

  return (
    <div className="border-t border-white/[0.05] pt-3 space-y-3">
      {/* حالة عملية السحب — draw-run status strip */}
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400">
        <Swords className="w-4 h-4 text-amber-400" />
        <span className="font-bold text-white">
          {isAr ? "لوحة السحب والفائزين" : "Draw & winners panel"}
        </span>
        {drawRun ? (
          <>
            <StatusBadge label={runStatus} tone={statusTone(runStatus)} />
            <span className="font-mono text-slate-500">
              {drawRun.drawRunId.slice(0, 8)}…
            </span>
            <span>
              {isAr
                ? `المؤهلون: ${drawRun.eligibleCount}`
                : `eligible: ${drawRun.eligibleCount}`}
            </span>
            {drawRun.snapshotHash && (
              <span className="font-mono" title={drawRun.snapshotHash}>
                #{drawRun.snapshotHash.slice(0, 10)}
              </span>
            )}
          </>
        ) : (
          <span>
            {isAr
              ? "جمّد قائمة المؤهلين أولًا لبدء السحب"
              : "Freeze the eligibility list first to start a draw"}
          </span>
        )}
      </div>

      {/* تعيين الفائزين يدويًا — manual winner assignment (no random draw) */}
      {drawRun && runStatus === "ready" && detail && (
        <PermissionGate permission={PERM.FEATURES_DRAW_EXECUTE}>
          <div className="space-y-2 bg-black/30 rounded-xl p-3">
            <p className="text-[11px] font-bold text-slate-300">
              {isAr
                ? "تعيين الفائزين يدويًا (فائز لكل مخصص جائزة)"
                : "Manually assign winners (one per prize allocation)"}
            </p>
            {detail.prizes.map(prize => (
              <div
                key={prize.contestPrizeId}
                className="flex items-center gap-2 flex-wrap"
              >
                <span className="text-xs text-slate-200 min-w-36">
                  {prize.name}
                  <span className="text-[10px] text-slate-500 ms-1">
                    ({prize.quantityAwarded}/{prize.quantityAllocated})
                  </span>
                </span>
                <select
                  className={`${inputClass} max-w-64`}
                  value={selections[prize.contestPrizeId] ?? ""}
                  onChange={e =>
                    setSelections(prev => ({
                      ...prev,
                      [prize.contestPrizeId]: e.target.value,
                    }))
                  }
                >
                  <option value="">
                    {isAr ? "— بدون فائز —" : "— no winner —"}
                  </option>
                  {eligible.map(entry => (
                    <option key={entry.entryId} value={entry.entryId}>
                      {entry.customerId || entry.entryId}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            <div className="flex justify-end">
              <button
                disabled={busy}
                onClick={assignWinners}
                className={primaryButtonClass}
              >
                <UserPlus className="w-4 h-4 inline me-1" />
                {isAr ? "تعيين الفائزين" : "Assign winners"}
              </button>
            </div>
          </div>
        </PermissionGate>
      )}

      {/* اعتماد النتيجة — مراجع مختلف عن المنفّذ (§12 فصل المهام) */}
      {/* Approve the result — a reviewer distinct from the executor (§12 separation of duties) */}
      {drawRun && runStatus === "executed" && (
        <PermissionGate permission={PERM.FEATURES_WINNERS_APPROVE}>
          <div className="flex justify-end">
            <button
              disabled={busy}
              onClick={approve}
              className={primaryButtonClass}
            >
              <BadgeCheck className="w-4 h-4 inline me-1" />
              {isAr ? "اعتماد نتيجة السحب" : "Approve draw result"}
            </button>
          </div>
        </PermissionGate>
      )}

      {/* الجوائز المعيّنة وتسليمها — assigned awards & fulfillment tracking */}
      {awards.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-slate-300">
            {isAr ? "الجوائز المعيّنة" : "Assigned awards"}
          </p>
          {awards.map(award => (
            <div
              key={award.awardId}
              className="flex items-center gap-2 flex-wrap bg-black/30 rounded-xl px-3 py-2"
            >
              <span className="text-xs font-mono text-slate-200">
                {award.awardId.slice(0, 8)}…
              </span>
              <StatusBadge
                label={award.status}
                tone={statusTone(award.status)}
              />
              <span className="text-[10px] text-slate-500">
                {isAr ? "مهلة المطالبة:" : "claim deadline:"}{" "}
                {formatDateTime(award.claimDeadline)}
              </span>
              <PermissionGate permission={PERM.FEATURES_PRIZES_FULFILL}>
                <div className="flex gap-1 ms-auto flex-wrap">
                  {AWARD_ACTIONS.map(action => (
                    <button
                      key={action}
                      disabled={busy}
                      onClick={() => fulfill(award, action)}
                      className={ghostButtonClass}
                    >
                      {isAr
                        ? AWARD_ACTION_LABELS[action].ar
                        : AWARD_ACTION_LABELS[action].en}
                    </button>
                  ))}
                </div>
              </PermissionGate>
            </div>
          ))}
        </div>
      )}

      {runStatus === "approved" && awards.length === 0 && (
        <p className="text-[11px] text-slate-500">
          {isAr
            ? "النتيجة معتمدة؛ أعد فتح اللوحة بعد تعيين الفائزين لمتابعة التسليم."
            : "Result approved; reopen this panel after assigning winners to track fulfilment."}
        </p>
      )}
    </div>
  );
};

export default DrawWinnersPanel;
