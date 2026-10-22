import React, { useState } from "react";
import toast from "react-hot-toast";
import { Trophy, Plus, Snowflake, ListChecks, Swords } from "lucide-react";
import { DatePickerInput } from "../../../components/common/DatePickerInput";
import { PermissionGate } from "../../auth/components/PermissionGate";
import { PERM } from "../../../shared/permissions/PERMISSION_NAMES";
import {
  featuresManagementService,
  type FeatureContestRow,
  type FeatureContestEntryRow,
  type FeatureDrawRunRow,
} from "../../../services/featuresManagementService";
import { DrawWinnersPanel } from "./DrawWinnersPanel";
import { FormModal } from "./FormModal";
import {
  CONTEST_ACTIONS,
  CONTEST_ACTION_LABELS,
  statusTone,
  errorMessage,
  formatDateTime,
  requiredIso,
  makeIdempotencyKey,
} from "../lib/featuresUi";
import {
  EmptyState,
  LabeledField,
  LoadingState,
  StatusBadge,
  ghostButtonClass,
  inputClass,
  primaryButtonClass,
} from "./ui";

const emptyForm = {
  title: "",
  description: "",
  termsText: "",
  termsVersion: "v1",
  startsAt: "",
  endsAt: "",
  claimDays: 7,
};

interface ContestsTabProps {
  isAr: boolean;
  contests: FeatureContestRow[];
  loading: boolean;
  onContestCreated: (contest: FeatureContestRow) => void;
  onContestUpdated: (contest: FeatureContestRow) => void;
}

