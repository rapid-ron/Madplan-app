# Security Specification — MadPlan Nord Firestore Rules

## 1. Data Invariants
1. **Strict Ownership & PII Isolation**: `/users/{userId}` holds private PII (`email`, `displayName`, personal calorie & budget settings). Only the verified authenticated owner (`request.auth.uid == userId && request.auth.token.email_verified == true`) may read or write their own document. No blanket `isSignedIn()` reads exist anywhere.
2. **Master Gate**: Every subcollection document under `/users/{userId}/{subcollection}/{docId}` requires the parent `/users/{userId}` document to exist via `exists()` on single-document writes/reads, ensuring orphaned sub-records cannot be created.
3. **Immutable Ownership & Timestamps**: `ownerId` (or `uid`) and `createdAt` can never be mutated after creation. `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
4. **Strict Schema & Bounds**: Every string field has `.size()` bounds matching `firebase-blueprint.json`. Every array field has `.size() <= MAX` bounds and first-element type validation when non-empty. Every create enforces `hasAll` and `hasOnly`. Every update enforces `affectedKeys().hasOnly(...)` per named action and re-runs `isValid[Entity](incoming())`.
5. **Path Variable Hardening**: Every single-document target (`get`, `create`, `update`, `delete`) validates document IDs with `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, length <= 128).
6. **Secure List Queries**: Every `allow list` validates `resource.data.ownerId == request.auth.uid` (and `request.auth.uid == userId`) without calling `get()` or `exists()` inside `allow list`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Cross-User PII Read**: User B calls `get(/users/userA)` -> DENIED (`request.auth.uid != userId`).
2. **Unverified Email Write**: User A with `email_verified: false` creates `/users/userA` -> DENIED (`email_verified == true` required).
3. **Shadow Field Injection**: User A creates `/users/userA` with extra key `{ isAdmin: true }` -> DENIED (`hasOnly` rejects ghost key).
4. **Identity Spoofing on Subcollection**: User A creates `/users/userA/receipts/r1` with `ownerId: "userB"` -> DENIED (`ownerId == request.auth.uid`).
5. **Orphaned Subcollection Write**: User A creates `/users/userA/mealPlans/p1` before `/users/userA` exists -> DENIED (Master Gate `exists()`).
6. **Document ID Poisoning**: User A creates `/users/userA/recipes/../../../bad$id` or 200-char ID -> DENIED (`isValidId`).
7. **Timestamp Forgery on Create**: User A creates receipt with client-supplied `createdAt: 2020-01-01` -> DENIED (`createdAt == request.time`).
8. **Immutable Field Mutation**: User A updates receipt trying to change `ownerId` or `createdAt` -> DENIED (`affectedKeys().hasOnly` + immutability check).
9. **Value Poisoning on Whitelisted Update Key**: User A updates `shoppingItems/i1` setting `checked: "yes"` (string instead of bool) -> DENIED (`isValidShoppingItem(incoming())`).
10. **Array Exhaustion (Denial of Wallet)**: User A updates `/users/userA` with 50 `customTags` (limit 30) -> DENIED (`customTags.size() <= 30`).
11. **Oversized String Injection**: User A creates recipe with 2000-character `title` (limit 140) -> DENIED (`title.size() <= 140`).
12. **Blanket Collection Scrape**: User B calls `list(/users)` or `list(/users/userA/receipts)` -> DENIED (default deny on `/users` list; owner check on subcollection list).
