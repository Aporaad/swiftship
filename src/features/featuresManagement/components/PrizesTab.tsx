import React, { useState } from "react";
import toast from "react-hot-toast";
import { Gift, Plus, Boxes } from "lucide-react";
import { PermissionGate } from "../../auth/components/PermissionGate";
import { PERM } from "../../../shared/permissions/PERMISSION_NAMES";
import {
  featuresManagementService,
  type FeatureContestRow,
  type FeaturePrizeRow,
} from "../../../services/featuresManagementService";
import { errorMessage, statusTone } from "../lib/featuresUi";
import { FormModal } from "./FormModal";
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
  name: "",
  prizeType: "physical" as "physical" | "digital" | "coupon",
  description: "",
  quantityTotal: 1,
  valueAmount: 0,
  valueCurrencyCode: "SAR",
};

interface PrizesTabProps {
  isAr: boolean;
  prizes: FeaturePrizeRow[];
  contests: FeatureContestRow[];
  loading: boolean;
  onPrizeCreated: (prize: FeaturePrizeRow) => void;
}

export const PrizesTab: React.FC<PrizesTabProps> = props => {
  const { isAr, prizes, contests, loading, onPrizeCreated } = props;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    ...emptyForm,
    prizeType: "physical" as "physical" | "digital" | "coupon",
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  async function submitCreate(event: React.FormEvent) {
    event.preventDefault();
    try {
      const created = await featuresManagementService.createPrize({
        name: form.name.trim(),
        prizeType: form.prizeType,
        ...(form.description.trim()
          ? { description: form.description.trim() }
          : {}),
        quantityTotal: Math.max(0, Math.trunc(form.quantityTotal) || 0),
        ...(form.valueAmount > 0
          ? {
              valueAmount: form.valueAmount,
              valueCurrencyCode:
                form.valueCurrencyCode.trim().toUpperCase() || undefined,
            }
          : {}),
      });
      onPrizeCreated(created);
      toast.success(isAr ? "تم إنشاء الجائزة" : "Prize created");
      setShowForm(false);
      setForm({ ...emptyForm, prizeType: "physical" });
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isAr ? "تعذر إنشاء الجائزة" : "Failed to create prize"
        )
      );
    }
  }

  async function allocate(prize: FeaturePrizeRow) {
    if (contests.length === 0) {
      toast.error(
        isAr ? "لا توجد مسابقة للاختيارها" : "No contest to allocate to"
      );
      return;
    }
    // يُطلب من المشغّل اختيار المسابقة والكمية — الخادم يتحقق من المخزون ويعتمد التخصيص ذرّيًا.
    // The operator picks the contest and quantity; the server validates stock and applies the allocation atomically.
    const titleLine = contests
      .map((c, i) => `${i + 1}. ${c.title} (${c.status})`)
      .join("\n");
    const chosen = window.prompt(
      `${isAr ? "اختر رقم المسابقة:" : "Choose contest number:"}\n${titleLine}`
    );
    const index = Number(chosen) - 1;
    const contest = contests[index];
    if (!contest) {
      toast.error(isAr ? "اختيار غير صالح" : "Invalid selection");
      return;
    }
    const qtyRaw = window.prompt(
      isAr ? "الكمية المخصّصة:" : "Quantity to allocate:"
    );
    const quantityAllocated = Math.trunc(Number(qtyRaw));
    if (!Number.isFinite(quantityAllocated) || quantityAllocated <= 0) {
      toast.error(isAr ? "كمية غير صالحة" : "Invalid quantity");
      return;
    }
    setBusyId(prize.prizeId);
    try {
      await featuresManagementService.allocatePrize(contest.contestId, {
        prizeId: prize.prizeId,
        quantityAllocated,
      });
      toast.success(
        isAr ? "تم تخصيص الجائزة للمسابقة" : "Prize allocated to contest"
      );
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isAr
            ? "المخزون غير كافٍ أو التخصيص مرفوض"
            : "Insufficient stock or allocation rejected"
        )
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <Gift className="w-4 h-4 text-emerald-400" />
          {isAr ? "إدارة الجوائز والمخزون" : "Prizes & Stock"}
        </h3>
        <PermissionGate permission={PERM.FEATURES_PRIZES_MANAGE}>
          <button
            onClick={() => setShowForm(v => !v)}
            className={primaryButtonClass}
          >
            <Plus className="w-4 h-4" />
            {isAr ? "جائزة جديدة" : "New Prize"}
          </button>
        </PermissionGate>
      </div>

      {/* نموذج الإنشاء في نافذة منبثقة مستقلة بدل التضمين داخل الصفحة. */}
      {/* Create form renders in a standalone popup instead of inline in the page. */}
      <FormModal
        open={showForm}
        title={isAr ? "إنشاء جائزة جديدة" : "Create New Prize"}
        onClose={() => setShowForm(false)}
      >
        <form
          onSubmit={submitCreate}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <LabeledField label={isAr ? "اسم الجائزة" : "Prize name"}>
            <input
              required
              className={inputClass}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </LabeledField>
          <LabeledField label={isAr ? "النوع" : "Type"}>
            <select
              className={inputClass}
              value={form.prizeType}
              onChange={e =>
                setForm({
                  ...form,
                  prizeType: e.target.value as typeof form.prizeType,
                })
              }
            >
              <option value="physical">{isAr ? "عينية" : "Physical"}</option>
              <option value="digital">{isAr ? "رقمية" : "Digital"}</option>
              <option value="coupon">{isAr ? "كوبون" : "Coupon"}</option>
            </select>
          </LabeledField>
          <LabeledField label={isAr ? "الكمية الكلية" : "Total quantity"}>
            <input
              required
              type="number"
              min={0}
              className={inputClass}
              value={form.quantityTotal}
              onChange={e =>
                setForm({ ...form, quantityTotal: Number(e.target.value) })
              }
            />
          </LabeledField>
          <LabeledField label={isAr ? "القيمة (اختياري)" : "Value (optional)"}>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={form.valueAmount}
              onChange={e =>
                setForm({ ...form, valueAmount: Number(e.target.value) })
              }
            />
          </LabeledField>
          <LabeledField label={isAr ? "رمز العملة" : "Currency code"}>
            <input
              maxLength={3}
              className={inputClass}
              value={form.valueCurrencyCode}
              onChange={e =>
                setForm({ ...form, valueCurrencyCode: e.target.value })
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
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className={ghostButtonClass}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button type="submit" className={primaryButtonClass}>
              {isAr ? "حفظ الجائزة" : "Save Prize"}
            </button>
          </div>
        </form>
      </FormModal>

      {loading ? (
        <LoadingState text={isAr ? "جارٍ التحميل..." : "Loading..."} />
      ) : prizes.length === 0 ? (
        <EmptyState text={isAr ? "لا توجد جوائز بعد" : "No prizes yet"} />
      ) : (
        <div className="space-y-3">
          {prizes.map(prize => (
            <div
              key={prize.prizeId}
              className="bg-[#0a0a0c] border border-white/[0.04] rounded-2xl p-4 flex justify-between items-center gap-4"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-sm">
                    {prize.name}
                  </span>
                  <StatusBadge
                    label={prize.prizeType}
                    tone="bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                  />
                  <StatusBadge
                    label={prize.status}
                    tone={statusTone(prize.status)}
                  />
                </div>
                <p className="text-xs text-slate-400">{prize.description}</p>
                <p className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Boxes className="w-3 h-3" />
                  {isAr ? "المخزون" : "stock"}: {prize.quantityReserved}/
                  {prize.quantityTotal}
                  {prize.valueAmount > 0
                    ? ` · ${prize.valueAmount} ${prize.valueCurrencyCode}`
                    : ""}
                </p>
              </div>
              <PermissionGate permission={PERM.FEATURES_PRIZES_MANAGE}>
                <button
                  disabled={busyId === prize.prizeId}
                  onClick={() => allocate(prize)}
                  className={ghostButtonClass}
                >
                  {isAr ? "تخصيص لمسابقة" : "Allocate to contest"}
                </button>
              </PermissionGate>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrizesTab;
