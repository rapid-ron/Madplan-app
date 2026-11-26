import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isValidIsoDate,
  OperationType,
  sanitizeId,
  sanitizeStringArray,
} from '../lib/firebase';
import {
  buildShoppingItemsFromPlan,
  createInitialMealPlan,
  createInitialReceipts,
  DEFAULT_PROFILE,
  INITIAL_RECIPES,
} from '../data/seedData';
import {
  CloudBackup,
  MealPlan,
  Receipt,
  Recipe,
  ShoppingItem,
  UserProfile,
} from '../types';
import { requestAndSendNotification } from '../lib/calendarExport';

const STORAGE_KEY = 'madplan_nord_local_v1';

interface LocalStoreShape {
  profile: UserProfile;
  mealPlans: MealPlan[];
  shoppingItems: ShoppingItem[];
  recipes: Recipe[];
  receipts: Receipt[];
  backups: CloudBackup[];
}

function loadLocalData(): LocalStoreShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.profile && Array.isArray(parsed.mealPlans)) {
        return parsed;
      }
    }
  } catch {
    // fallback to seed
  }
  const initialPlan = createInitialMealPlan('local-user');
  return {
    profile: DEFAULT_PROFILE,
    mealPlans: [initialPlan],
    shoppingItems: buildShoppingItemsFromPlan(initialPlan, 'local-user'),
    recipes: INITIAL_RECIPES,
    receipts: createInitialReceipts('local-user'),
    backups: [],
  };
}

