-- Portal-only RBAC seed. It never writes to the system roles or user_roles tables.
-- Active approved portal users are matched only to their exact portal_role value.
-- Pending, rejected, or disabled identities receive no assignment; no wildcard is used.
BEGIN;

INSERT INTO alx_api_private.portal_roles (code, name, description, is_system_role)
VALUES
  ('customer', 'عميل البوابة', 'Portal customer; scoped to the authenticated portal identity', true),
  ('courier', 'مندوب البوابة', 'Portal courier; shipment actions must remain assignment-scoped', true),
  ('supplier', 'مورد البوابة', 'Portal supplier; orders and ledger must remain assignment-scoped', true),
  ('client', 'عميل قديم للبوابة', 'Legacy portal role retained without business access pending mapping', true)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, is_system_role = true;

INSERT INTO alx_api_private.portal_permissions (code, resource, action, description)
VALUES
  ('portal.profile.read', 'portal_profile', 'read', 'Read the authenticated portal profile only'),
  ('portal.profile.update', 'portal_profile', 'update', 'Update the authenticated portal profile only'),
  ('portal.customer_details.read', 'portal_customer_details', 'read', 'Read details linked to the authenticated customer'),
  ('portal.customer_details.update', 'portal_customer_details', 'update', 'Update details linked to the authenticated customer'),
  ('portal.customer_orders.read', 'portal_customer_orders', 'read', 'Read orders owned by the authenticated customer'),
  ('portal.customer_orders.create', 'portal_customer_orders', 'create', 'Create an order for the authenticated customer'),
  ('portal.customer_ledger.read', 'portal_customer_ledger', 'read', 'Read the authenticated customer ledger only'),
  ('portal.customer_tickets.read', 'portal_customer_tickets', 'read', 'Read tickets owned by the authenticated customer'),
  ('portal.customer_tickets.create', 'portal_customer_tickets', 'create', 'Create a ticket for the authenticated customer'),
  ('portal.customer_announcements.read', 'portal_customer_announcements', 'read', 'Read portal announcements'),
  ('portal.courier_shipments.read', 'portal_courier_shipments', 'read', 'Read shipments assigned to the authenticated courier'),
  ('portal.courier_shipments.update_status', 'portal_courier_shipments', 'update_status', 'Update status only for shipments assigned to the authenticated courier'),
  ('portal.courier_ledger.read', 'portal_courier_ledger', 'read', 'Read the authenticated courier ledger only'),
  ('portal.courier_tickets.read', 'portal_courier_tickets', 'read', 'Read tickets owned by the authenticated courier'),
  ('portal.courier_tickets.create', 'portal_courier_tickets', 'create', 'Create a ticket for the authenticated courier'),
  ('portal.courier_announcements.read', 'portal_courier_announcements', 'read', 'Read portal announcements'),
  ('portal.supplier_orders.read', 'portal_supplier_orders', 'read', 'Read orders assigned to the authenticated supplier'),
  ('portal.supplier_ledger.read', 'portal_supplier_ledger', 'read', 'Read the authenticated supplier ledger only'),
  ('portal.supplier_tickets.read', 'portal_supplier_tickets', 'read', 'Read tickets owned by the authenticated supplier'),
  ('portal.supplier_tickets.create', 'portal_supplier_tickets', 'create', 'Create a ticket for the authenticated supplier'),
  ('portal.supplier_announcements.read', 'portal_supplier_announcements', 'read', 'Read portal announcements')
ON CONFLICT (code) DO UPDATE
SET resource = EXCLUDED.resource, action = EXCLUDED.action, description = EXCLUDED.description;

INSERT INTO alx_api_private.portal_role_permissions (portal_role_id, portal_permission_id)
SELECT role.portal_role_id, permission.portal_permission_id
FROM (VALUES
  ('customer', 'portal.profile.read'),
  ('customer', 'portal.profile.update'),
  ('customer', 'portal.customer_details.read'),
  ('customer', 'portal.customer_details.update'),
  ('customer', 'portal.customer_orders.read'),
  ('customer', 'portal.customer_orders.create'),
  ('customer', 'portal.customer_ledger.read'),
  ('customer', 'portal.customer_tickets.read'),
  ('customer', 'portal.customer_tickets.create'),
  ('customer', 'portal.customer_announcements.read'),
  ('courier', 'portal.profile.read'),
  ('courier', 'portal.profile.update'),
  ('courier', 'portal.courier_shipments.read'),
  ('courier', 'portal.courier_shipments.update_status'),
  ('courier', 'portal.courier_ledger.read'),
  ('courier', 'portal.courier_tickets.read'),
  ('courier', 'portal.courier_tickets.create'),
  ('courier', 'portal.courier_announcements.read'),
  ('supplier', 'portal.profile.read'),
  ('supplier', 'portal.profile.update'),
  ('supplier', 'portal.supplier_orders.read'),
  ('supplier', 'portal.supplier_ledger.read'),
  ('supplier', 'portal.supplier_tickets.read'),
  ('supplier', 'portal.supplier_tickets.create'),
  ('supplier', 'portal.supplier_announcements.read'),
  ('client', 'portal.profile.read')
) AS grant_map(role_code, permission_code)
JOIN alx_api_private.portal_roles AS role ON role.code = grant_map.role_code
JOIN alx_api_private.portal_permissions AS permission ON permission.code = grant_map.permission_code
ON CONFLICT (portal_role_id, portal_permission_id) DO NOTHING;

INSERT INTO alx_api_private.portal_user_roles (portal_user_id, portal_role_id, assigned_at)
SELECT portal_user.portal_user_id, role.portal_role_id, now()
FROM public.portal_users AS portal_user
JOIN alx_api_private.portal_roles AS role
  ON role.code = lower(btrim(portal_user.portal_role))
WHERE lower(btrim(portal_user.portal_role)) = ANY (ARRAY['customer', 'courier', 'supplier', 'client'])
  AND lower(btrim(coalesce(portal_user.approval_status, ''))) = 'approved'
  AND NOT coalesce(portal_user.disabled, false)
  AND NOT coalesce(portal_user.is_disabled, false)
ORDER BY portal_user.portal_user_id
LIMIT 5000
ON CONFLICT (portal_user_id, portal_role_id) DO NOTHING;

COMMIT;