export const ContestsTab: React.FC<ContestsTabProps> = props => {
  const { isAr, contests, loading, onContestCreated, onContestUpdated } = props;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [entriesOf, setEntriesOf] = useState<string | null>(null);
  const [entries, setEntries] = useState<FeatureContestEntryRow[]>([]);
  // عمليات السحب الناتجة عن التجميد في هذه الجلسة (الخادم يملك الحالة النهائية).
  // Draw runs produced by freezes this session (the server owns the final state).
  const [drawRuns, setDrawRuns] = useState<Record<string, FeatureDrawRunRow>>(
    {}
  );
  const [drawPanelOf, setDrawPanelOf] = useState<string | null>(null);

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    try {
      const startsAt = requiredIso(
        form.startsAt,
        "تاريخ البداية",
        "Start date",
        isAr
      );
      const endsAt = requiredIso(
        form.endsAt,
        "تاريخ النهاية",
        "End date",
        isAr
      );
      if (new Date(endsAt) <= new Date(startsAt)) {
        throw new Error(
          isAr ? "النهاية يجب أن تكون بعد البداية" : "End must be after start"
        );
      }
      const created = await featuresManagementService.createContest({
        title: form.title.trim(),
        ...(form.description.trim()
          ? { description: form.description.trim() }
          : {}),
        termsText: form.termsText.trim(),
        termsVersion: form.termsVersion.trim() || "v1",
        startsAt,
        endsAt,
        claimDays: Math.max(1, Math.trunc(form.claimDays) || 7),
      });
      onContestCreated(created);
      toast.success(isAr ? "تم إنشاء المسابقة" : "Contest created");
      setForm(emptyForm);
      setShowForm(false);
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isAr ? "تعذر إنشاء المسابقة" : "Failed to create contest"
        )
      );
    }
  }

  async function transition(contest: FeatureContestRow, action: string) {
    setBusyId(contest.contestId);
    try {
      // الانتقال حسّاس يتطلب سببًا موثّقًا — يُطلب من المشغّل ويُرسل للخادم للتدقيق.
      // A sensitive transition requires a documented reason — prompted and sent to the server for audit.
      const reason =
        window.prompt(
          isAr ? "سبب الانتقال (اختياري):" : "Transition reason (optional):"
        ) ?? undefined;
      const updated = await featuresManagementService.transitionContest(
        contest.contestId,
        action,
        reason || undefined
      );
      onContestUpdated(updated);
      toast.success(isAr ? "تم تحديث حالة المسابقة" : "Contest status updated");
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isAr ? "عملية غير مسموحة في الحالة الحالية" : "Transition rejected"
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  async function freeze(contest: FeatureContestRow) {
    setBusyId(contest.contestId);
    try {
      // التجميد يُنشئ عملية سحب جاهزة (status=ready) — نحتفظ بمعرفها للوحة السحب.
      // Freezing creates a ready draw-run (status=ready) — keep it for the draw panel.
      const run = await featuresManagementService.freezeEligibility(
        contest.contestId,
        makeIdempotencyKey("snap")
      );
      if (run.drawRunId) {
        setDrawRuns(prev => ({ ...prev, [contest.contestId]: run }));
        setDrawPanelOf(contest.contestId);
      }
      toast.success(
        isAr ? "تم تجميد قائمة المؤهلين" : "Eligibility snapshot frozen"
      );
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isAr
            ? "لا يمكن التجميد قبل إغلاق المسابقة"
            : "Cannot freeze before closing"
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  async function openEntries(contest: FeatureContestRow) {
    if (entriesOf === contest.contestId) {
      setEntriesOf(null);
      return;
    }
    setEntriesOf(contest.contestId);
    try {
      setEntries(
        await featuresManagementService.listContestEntries(contest.contestId)
      );
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isAr ? "تعذر تحميل المشاركات" : "Failed to load entries"
        )
      );
      setEntries([]);
    }
  }

  async function reviewEntry(
    entry: FeatureContestEntryRow,
    status: "eligible" | "ineligible" | "disqualified"
  ) {
    const reason =
      window.prompt(isAr ? "سبب المراجعة:" : "Review reason:") ?? "";
    if (!reason.trim()) {
      toast.error(isAr ? "السبب مطلوب" : "Reason is required");
      return;
    }
    setBusyId(entry.entryId);
    try {
      await featuresManagementService.reviewContestEntry(entry.entryId, {
        status,
        reason: reason.trim(),
      });
      setEntries(prev =>
        prev.map(e =>
          e.entryId === entry.entryId
            ? { ...e, status, reviewReason: reason.trim() }
            : e
        )
      );
      toast.success(isAr ? "تمت مراجعة المشاركة" : "Entry reviewed");
    } catch (error) {
      toast.error(
        errorMessage(error, isAr ? "تعذرت المراجعة" : "Review failed")
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          {isAr ? "إدارة المسابقات" : "Contests Management"}
        </h3>
        <PermissionGate permission={PERM.FEATURES_CONTESTS_MANAGE}>
          <button
            onClick={() => setShowForm(v => !v)}
            className={primaryButtonClass}
          >
            <Plus className="w-4 h-4" />
            {isAr ? "مسابقة جديدة" : "New Contest"}
          </button>
        </PermissionGate>
      </div>

      {/* النموذج في نافذة منبثقة مستقلة وليس مضمنًا داخل الصفحة (طلب المالك 2026-10-22). */}
      {/* The form renders in a standalone popup, not inline in the page (owner request 2026-10-22). */}
      <FormModal
        open={showForm}
        title={isAr ? "إنشاء مسابقة جديدة" : "Create New Contest"}
        onClose={() => setShowForm(false)}
      >
        <form
          onSubmit={submitCreate}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <LabeledField label={isAr ? "العنوان" : "Title"}>
            <input
              required
              className={inputClass}
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
            />
          </LabeledField>
          <LabeledField label={isAr ? "إصدار الشروط" : "Terms version"}>
            <input
              required
              className={inputClass}
              value={form.termsVersion}
              onChange={e => setForm({ ...form, termsVersion: e.target.value })}
            />
          </LabeledField>
          <LabeledField label={isAr ? "تاريخ البداية" : "Starts at"}>
            <DatePickerInput
              type="datetime-local"
              value={form.startsAt}
              onChange={val => setForm({ ...form, startsAt: val })}
            />
          </LabeledField>
          <LabeledField label={isAr ? "تاريخ النهاية" : "Ends at"}>
            <DatePickerInput
              type="datetime-local"
              // النهاية لا تسبق البداية — تقييد بصري فقط والخادم يملك الرفض النهائي.
              // End cannot precede start — visual hint only; the server owns final rejection.
              min={form.startsAt || undefined}
              value={form.endsAt}
              onChange={val => setForm({ ...form, endsAt: val })}
            />
          </LabeledField>
          <LabeledField label={isAr ? "أيام المطالبة بالجائزة" : "Claim days"}>
            <input
              required
              type="number"
              min={1}
              max={365}
              className={inputClass}
              value={form.claimDays}
              onChange={e =>
                setForm({ ...form, claimDays: Number(e.target.value) })
              }
            />
          </LabeledField>
          <LabeledField
            label={isAr ? "الوصف" : "Description"}
            className="md:col-span-2"
          >
            <textarea
              rows={2}
              className={inputClass}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </LabeledField>
          <LabeledField
            label={isAr ? "نص الشروط والأحكام" : "Terms text"}
            className="md:col-span-2"
          >
            <textarea
              required
              rows={3}
              className={inputClass}
              value={form.termsText}
              onChange={e => setForm({ ...form, termsText: e.target.value })}
            />
          </LabeledField>
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className={ghostButtonClass}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button type="submit" className={primaryButtonClass}>
              {isAr ? "حفظ المسابقة" : "Save Contest"}
            </button>
          </div>
        </form>
      </FormModal>

      {loading ? (
        <LoadingState text={isAr ? "جارٍ التحميل..." : "Loading..."} />
      ) : contests.length === 0 ? (
        <EmptyState text={isAr ? "لا توجد مسابقات بعد" : "No contests yet"} />
      ) : (
        <div className="space-y-3">
          {contests.map(contest => (
            <div
              key={contest.contestId}
              className="bg-[#0a0a0c] border border-white/[0.04] rounded-2xl p-4 space-y-3"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white text-sm">
                      {contest.title}
                    </span>
                    <StatusBadge
                      label={contest.status}
                      tone={statusTone(contest.status)}
                    />
                    <span className="text-[10px] text-slate-500">
                      {isAr ? "الشروط" : "terms"}: {contest.termsVersion}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2">
                    {contest.description}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {formatDateTime(contest.startsAt)} →{" "}
                    {formatDateTime(contest.endsAt)} · {contest.claimDays}{" "}
                    {isAr ? "يوم مطالبة" : "claim days"}
                  </p>
                </div>
                <PermissionGate permission={PERM.FEATURES_CONTESTS_MANAGE}>
                  <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                    {(CONTEST_ACTIONS[contest.status] ?? []).map(action => (
                      <button
                        key={action}
                        disabled={busyId === contest.contestId}
                        onClick={() => transition(contest, action)}
                        className={ghostButtonClass}
                      >
                        {isAr
                          ? CONTEST_ACTION_LABELS[action].ar
                          : CONTEST_ACTION_LABELS[action].en}
                      </button>
                    ))}
                    {contest.status === "closed" && (
                      <button
                        disabled={busyId === contest.contestId}
                        onClick={() => freeze(contest)}
                        className={ghostButtonClass}
                      >
                        <Snowflake className="w-3.5 h-3.5 inline mr-1" />
                        {isAr ? "تجميد المؤهلين" : "Freeze eligibility"}
                      </button>
                    )}
                    {(contest.status === "closed" ||
                      contest.status === "archived" ||
                      drawRuns[contest.contestId]) && (
                      <button
                        onClick={() =>
                          setDrawPanelOf(current =>
                            current === contest.contestId
                              ? null
                              : contest.contestId
                          )
                        }
                        className={ghostButtonClass}
                      >
                        <Swords className="w-3.5 h-3.5 inline mr-1" />
                        {isAr ? "السحب والفائزون" : "Draw & winners"}
                      </button>
                    )}
                  </div>
                </PermissionGate>
              </div>

              <PermissionGate permission={PERM.FEATURES_CONTESTS_MANAGE}>
                <button
                  onClick={() => openEntries(contest)}
                  className="text-[11px] text-amber-400 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  {entriesOf === contest.contestId
                    ? isAr
                      ? "إخفاء المشاركات"
                      : "Hide entries"
                    : isAr
                      ? "عرض المشاركات والمراجعة"
                      : "View & review entries"}
                </button>
              </PermissionGate>

              {drawPanelOf === contest.contestId && (
                <PermissionGate permission={PERM.FEATURES_CONTESTS_READ}>
                  <DrawWinnersPanel
                    isAr={isAr}
                    contestId={contest.contestId}
                    drawRun={drawRuns[contest.contestId] ?? null}
                    onDrawRunUpdated={run =>
                      setDrawRuns(prev => ({
                        ...prev,
                        [contest.contestId]: run,
                      }))
                    }
                  />
                </PermissionGate>
              )}

              {entriesOf === contest.contestId && (
                <div className="border-t border-white/[0.05] pt-3 space-y-2">
                  {entries.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      {isAr ? "لا توجد مشاركات" : "No entries"}
                    </p>
                  ) : (
                    entries.map(entry => (
                      <div
                        key={entry.entryId}
                        className="flex justify-between items-center gap-3 bg-black/30 rounded-xl px-3 py-2"
                      >
                        <div className="min-w-0">
                          <span className="text-xs text-slate-200 font-mono truncate">
                            {entry.customerId || entry.entryId}
                          </span>
                          <span className="ms-2">
                            <StatusBadge
                              label={entry.status}
                              tone={statusTone(entry.status)}
                            />
                          </span>
                          {entry.reviewReason && (
                            <p className="text-[10px] text-slate-500 truncate">
                              {entry.reviewReason}
                            </p>
                          )}
                        </div>
                        <PermissionGate
                          permission={PERM.FEATURES_CONTESTS_MANAGE}
                        >
                          <div className="flex gap-1 shrink-0">
                            {(
                              [
                                "eligible",
                                "ineligible",
                                "disqualified",
                              ] as const
                            ).map(status => (
                              <button
                                key={status}
                                disabled={busyId === entry.entryId}
                                onClick={() => reviewEntry(entry, status)}
                                className={ghostButtonClass}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </PermissionGate>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContestsTab;
