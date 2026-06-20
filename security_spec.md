# Security Specification for alx

## Data Invariants
1. A user must be authenticated to access any part of the system (except public tracking).
2. Root admins cannot be disabled or deleted.
3. Every order must have an associated customer.
4. Role-based access control (RBAC) is strictly enforced.

## 12 "Dirty Dozen" Payloads (Targets for PERMISSION_DENIED)
1. **Unauthenticated Read**: Attempting to read `/users` without a token.
2. **Self-Promotion**: An `Employee` attempting to change their own role to `Admin`.
3. **Disabling Root**: Attempting to set `disabled: true` on a root admin's document.
4. **Deleting Root**: Attempting to `delete` a root admin's document.
5. **Unauthorized Order Access**: An `Employee` attempting to read orders they didn't create (assuming the app wanted segregation, though currently it seems shared).
6. **Bypassing App Logic**: Creating an order without a `trackingNumber`.
7. **Illicit Role Creation**: Creating a new user with `isRoot: true`.
8. **Public PII Leak**: Attempting to read `fullName` or `phone` from `/public_tracking`. (Public tracking should only have status and history).
9. **Tampering with System Fields**: Updating `createdAt` on an existing order.
10. **Spoofed Identity**: Creating a user document where the UID doesn't match the authenticated UID.
11. **Orphans**: Creating a `trackingUpdate` for an `orderId` that doesn't exist.
12. **Status Skipping**: Skipping from `Ordered` straight to `Delivered` without intermediate stages (if enforced).

## Test Runner Plan
- We will use `firebase.rules.test.ts` to simulate these attacks.
