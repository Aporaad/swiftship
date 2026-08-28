-- يثبت أن مستلم العهدة وحسابه المالي يشيران إلى الكيان نفسه.
-- لا يغيّر RLS ولا يمس البيانات التاريخية أو الجداول القديمة.
BEGIN;

CREATE OR REPLACE FUNCTION public.validate_custody_advance_target()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_account public.accounts%ROWTYPE;
  expected_entity_type text;
BEGIN
  SELECT * INTO target_account FROM public.accounts WHERE id = NEW.recipient_account_id;
  IF NOT FOUND OR target_account.is_active = false OR target_account.acc_sub_id IS NULL OR target_account.cur_no IS NULL THEN
    RAISE EXCEPTION 'حساب مستلم العهدة يجب أن يكون حسابًا ماليًا ورقيًا ونشطًا بعملة محددة.';
  END IF;
  IF NEW.recipient_type NOT IN ('employee', 'courier', 'customer', 'supplier', 'other') THEN
    RAISE EXCEPTION 'نوع مستلم العهدة غير صالح.';
  END IF;
  IF NEW.recipient_type <> 'other' THEN
    expected_entity_type := CASE WHEN NEW.recipient_type = 'supplier' THEN 'source' ELSE NEW.recipient_type END;
    IF target_account.entity_type IS DISTINCT FROM expected_entity_type OR target_account.entity_id IS DISTINCT FROM NEW.recipient_id THEN
      RAISE EXCEPTION 'حساب المستلم لا يطابق كيان العهدة أو نوعه.';
    END IF;
  END IF;
  IF (NEW.currency_price_id IS NULL) <> (NEW.currency_price_seq IS NULL) THEN
    RAISE EXCEPTION 'مرجع سعر صرف العهدة يجب أن يتضمن id وseq معًا أو يتركهما فارغين معًا.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custody_advances_target ON public.custody_advances;
CREATE TRIGGER trg_custody_advances_target
  BEFORE INSERT OR UPDATE OF recipient_type, recipient_id, recipient_account_id, currency_price_id, currency_price_seq
  ON public.custody_advances
  FOR EACH ROW EXECUTE FUNCTION public.validate_custody_advance_target();

COMMIT;
