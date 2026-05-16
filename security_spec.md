# Security Spec - Shoe ERP

## Data Invariants
1. A User must be authenticated to access any data.
2. A User can only write their own user profile during initial login.
3. Only Admins can change roles or modify global settings.
4. All timestamps (createdAt, updatedAt) must be validated with request.time.
5. All IDs must be validated with isValidId().

## The "Dirty Dozen" Payloads (Denial Tests)
1. **Identity Spoofing**: Attempt to create a user profile with a different UID.
2. **Privilege Escalation**: Attempt to self-assign 'admin' role in a non-admin session.
3. **Ghost Field Injection**: Adding `isVerified: true` to a product.
4. **Orphaned Order**: Creating an order without a valid customer ID (if required).
5. **Denial of Wallet**: Injecting a 2MB string into a product barcode.
6. **State Shortcutting**: Skipping order status (if implemented).
7. **Resource Poisoning**: Using `../../` in a document ID.
8. **PII Leak**: Non-admin user trying to read all users.
9. **Query Scraping**: Authenticated user trying to `list` all orders without a owner filter.
10. **Immutable Field Write**: Attempting to change `createdAt` on an existing product.
11. **Negative Inventory**: Setting product quantity to -5.
12. **Price Manipulation**: Employee setting selling price to 0.

## Test Runner (Mock Tests)
- `get(/users/attacker_uid)` -> ALLOW
- `set(/users/attacker_uid, {role: 'admin'})` -> DENY (unless initial setup or admin)
- `list(/users)` -> DENY (for non-admins)
- `set(/products/new, {name: 'Sneakers', sellingPrice: -10})` -> DENY
