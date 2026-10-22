import React, { useState } from "react";
import toast from "react-hot-toast";
import { Ticket, Plus, Send } from "lucide-react";
import { DatePickerInput } from "../../../components/common/DatePickerInput";
import { PermissionGate } from "../../auth/components/PermissionGate";
import { PERM } from "../../../shared/permissions/PERMISSION_NAMES";
import {
  featuresManagementService,
  type FeatureCouponRow,
} from "../../../services/featuresManagementService";
import {
  COUPON_ACTIONS,
  COUPON_ACTION_LABELS,
  errorMessage,
  formatDateTime,
  formatMoney,
  requiredIso,
  statusTone,
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
import { FormModal } from "./FormModal";

const emptyForm = {
  code: "",
  discountType: "percent" as "fixed" | "percent",
  amount: 0,
  currencyCode: "SAR",
  percent: 10,
  minimumProductsSubtotal: 0,
  maxDiscount: 0,
  totalLimit: 0,
  perCustomerLimit: 1,
  startsAt: "",
  endsAt: "",
};

interface CouponsTabProps {
  isAr: boolean;
  coupons: FeatureCouponRow[];
  loading: boolean;
  onCouponCreated: (coupon: FeatureCouponRow) => void;
  onCouponUpdated: (coupon: FeatureCouponRow) => void;
}

export const CouponsTab: React.FC<CouponsTabProps> = props => {
  const { isAr, coupons, loading, onCouponCreated, onCouponUpdated } = props;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      // الخصم النهائي لا تُرسله الواجهة كتحقّق — تُرسل مكوّنات القاعدة فقط والخادم يحتسب ويستهلك (P9).
      // The UI sends only rule components, never a trusted discount result — the server computes & redeems (P9).
      const created = await featuresManagementService.createCoupon({
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        ...(form.discountType === "fixed"
          ? {
              amount: form.amount,
              currencyCode: form.currencyCode.trim().toUpperCase() || "SAR",
            }
          : { percent: form.percent }),
        minimumProductsSubtotal: Math.max(0, form.minimumProductsSubtotal || 0),
        ...(form.maxDiscount > 0 ? { maxDiscount: form.maxDiscount } : {}),
        startsAt,
        endsAt,
        ...(form.totalLimit > 0
          ? { totalLimit: Math.trunc(form.totalLimit) }
          : {}),
        perCustomerLimit: Math.max(1, Math.trunc(form.perCustomerLimit) || 1),
      });
      onCouponCreated(created);
      toast.success(isAr ? "تم إنشاء قاعدة الكوبون" : "Coupon rule created");
      setShowForm(false);
      setForm(emptyForm);
    } catch (error) {
      toast.error(
        errorMessage(
          error,
          isAr ? "تعذر إنشاء الكوبون" : "Failed to create coupon"
        )
      );
    }
  }

  async function transition(coupon: FeatureCouponRow, action: string) {
    setBusyId(coupon.couponId);
    try {
      const updated = await featuresManagementService.transitionCoupon(
        coupon.couponId,
        action
      );
      onCouponUpdated(updated);
      toast.success(isAr ? "تم تحديث حالة الكوبون" : "Coupon status updated");
    } catch (error) {
      toast.error(
        errorMessage(error, isAr ? "عملية غير مسموحة" : "Transition rejected")
      );
    } finally {
      setBusyId(null);
    }
  }

  async function issue(coupon: FeatureCouponRow) {
    const customerId = (
      window.prompt(
        isAr
          ? "معرّف العميل (اختياري — اتركه فارغًا لإصدار عام):"
          : "Customer id (optional — leave blank for general):"
      ) ?? ""
    ).trim();
    setBusyId(coupon.couponId);
    try {
      await featuresManagementService.issueCoupon(coupon.couponId, {
        ...(customerId ? { customerId } : {}),
        idempotencyKey: makeIdempotencyKey("issue"),
      });
      toast.success(isAr ? "تم إصدار الكوبون" : "Coupon issued");
    } catch (error) {
      toast.error(errorMessage(error, isAr ? "تعذر الإصدار" : "Issue failed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex justify-between items-center bg-[#0a0a0c] border border-white/[0.04] p-4 rounded-2xl">
        <h3 className="text-sm font-black text-white flex items-center gap-2">
          <Ticket className="w-4 h-4 text-fuchsia-400" />
          {isAr ? "إدارة كوبونات العملاء" : "Customer Coupons"}
        </h3>
        <PermissionGate permission={PERM.FEATURES_COUPONS_MANAGE}>
          <button
            onClick={() => setShowForm(v => !v)}
            className={primaryButtonClass}
          >
            <Plus className="w-4 h-4" />
            {isAr ? "قاعدة كوبون" : "New Coupon Rule"}
          </button>
        </PermissionGate>
      </div>

      {/* نموذج الإنشاء في نافذة منبثقة مستقلة بدل التضمين داخل الصفحة. */}
      {/* Create form renders in a standalone popup instead of inline in the page. */}
      <FormModal
        open={showForm}
        title={isAr ? "إنشاء قاعدة كوبون جديدة" : "Create Coupon Rule"}
        onClose={() => setShowForm(false)}
      >
        <form
          onSubmit={submitCreate}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <LabeledField label={isAr ? "الرمز" : "Code"}>
            <input
              required
              className={inputClass}
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value })}
            />
          </LabeledField>
          <LabeledField label={isAr ? "نوع الخصم" : "Discount type"}>
            <select
              className={inputClass}
              value={form.discountType}
              onChange={e =>
                setForm({
                  ...form,
                  discountType: e.target.value as "fixed" | "percent",
                })
              }
            >
              <option value="percent">{isAr ? "نسبة" : "Percent"}</option>
              <option value="fixed">{isAr ? "مبلغ ثابت" : "Fixed"}</option>
            </select>
          </LabeledField>
          <LabeledField
            label={
              form.discountType === "percent"
                ? isAr
                  ? "النسبة %"
                  : "Percent %"
                : isAr
                  ? "المبلغ"
                  : "Amount"
            }
          >
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={
                form.discountType === "percent" ? form.percent : form.amount
              }
              onChange={e =>
                setForm(
                  form.discountType === "percent"
                    ? { ...form, percent: Number(e.target.value) }
                    : { ...form, amount: Number(e.target.value) }
                )
              }
            />
          </LabeledField>
          <LabeledField label={isAr ? "الحد الأدنى للسلع" : "Minimum subtotal"}>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={form.minimumProductsSubtotal}
              onChange={e =>
                setForm({
                  ...form,
                  minimumProductsSubtotal: Number(e.target.value),
                })
              }
            />
          </LabeledField>
          <LabeledField label={isAr ? "سقف الخصم (اختياري)" : "Max discount"}>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={form.maxDiscount}
              onChange={e =>
                setForm({ ...form, maxDiscount: Number(e.target.value) })
              }
            />
          </LabeledField>
          <LabeledField label={isAr ? "رمز العملة (ثابت)" : "Currency (fixed)"}>
            <input
              maxLength={3}
              disabled={form.discountType !== "fixed"}
              className={inputClass}
              value={form.currencyCode}
              onChange={e => setForm({ ...form, currencyCode: e.target.value })}
            />
          </LabeledField>
          <LabeledField
            label={isAr ? "الحد الإجمالي (0=∞)" : "Total limit (0=∞)"}
          >
            <input
              type="number"
              min={0}
              className={inputClass}
              value={form.totalLimit}
              onChange={e =>
                setForm({ ...form, totalLimit: Number(e.target.value) })
              }
            />
          </LabeledField>
          <LabeledField label={isAr ? "الحد لكل عميل" : "Per-customer limit"}>
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.perCustomerLimit}
              onChange={e =>
                setForm({ ...form, perCustomerLimit: Number(e.target.value) })
              }
            />
          </LabeledField>
          <div></div>
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
          <div className="md:col-span-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className={ghostButtonClass}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button type="submit" className={primaryButtonClass}>
              {isAr ? "حفظ القاعدة" : "Save Rule"}
            </button>
          </div>
        </form>
      </FormModal>

      {loading ? (
        <LoadingState text={isAr ? "جارٍ التحميل..." : "Loading..."} />
      ) : coupons.length === 0 ? (
        <EmptyState text={isAr ? "لا توجد كوبونات بعد" : "No coupons yet"} />
      ) : (
        <div className="space-y-3">
          {coupons.map(coupon => (
            <div
              key={coupon.couponId}
              className="bg-[#0a0a0c] border border-white/[0.04] rounded-2xl p-4 flex justify-between items-center gap-4"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-white text-sm font-mono">
                    {coupon.code}
                  </span>
                  <StatusBadge
                    label={coupon.status}
                    tone={statusTone(coupon.status)}
                  />
                  <span className="text-[10px] text-slate-500">
                    {coupon.discountType === "percent"
                      ? `${coupon.percent}%`
                      : formatMoney(coupon.amount, coupon.currencyCode)}
                    {coupon.maxDiscount > 0
                      ? ` · ${isAr ? "السقف" : "cap"} ${formatMoney(coupon.maxDiscount)}`
                      : ""}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  {isAr ? "الاستخدام" : "usage"}: {coupon.usageCount}/
                  {coupon.totalLimit ?? "∞"} · {isAr ? "لكل عميل" : "per-cust"}{" "}
                  {coupon.perCustomerLimit} · {formatDateTime(coupon.endsAt)}
                </p>
              </div>
              <PermissionGate permission={PERM.FEATURES_COUPONS_MANAGE}>
                <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                  {(COUPON_ACTIONS[coupon.status] ?? []).map(action => (
                    <button
                      key={action}
                      disabled={busyId === coupon.couponId}
                      onClick={() => transition(coupon, action)}
                      className={ghostButtonClass}
                    >
                      {isAr
                        ? COUPON_ACTION_LABELS[action].ar
                        : COUPON_ACTION_LABELS[action].en}
                    </button>
                  ))}
                  {coupon.status === "active" && (
                    <button
                      disabled={busyId === coupon.couponId}
                      onClick={() => issue(coupon)}
                      className={ghostButtonClass}
                    >
                      <Send className="w-3.5 h-3.5 inline mr-1" />
                      {isAr ? "إصدار" : "Issue"}
                    </button>
                  )}
                </div>
              </PermissionGate>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CouponsTab;