interface AppDataContextValue {
  user: User | null;
  authReady: boolean;
  cloudSynced: boolean;
  syncError: string | null;
  profile: UserProfile;
  mealPlans: MealPlan[];
  activeMealPlan: MealPlan | null;
  activePlanId: string;
  setActivePlanId: (id: string) => void;
  shoppingItems: ShoppingItem[];
  recipes: Recipe[];
  receipts: Receipt[];
  backups: CloudBackup[];
  currentMonthSpendDkk: number;
  budgetUsagePercent: number;
  isOverBudget: boolean;
  isNearBudget: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  updateProfile: (patch: Partial<UserProfile>) => Promise<void>;
  saveMealPlan: (plan: MealPlan, replaceShoppingList?: boolean) => Promise<void>;
  updateMealPlan: (plan: MealPlan) => Promise<void>;
  toggleShoppingItem: (itemId: string) => Promise<void>;
  addShoppingItem: (item: Omit<ShoppingItem, 'id' | 'ownerId'>) => Promise<void>;
  deleteShoppingItem: (itemId: string) => Promise<void>;
  clearCheckedShoppingItems: () => Promise<void>;
  rebuildShoppingListFromPlan: (plan: MealPlan) => Promise<void>;
  saveRecipe: (recipe: Omit<Recipe, 'ownerId'>) => Promise<void>;
  toggleRecipeFavorite: (recipeId: string) => Promise<void>;
  deleteRecipe: (recipeId: string) => Promise<void>;
  saveReceipt: (receipt: Omit<Receipt, 'ownerId'>) => Promise<void>;
  deleteReceipt: (receiptId: string) => Promise<void>;
  createCloudBackup: (label: string) => Promise<void>;
  restoreCloudBackup: (backup: CloudBackup) => Promise<void>;
  deleteCloudBackup: (backupId: string) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

function sanitizeProfilePayload(profile: UserProfile, uid: string) {
  return {
    uid,
    displayName: (profile.displayName || 'Bruger').slice(0, 100),
    email: (profile.email || '').slice(0, 200),
    dietType: profile.dietType,
    dailyCalories: Math.max(800, Math.min(6000, Number(profile.dailyCalories) || 2100)),
    proteinTarget: Math.max(20, Math.min(400, Number(profile.proteinTarget) || 105)),
    carbsTarget: Math.max(0, Math.min(800, Number(profile.carbsTarget) || 240)),
    fatTarget: Math.max(10, Math.min(300, Number(profile.fatTarget) || 70)),
    householdSize: Math.max(1, Math.min(12, Number(profile.householdSize) || 2)),
    monthlyBudgetDkk: Math.max(200, Math.min(100000, Number(profile.monthlyBudgetDkk) || 3800)),
    weeklyMealBudgetDkk: Math.max(50, Math.min(25000, Number(profile.weeklyMealBudgetDkk) || 750)),
    allergies: sanitizeStringArray(profile.allergies || [], 15, 60),
    customTags: sanitizeStringArray(profile.customTags || [], 30, 50),
    mealTimes: {
      breakfast: /^\d{2}:\d{2}$/.test(profile.mealTimes?.breakfast || '') ? profile.mealTimes.breakfast : '07:30',
      lunch: /^\d{2}:\d{2}$/.test(profile.mealTimes?.lunch || '') ? profile.mealTimes.lunch : '12:00',
      dinner: /^\d{2}:\d{2}$/.test(profile.mealTimes?.dinner || '') ? profile.mealTimes.dinner : '18:00',
    },
    budgetAlertThreshold: Math.max(50, Math.min(100, Number(profile.budgetAlertThreshold) || 85)),
    notificationsEnabled: Boolean(profile.notificationsEnabled),
  };
}

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialLocal = useMemo(() => loadLocalData(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile>(initialLocal.profile);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>(initialLocal.mealPlans);
  const [activePlanId, setActivePlanId] = useState<string>(initialLocal.mealPlans[0]?.id || '');
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(initialLocal.shoppingItems);
  const [recipes, setRecipes] = useState<Recipe[]>(initialLocal.recipes);
  const [receipts, setReceipts] = useState<Receipt[]>(initialLocal.receipts);
  const [backups, setBackups] = useState<CloudBackup[]>(initialLocal.backups);

  const alertedMonthRef = useRef<string>('');

  // Persist local guest copy
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ profile, mealPlans, shoppingItems, recipes, receipts, backups })
        );
      } catch {
        // ignore storage quota errors
      }
    }
  }, [user, profile, mealPlans, shoppingItems, recipes, receipts, backups]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setCloudSynced(false);
      }
    });
    return () => unsub();
  }, []);

  // Ensure /users/{uid} exists (Master Gate) and attach real-time onSnapshot listeners across devices
  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    const unsubscribers: Array<() => void> = [];

    const initCloudSync = async () => {
      const uid = user.uid;
      const userDocPath = `users/${uid}`;
      const userRef = doc(db, 'users', uid);

      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const initialCloudProfile = sanitizeProfilePayload(
            {
              ...profile,
              uid,
              displayName: user.displayName || profile.displayName || 'Bruger',
              email: user.email || '',
            },
            uid
          );
          await setDoc(userRef, {
            ...initialCloudProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Seed initial data into user's cloud workspace so new accounts start rich
          const batch = writeBatch(db);
          for (const plan of mealPlans.slice(0, 2)) {
            const pid = sanitizeId(plan.id);
            batch.set(doc(db, 'users', uid, 'mealPlans', pid), {
              id: pid,
              ownerId: uid,
              weekLabel: plan.weekLabel.slice(0, 64),
              startDate: isValidIsoDate(plan.startDate) ? plan.startDate : new Date().toISOString().slice(0, 10),
              dietType: plan.dietType,
              targetCalories: plan.targetCalories,
              householdSize: plan.householdSize,
              estimatedWeeklyCostDkk: plan.estimatedWeeklyCostDkk,
              days: plan.days.slice(0, 7),
              mealPrepTips: sanitizeStringArray(plan.mealPrepTips || [], 10),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          for (const rec of recipes.slice(0, 12)) {
            const rid = sanitizeId(rec.id);
            batch.set(doc(db, 'users', uid, 'recipes', rid), {
              id: rid,
              ownerId: uid,
              title: rec.title.slice(0, 140),
              description: rec.description.slice(0, 500),
              imageUrl: rec.imageUrl.slice(0, 500),
              dietType: rec.dietType,
              mealType: rec.mealType,
              prepMinutes: Math.max(1, Math.min(600, rec.prepMinutes)),
              servings: Math.max(1, Math.min(24, rec.servings)),
              estimatedCostDkk: Math.max(0, rec.estimatedCostDkk),
              calories: Math.max(0, rec.calories),
              protein: Math.max(0, rec.protein),
              carbs: Math.max(0, rec.carbs),
              fat: Math.max(0, rec.fat),
              fiber: Math.max(0, rec.fiber),
              ingredients: sanitizeStringArray(rec.ingredients, 40),
              steps: sanitizeStringArray(rec.steps, 25),
              tags: sanitizeStringArray(rec.tags, 15, 50),
              isFavorite: Boolean(rec.isFavorite),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          for (const item of shoppingItems.slice(0, 40)) {
            const sid = sanitizeId(item.id);
            batch.set(doc(db, 'users', uid, 'shoppingItems', sid), {
              id: sid,
              ownerId: uid,
              name: item.name.slice(0, 120),
              amount: item.amount.slice(0, 60),
              category: item.category.slice(0, 60),
              estimatedPriceDkk: Math.max(0, item.estimatedPriceDkk),
              checked: Boolean(item.checked),
              fromMealPlanId: sanitizeId(item.fromMealPlanId || 'manual'),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          for (const r of receipts.slice(0, 20)) {
            const rcid = sanitizeId(r.id);
            batch.set(doc(db, 'users', uid, 'receipts', rcid), {
              id: rcid,
              ownerId: uid,
              storeName: r.storeName.slice(0, 100),
              purchaseDate: isValidIsoDate(r.purchaseDate) ? r.purchaseDate : new Date().toISOString().slice(0, 10),
              totalDkk: Math.max(0, r.totalDkk),
              primaryCategory: r.primaryCategory.slice(0, 60),
              items: r.items.slice(0, 60),
              tags: sanitizeStringArray(r.tags, 15, 50),
              notes: (r.notes || '').slice(0, 300),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
      } catch (err) {
        setSyncError('Kunne ikke initialisere cloud-synkronisering.');
        handleFirestoreError(err, OperationType.WRITE, userDocPath);
      }

      if (cancelled) return;

      // 1. User Profile listener
      unsubscribers.push(
        onSnapshot(
          userRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const d = docSnap.data();
              setProfile({
                uid: d.uid,
                displayName: d.displayName,
                email: d.email,
                dietType: d.dietType,
                dailyCalories: d.dailyCalories,
                proteinTarget: d.proteinTarget,
                carbsTarget: d.carbsTarget,
                fatTarget: d.fatTarget,
                householdSize: d.householdSize,
                monthlyBudgetDkk: d.monthlyBudgetDkk,
                weeklyMealBudgetDkk: d.weeklyMealBudgetDkk,
                allergies: d.allergies || [],
                customTags: d.customTags || [],
                mealTimes: d.mealTimes || DEFAULT_PROFILE.mealTimes,
                budgetAlertThreshold: d.budgetAlertThreshold ?? 85,
                notificationsEnabled: Boolean(d.notificationsEnabled),
              });
              setCloudSynced(true);
              setSyncError(null);
            }
          },
          (error) => {
            setSyncError('Synkroniseringsfejl for brugerprofil.');
            handleFirestoreError(error, OperationType.GET, userDocPath);
          }
        )
      );

      // 2. Meal Plans listener
      const plansPath = `users/${uid}/mealPlans`;
      unsubscribers.push(
        onSnapshot(
          query(collection(db, plansPath), where('ownerId', '==', uid)),
          (snap) => {
            const loaded: MealPlan[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                ownerId: d.ownerId,
                weekLabel: d.weekLabel,
                startDate: d.startDate,
                dietType: d.dietType,
                targetCalories: d.targetCalories,
                householdSize: d.householdSize,
                estimatedWeeklyCostDkk: d.estimatedWeeklyCostDkk,
                days: d.days || [],
                mealPrepTips: d.mealPrepTips || [],
                createdAtIso: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : undefined,
              };
            });
            loaded.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
            setMealPlans(loaded);
            setActivePlanId((prev) => (loaded.some((p) => p.id === prev) ? prev : loaded[0]?.id || ''));
          },
          (error) => handleFirestoreError(error, OperationType.LIST, plansPath)
        )
      );

      // 3. Shopping Items listener
      const shopPath = `users/${uid}/shoppingItems`;
      unsubscribers.push(
        onSnapshot(
          query(collection(db, shopPath), where('ownerId', '==', uid)),
          (snap) => {
            const loaded: ShoppingItem[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                ownerId: d.ownerId,
                name: d.name,
                amount: d.amount,
                category: d.category,
                estimatedPriceDkk: d.estimatedPriceDkk,
                checked: Boolean(d.checked),
                fromMealPlanId: d.fromMealPlanId,
              };
            });
            setShoppingItems(loaded);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, shopPath)
        )
      );

      // 4. Recipes listener
      const recPath = `users/${uid}/recipes`;
      unsubscribers.push(
        onSnapshot(
          query(collection(db, recPath), where('ownerId', '==', uid)),
          (snap) => {
            const loaded: Recipe[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                ownerId: d.ownerId,
                title: d.title,
                description: d.description,
                imageUrl: d.imageUrl,
                dietType: d.dietType,
                mealType: d.mealType,
                prepMinutes: d.prepMinutes,
                servings: d.servings,
                estimatedCostDkk: d.estimatedCostDkk,
                calories: d.calories,
                protein: d.protein,
                carbs: d.carbs,
                fat: d.fat,
                fiber: d.fiber,
                ingredients: d.ingredients || [],
                steps: d.steps || [],
                tags: d.tags || [],
                isFavorite: Boolean(d.isFavorite),
              };
            });
            setRecipes(loaded);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, recPath)
        )
      );

      // 5. Receipts listener
      const rcptPath = `users/${uid}/receipts`;
      unsubscribers.push(
        onSnapshot(
          query(collection(db, rcptPath), where('ownerId', '==', uid)),
          (snap) => {
            const loaded: Receipt[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                ownerId: d.ownerId,
                storeName: d.storeName,
                purchaseDate: d.purchaseDate,
                totalDkk: d.totalDkk,
                primaryCategory: d.primaryCategory,
                items: d.items || [],
                tags: d.tags || [],
                notes: d.notes || '',
              };
            });
            loaded.sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
            setReceipts(loaded);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, rcptPath)
        )
      );

      // 6. Cloud Backups listener
      const backupPath = `users/${uid}/backups`;
      unsubscribers.push(
        onSnapshot(
          query(collection(db, backupPath), where('ownerId', '==', uid)),
          (snap) => {
            const loaded: CloudBackup[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: d.id,
                ownerId: d.ownerId,
                label: d.label,
                deviceName: d.deviceName,
                createdAtIso: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : new Date().toISOString(),
                counts: d.counts,
                snapshotData: d.snapshotData,
              };
            });
            loaded.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
            setBackups(loaded);
          },
          (error) => handleFirestoreError(error, OperationType.LIST, backupPath)
        )
      );
    };

    initCloudSync();

    return () => {
      cancelled = true;
      unsubscribers.forEach((fn) => fn());
    };
  }, [authReady, user]);

  // Budget computations & automatic overrun notification alert
  const currentYm = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const currentMonthSpendDkk = useMemo(
    () =>
      receipts
        .filter((r) => r.purchaseDate.startsWith(currentYm))
        .reduce((sum, r) => sum + r.totalDkk, 0),
    [receipts, currentYm]
  );

  const budgetUsagePercent = Math.round(
    (currentMonthSpendDkk / Math.max(1, profile.monthlyBudgetDkk)) * 100
  );
  const isOverBudget = currentMonthSpendDkk > profile.monthlyBudgetDkk;
  const isNearBudget =
    !isOverBudget && budgetUsagePercent >= (profile.budgetAlertThreshold || 85);

  useEffect(() => {
    if (!profile.notificationsEnabled) return;
    const alertKey = `${currentYm}-${isOverBudget ? 'over' : isNearBudget ? 'near' : 'ok'}`;
    if ((isOverBudget || isNearBudget) && alertedMonthRef.current !== alertKey) {
      alertedMonthRef.current = alertKey;
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        requestAndSendNotification(
          isOverBudget ? 'Budgetoverskridelse i MadPlan Nord' : 'Nærmer sig månedsbudgettet',
          isOverBudget
            ? `Du har brugt ${Math.round(currentMonthSpendDkk)} kr. ud af dit budget på ${profile.monthlyBudgetDkk} kr. (${budgetUsagePercent}%).`
            : `Du har brugt ${budgetUsagePercent}% af månedens dagligvarebudget (${Math.round(currentMonthSpendDkk)} kr.).`
        );
      }
    }
  }, [currentMonthSpendDkk, isOverBudget, isNearBudget, budgetUsagePercent, profile.monthlyBudgetDkk, profile.notificationsEnabled, currentYm]);

  const activeMealPlan = useMemo(
    () => mealPlans.find((p) => p.id === activePlanId) || mealPlans[0] || null,
    [mealPlans, activePlanId]
  );

  // Actions
  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google Sign-In error:', error);
      setSyncError('Login blev annulleret eller mislykkedes. Prøv igen.');
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
    setCloudSynced(false);
  };

  const updateProfile = async (patch: Partial<UserProfile>) => {
    const merged: UserProfile = { ...profile, ...patch };
    setProfile(merged);
    if (user) {
      const uid = user.uid;
      const path = `users/${uid}`;
      const sanitized = sanitizeProfilePayload(merged, uid);
      const { uid: _u, email: _e, ...updatable } = sanitized;
      try {
        await updateDoc(doc(db, 'users', uid), {
          ...updatable,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    }
  };

  const rebuildShoppingListFromPlan = async (plan: MealPlan) => {
    const ownerId = user?.uid || 'local-user';
    const nextItems = buildShoppingItemsFromPlan(plan, ownerId);

    if (!user) {
      setShoppingItems((prev) => {
        const manualItems = prev.filter((i) => i.fromMealPlanId === 'manual');
        return [...nextItems, ...manualItems];
      });
      return;
    }

    const uid = user.uid;
    const path = `users/${uid}/shoppingItems`;
    try {
      const batch = writeBatch(db);
      for (const oldItem of shoppingItems) {
        if (oldItem.fromMealPlanId !== 'manual') {
          batch.delete(doc(db, 'users', uid, 'shoppingItems', sanitizeId(oldItem.id)));
        }
      }
      for (const item of nextItems.slice(0, 60)) {
        const sid = sanitizeId(item.id);
        batch.set(doc(db, 'users', uid, 'shoppingItems', sid), {
          id: sid,
          ownerId: uid,
          name: item.name.slice(0, 120),
          amount: item.amount.slice(0, 60),
          category: item.category.slice(0, 60),
          estimatedPriceDkk: Math.max(0, Number(item.estimatedPriceDkk) || 0),
          checked: false,
          fromMealPlanId: sanitizeId(plan.id),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const saveMealPlan = async (plan: MealPlan, replaceShoppingList = true) => {
    const pid = sanitizeId(plan.id);
    const ownerId = user?.uid || 'local-user';
    const normalized: MealPlan = {
      ...plan,
      id: pid,
      ownerId,
      weekLabel: plan.weekLabel.slice(0, 64),
      startDate: isValidIsoDate(plan.startDate) ? plan.startDate : new Date().toISOString().slice(0, 10),
      days: plan.days.slice(0, 7),
      mealPrepTips: sanitizeStringArray(plan.mealPrepTips || [], 10),
    };

    setActivePlanId(pid);
    if (!user) {
      setMealPlans((prev) => [normalized, ...prev.filter((p) => p.id !== pid)]);
      if (replaceShoppingList) {
        await rebuildShoppingListFromPlan(normalized);
      }
      return;
    }

    const uid = user.uid;
    const path = `users/${uid}/mealPlans/${pid}`;
    try {
      await setDoc(doc(db, 'users', uid, 'mealPlans', pid), {
        id: pid,
        ownerId: uid,
        weekLabel: normalized.weekLabel,
        startDate: normalized.startDate,
        dietType: normalized.dietType,
        targetCalories: Math.max(800, Math.min(6000, normalized.targetCalories)),
        householdSize: Math.max(1, Math.min(12, normalized.householdSize)),
        estimatedWeeklyCostDkk: Math.max(0, Math.min(50000, normalized.estimatedWeeklyCostDkk)),
        days: normalized.days,
        mealPrepTips: normalized.mealPrepTips,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      if (replaceShoppingList) {
        await rebuildShoppingListFromPlan(normalized);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const updateMealPlan = async (plan: MealPlan) => {
    const pid = sanitizeId(plan.id);
    if (!user) {
      setMealPlans((prev) => prev.map((p) => (p.id === pid ? plan : p)));
      return;
    }

    const uid = user.uid;
    const path = `users/${uid}/mealPlans/${pid}`;
    try {
      await updateDoc(doc(db, 'users', uid, 'mealPlans', pid), {
        weekLabel: plan.weekLabel.slice(0, 64),
        startDate: isValidIsoDate(plan.startDate) ? plan.startDate : new Date().toISOString().slice(0, 10),
        dietType: plan.dietType,
        targetCalories: Math.max(800, Math.min(6000, plan.targetCalories)),
        householdSize: Math.max(1, Math.min(12, plan.householdSize)),
        estimatedWeeklyCostDkk: Math.max(0, Math.min(50000, plan.estimatedWeeklyCostDkk)),
        days: plan.days.slice(0, 7),
        mealPrepTips: sanitizeStringArray(plan.mealPrepTips || [], 10),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const toggleShoppingItem = async (itemId: string) => {
    const existingItem = shoppingItems.find((i) => i.id === itemId);
    if (!existingItem) return;
    const nextChecked = !existingItem.checked;

    if (!user) {
      setShoppingItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, checked: nextChecked } : i))
      );
      return;
    }

    const uid = user.uid;
    const sid = sanitizeId(itemId);
    const path = `users/${uid}/shoppingItems/${sid}`;
    try {
      await updateDoc(doc(db, 'users', uid, 'shoppingItems', sid), {
        checked: nextChecked,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const addShoppingItem = async (item: Omit<ShoppingItem, 'id' | 'ownerId'>) => {
    const sid = sanitizeId(`shop-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    const ownerId = user?.uid || 'local-user';
    const fullItem: ShoppingItem = {
      ...item,
      id: sid,
      ownerId,
      name: item.name.trim().slice(0, 120),
      amount: (item.amount || '1 stk').trim().slice(0, 60),
      estimatedPriceDkk: Math.max(0, Math.min(10000, Number(item.estimatedPriceDkk) || 0)),
      fromMealPlanId: sanitizeId(item.fromMealPlanId || 'manual'),
    };

    if (!user) {
      setShoppingItems((prev) => [fullItem, ...prev]);
      return;
    }

    const uid = user.uid;
    const path = `users/${uid}/shoppingItems/${sid}`;
    try {
      await setDoc(doc(db, 'users', uid, 'shoppingItems', sid), {
        ...fullItem,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const deleteShoppingItem = async (itemId: string) => {
    if (!user) {
      setShoppingItems((prev) => prev.filter((i) => i.id !== itemId));
      return;
    }
    const uid = user.uid;
    const sid = sanitizeId(itemId);
    const path = `users/${uid}/shoppingItems/${sid}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'shoppingItems', sid));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const clearCheckedShoppingItems = async () => {
    const checked = shoppingItems.filter((i) => i.checked);
    if (checked.length === 0) return;

    if (!user) {
      setShoppingItems((prev) => prev.filter((i) => !i.checked));
      return;
    }

    const uid = user.uid;
    const path = `users/${uid}/shoppingItems`;
    try {
      const batch = writeBatch(db);
      for (const item of checked) {
        batch.delete(doc(db, 'users', uid, 'shoppingItems', sanitizeId(item.id)));
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const saveRecipe = async (recipe: Omit<Recipe, 'ownerId'>) => {
    const rid = sanitizeId(recipe.id || `rec-${Date.now()}`);
    const ownerId = user?.uid || 'local-user';
    const clean: Recipe = {
      ...recipe,
      id: rid,
      ownerId,
      title: recipe.title.trim().slice(0, 140),
      description: recipe.description.trim().slice(0, 500),
      imageUrl: recipe.imageUrl.trim().slice(0, 500),
      prepMinutes: Math.max(1, Math.min(600, Number(recipe.prepMinutes) || 20)),
      servings: Math.max(1, Math.min(24, Number(recipe.servings) || 2)),
      estimatedCostDkk: Math.max(0, Math.min(5000, Number(recipe.estimatedCostDkk) || 50)),
      calories: Math.max(0, Math.min(5000, Number(recipe.calories) || 500)),
      protein: Math.max(0, Math.min(500, Number(recipe.protein) || 25)),
      carbs: Math.max(0, Math.min(500, Number(recipe.carbs) || 50)),
      fat: Math.max(0, Math.min(500, Number(recipe.fat) || 18)),
      fiber: Math.max(0, Math.min(200, Number(recipe.fiber) || 8)),
      ingredients: sanitizeStringArray(recipe.ingredients, 40),
      steps: sanitizeStringArray(recipe.steps, 25),
      tags: sanitizeStringArray(recipe.tags, 15, 50),
      isFavorite: Boolean(recipe.isFavorite),
    };

    if (!user) {
      setRecipes((prev) => [clean, ...prev.filter((r) => r.id !== rid)]);
      return;
    }

    const uid = user.uid;
    const path = `users/${uid}/recipes/${rid}`;
    const exists = recipes.some((r) => r.id === rid);
    try {
      if (exists) {
        const { id: _id, ownerId: _o, ...updatable } = clean;
        await updateDoc(doc(db, 'users', uid, 'recipes', rid), {
          ...updatable,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'users', uid, 'recipes', rid), {
          ...clean,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, exists ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const toggleRecipeFavorite = async (recipeId: string) => {
    const rec = recipes.find((r) => r.id === recipeId);
    if (!rec) return;
    const nextFav = !rec.isFavorite;

    if (!user) {
      setRecipes((prev) => prev.map((r) => (r.id === recipeId ? { ...r, isFavorite: nextFav } : r)));
      return;
    }

    const uid = user.uid;
    const rid = sanitizeId(recipeId);
    const path = `users/${uid}/recipes/${rid}`;
    try {
      await updateDoc(doc(db, 'users', uid, 'recipes', rid), {
        isFavorite: nextFav,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const deleteRecipe = async (recipeId: string) => {
    if (!user) {
      setRecipes((prev) => prev.filter((r) => r.id !== recipeId));
      return;
    }
    const uid = user.uid;
    const rid = sanitizeId(recipeId);
    const path = `users/${uid}/recipes/${rid}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'recipes', rid));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const saveReceipt = async (receipt: Omit<Receipt, 'ownerId'>) => {
    const rcid = sanitizeId(receipt.id || `rcpt-${Date.now()}`);
    const ownerId = user?.uid || 'local-user';
    const clean: Receipt = {
      ...receipt,
      id: rcid,
      ownerId,
      storeName: receipt.storeName.trim().slice(0, 100) || 'Supermarked',
      purchaseDate: isValidIsoDate(receipt.purchaseDate)
        ? receipt.purchaseDate
        : new Date().toISOString().slice(0, 10),
      totalDkk: Math.max(0, Math.min(100000, Math.round((Number(receipt.totalDkk) || 0) * 100) / 100)),
      primaryCategory: receipt.primaryCategory,
      items: (receipt.items || []).slice(0, 60),
      tags: sanitizeStringArray(receipt.tags || [], 15, 50),
      notes: (receipt.notes || '').trim().slice(0, 300),
    };

    // Merge any new custom tags into user profile tag library
    const newTags = clean.tags.filter((t) => !profile.customTags.includes(t));
    if (newTags.length > 0) {
      updateProfile({ customTags: [...profile.customTags, ...newTags].slice(0, 30) }).catch(() => {});
    }

    if (!user) {
      setReceipts((prev) => [clean, ...prev.filter((r) => r.id !== rcid)].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate)));
      return;
    }

    const uid = user.uid;
    const path = `users/${uid}/receipts/${rcid}`;
    const exists = receipts.some((r) => r.id === rcid);
    try {
      if (exists) {
        const { id: _id, ownerId: _o, ...updatable } = clean;
        await updateDoc(doc(db, 'users', uid, 'receipts', rcid), {
          ...updatable,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'users', uid, 'receipts', rcid), {
          ...clean,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, exists ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const deleteReceipt = async (receiptId: string) => {
    if (!user) {
      setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
      return;
    }
    const uid = user.uid;
    const rcid = sanitizeId(receiptId);
    const path = `users/${uid}/receipts/${rcid}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'receipts', rcid));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  const createCloudBackup = async (label: string) => {
    const bid = sanitizeId(`bkp-${Date.now()}`);
    const ownerId = user?.uid || 'local-user';
    const deviceName = /android/i.test(navigator.userAgent)
      ? 'Android-enhed'
      : /iphone|ipad/i.test(navigator.userAgent)
      ? 'iOS-enhed'
      : 'Desktop-browser';

    const backupObj: CloudBackup = {
      id: bid,
      ownerId,
      label: (label.trim() || `Sikkerhedskopi ${new Date().toLocaleDateString('da-DK')}`).slice(0, 100),
      deviceName,
      createdAtIso: new Date().toISOString(),
      counts: {
        mealPlans: mealPlans.length,
        recipes: recipes.length,
        receipts: receipts.length,
        shoppingItems: shoppingItems.length,
      },
      snapshotData: {
        profile,
        mealPlans: mealPlans.slice(0, 5),
        recipes: recipes.slice(0, 30),
        receipts: receipts.slice(0, 40),
        shoppingItems: shoppingItems.slice(0, 60),
      },
    };

    if (!user) {
      setBackups((prev) => [backupObj, ...prev]);
      return;
    }

    const uid = user.uid;
    const path = `users/${uid}/backups/${bid}`;
    try {
      await setDoc(doc(db, 'users', uid, 'backups', bid), {
        id: bid,
        ownerId: uid,
        label: backupObj.label,
        deviceName: backupObj.deviceName,
        counts: backupObj.counts,
        snapshotData: backupObj.snapshotData,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  const restoreCloudBackup = async (backup: CloudBackup) => {
    const snap = backup.snapshotData;
    if (!snap) return;

    if (!user) {
      setProfile(snap.profile || DEFAULT_PROFILE);
      setMealPlans(snap.mealPlans || []);
      setRecipes(snap.recipes || []);
      setReceipts(snap.receipts || []);
      setShoppingItems(snap.shoppingItems || []);
      return;
    }

    const uid = user.uid;
    try {
      if (snap.profile) {
        await updateProfile(snap.profile);
      }
      for (const plan of snap.mealPlans || []) {
        await saveMealPlan(plan, false);
      }
      for (const rec of snap.recipes || []) {
        await saveRecipe(rec);
      }
      for (const rcpt of snap.receipts || []) {
        await saveReceipt(rcpt);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
    }
  };

  const deleteCloudBackup = async (backupId: string) => {
    if (!user) {
      setBackups((prev) => prev.filter((b) => b.id !== backupId));
      return;
    }
    const uid = user.uid;
    const bid = sanitizeId(backupId);
    const path = `users/${uid}/backups/${bid}`;
    try {
      await deleteDoc(doc(db, 'users', uid, 'backups', bid));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  return (
    <AppDataContext.Provider
      value={{
        user,
        authReady,
        cloudSynced,
        syncError,
        profile,
        mealPlans,
        activeMealPlan,
        activePlanId,
        setActivePlanId,
        shoppingItems,
        recipes,
        receipts,
        backups,
        currentMonthSpendDkk,
        budgetUsagePercent,
        isOverBudget,
        isNearBudget,
        signInWithGoogle,
        signOutUser,
        updateProfile,
        saveMealPlan,
        updateMealPlan,
        toggleShoppingItem,
        addShoppingItem,
        deleteShoppingItem,
        clearCheckedShoppingItems,
        rebuildShoppingListFromPlan,
        saveRecipe,
        toggleRecipeFavorite,
        deleteRecipe,
        saveReceipt,
        deleteReceipt,
        createCloudBackup,
        restoreCloudBackup,
        deleteCloudBackup,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataProvider');
  return ctx;
}
