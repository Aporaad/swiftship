-- يشتق conversion_rate من amount وamount_original في كل ساق.
-- لا يستعمل معدلًا افتراضيًا ولا ينشئ سعر صرف جديدًا، ولا يغير RLS.

BEGIN;

CREATE OR REPLACE FUNCTION public.derive_account_trans_conversion_rate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0
    OR NEW.amount_original IS NULL OR NEW.amount_original <= 0 THEN
    RAISE EXCEPTION 'amount وamount_original يجب أن يكونا موجبين قبل احتساب conversion_rate.';
  END IF;

  NEW.conversion_rate := round(NEW.amount / NEW.amount_original, 8);

  IF NEW.account_cur_no = NEW.currency_original_no AND NEW.conversion_rate <> 1 THEN
    RAISE EXCEPTION 'مبلغ الساق يجب أن يساوي amount_original عندما تتطابق عملة الحساب وعملة الرأس.';
  END IF;

  IF (NEW.currency_price_id IS NULL) <> (NEW.currency_price_seq IS NULL) THEN
    RAISE EXCEPTION 'مرجع سعر الصرف يجب أن يتضمن id وseq معًا أو يتركهما فارغين معًا.';
  END IF;

  IF NEW.account_cur_no <> NEW.currency_original_no THEN
    IF NEW.currency_price_id IS NULL THEN
      RAISE EXCEPTION 'الساق متعددة العملات تحتاج مرجع سعر صرف موثق.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.cur_price cp
      WHERE cp.id = NEW.currency_price_id
        AND cp.seq = NEW.currency_price_seq
        AND cp.cur_no = NEW.currency_original_no
    ) THEN
      RAISE EXCEPTION 'مرجع سعر الصرف في الساق لا يطابق عملة رأس القيد.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_account_trans_derive_conversion_rate ON public.account_trans;
CREATE TRIGGER trg_account_trans_derive_conversion_rate
  BEFORE INSERT OR UPDATE OF amount, amount_original, account_cur_no, currency_original_no, currency_price_id, currency_price_seq
  ON public.account_trans
  FOR EACH ROW EXECUTE FUNCTION public.derive_account_trans_conversion_rate();

COMMIT;
