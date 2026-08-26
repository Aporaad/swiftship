# Orders history — current schema notes

## Supabase project

The active SwiftShip Supabase project is `ejrojwbbflzchasvgexr`.

## Existing relation fields

| Table | Primary key | Relevant fields |
|---|---|---|
| `orders` | `id` (text) | `order_number`, `tracking_number`, `order_status`, `customer_id`, `createdAt`, and courier/source references. |
| `shipments` | `id` (text) | `order_id`, `tracking_number`, `shipment_status`, company/courier references, cost, weight, data, and `createdAt`. |
| `journal_entries` | `id` (text) | `data`, `transactionID`, `account_id`, and `created_by_uid`. |
| `account_transactions` | `id` (text) | `data`, `journalEntryNumber`, `module`, `amount`, `currency`, and `createdAt`. |
| `activity_logs` | `id` (text) | `userId`, `action`, `category`, `target`, `type`, `data`, and `createdAt`. |
| `users` | `id` (text) | `username`, `email`, `role`, and `data`. |

## Security finding to address separately

Supabase reports that Row Level Security is disabled for the current public tables, including orders, shipments, activity_logs, journal_entries, and account_transactions. Enabling RLS requires explicit policies and must not be performed automatically because it may interrupt existing client access.

## Post-migration security review

The Supabase security advisor also reported mutable `search_path` warnings for the new `orders_history` helper and trigger functions. A follow-up migration will set an explicit path for these functions. Existing public tables, including the tables used by the audit feature, continue to report RLS-disabled errors despite having policies; this is a pre-existing project-wide access-control issue. It is not safe to enable RLS automatically because the current browser client relies on direct table access. The recommended remediation is to define role-aware policies first, then enable RLS in a controlled security hardening task. Reference: <https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public>.
