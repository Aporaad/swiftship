ALTER TABLE IF EXISTS public.shipments
    ALTER COLUMN shipment_status DROP DEFAULT;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN shipping_type text;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN shipping_source text;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN shipping_destination text;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN shipping_date timestamp with time zone;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN shipping_duration numeric;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN expected_arrival timestamp with time zone;

ALTER TABLE IF EXISTS public.shipments
    ADD COLUMN delivery_date timestamp with time zone;