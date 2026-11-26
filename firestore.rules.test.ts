/**
 * Dirty Dozen Security Test Suite for MadPlan Nord Firestore Rules.
 * Verifies every adversarial payload defined in security_spec.md is rejected with PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  actorUid: string | null;
  emailVerified: boolean;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'DENY';
  guardReason: string;
}

export const DIRTY_DOZEN_PAYLOADS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Cross-User PII Read',
    actorUid: 'userB',
    emailVerified: true,
    operation: 'get',
    path: '/users/userA',
    expected: 'DENY',
    guardReason: 'isOwner(userId) blocks non-owner access to PII profile.',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    actorUid: 'userA',
    emailVerified: false,
    operation: 'create',
    path: '/users/userA',
    payload: { uid: 'userA', displayName: 'Test', email: 'a@b.dk' },
    expected: 'DENY',
    guardReason: 'isSignedIn() mandates request.auth.token.email_verified == true.',
  },
  {
    id: 3,
    name: 'Shadow Field Injection',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'create',
    path: '/users/userA',
    payload: { uid: 'userA', isAdmin: true },
    expected: 'DENY',
    guardReason: 'incoming().keys().hasOnly(...) rejects unauthorized ghost keys.',
  },
  {
    id: 4,
    name: 'Identity Spoofing on Subcollection',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'create',
    path: '/users/userA/receipts/r1',
    payload: { id: 'r1', ownerId: 'userB', storeName: 'Netto', purchaseDate: '2026-11-26', totalDkk: 120 },
    expected: 'DENY',
    guardReason: 'isValidReceipt enforces ownerId == request.auth.uid.',
  },
  {
    id: 5,
    name: 'Orphaned Subcollection Write',
    actorUid: 'userGhost',
    emailVerified: true,
    operation: 'create',
    path: '/users/userGhost/mealPlans/p1',
    payload: { id: 'p1', ownerId: 'userGhost', weekLabel: 'Uge 48', startDate: '2026-11-26' },
    expected: 'DENY',
    guardReason: 'Master Gate userProfileExists(userId) prevents orphaned subcollection writes.',
  },
  {
    id: 6,
    name: 'Document ID Poisoning',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'create',
    path: '/users/userA/recipes/' + 'x'.repeat(200),
    payload: { id: 'x'.repeat(200), ownerId: 'userA', title: 'Test' },
    expected: 'DENY',
    guardReason: 'isValidId() limits document IDs to 128 chars matching ^[a-zA-Z0-9_-]+$.',
  },
  {
    id: 7,
    name: 'Timestamp Forgery on Create',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'create',
    path: '/users/userA/receipts/r2',
    payload: { id: 'r2', ownerId: 'userA', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'DENY',
    guardReason: 'Temporal integrity requires incoming().createdAt == request.time.',
  },
  {
    id: 8,
    name: 'Immutable Field Mutation',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'update',
    path: '/users/userA/receipts/r1',
    payload: { ownerId: 'userB' },
    expected: 'DENY',
    guardReason: 'Update rule forbids changing ownerId/createdAt via affectedKeys().hasOnly and equality check.',
  },
  {
    id: 9,
    name: 'Value Poisoning on Whitelisted Update Key',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'update',
    path: '/users/userA/shoppingItems/i1',
    payload: { checked: 'yes' },
    expected: 'DENY',
    guardReason: 'isValidShoppingItem(incoming()) runs on update and requires checked is bool.',
  },
  {
    id: 10,
    name: 'Array Exhaustion (Denial of Wallet)',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'update',
    path: '/users/userA',
    payload: { customTags: Array.from({ length: 50 }, (_, i) => `tag-${i}`) },
    expected: 'DENY',
    guardReason: 'isValidStringArray(data.customTags, 30) caps customTags at 30 items.',
  },
  {
    id: 11,
    name: 'Oversized String Injection',
    actorUid: 'userA',
    emailVerified: true,
    operation: 'create',
    path: '/users/userA/recipes/rec1',
    payload: { id: 'rec1', ownerId: 'userA', title: 'A'.repeat(2000) },
    expected: 'DENY',
    guardReason: 'isValidRecipe caps title.size() <= 140.',
  },
  {
    id: 12,
    name: 'Blanket Collection Scrape',
    actorUid: 'userB',
    emailVerified: true,
    operation: 'list',
    path: '/users/userA/receipts',
    expected: 'DENY',
    guardReason: 'allow list requires isOwner(userId) && resource.data.ownerId == request.auth.uid.',
  },
];
