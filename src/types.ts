export type DietType =
  | 'almindelig'
  | 'vegetarisk'
  | 'vegansk'
  | 'pesketarisk'
  | 'lowcarb'
  | 'glutenfri';

export type GroceryCategory =
  | 'Frugt & Grønt'
  | 'Mejeri & Æg'
  | 'Kød & Fisk'
  | 'Plantebaseret'
  | 'Kolonial'
  | 'Brød & Bageri'
  | 'Drikkevarer'
  | 'Frost'
  | 'Husholdning'
  | 'Snacks & Sødt';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface MealTimes {
  breakfast: string; // HH:MM
  lunch: string;
  dinner: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  dietType: DietType;
  dailyCalories: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  householdSize: number;
  monthlyBudgetDkk: number;
  weeklyMealBudgetDkk: number;
  allergies: string[];
  customTags: string[];
  mealTimes: MealTimes;
  budgetAlertThreshold: number; // percentage e.g. 85
  notificationsEnabled: boolean;
}

export interface MealIngredient {
  name: string;
  amount: string;
  category: GroceryCategory;
  estimatedPriceDkk: number;
}

export interface PlannedMeal {
  id: string;
  slot: MealSlot;
  title: string;
  description: string;
  prepMinutes: number;
  estimatedCostDkk: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  micronutrients: string; // e.g., "Rig på jern, C-vitamin og omega-3"
  ingredients: MealIngredient[];
  steps: string[];
  imageUrl?: string;
  eaten?: boolean;
}

export interface MealPlanDay {
  dayIndex: number; // 0 = Mandag ... 6 = Søndag
  dayName: string;
  dateIso: string; // YYYY-MM-DD
  meals: PlannedMeal[];
}

export interface MealPlan {
  id: string;
  ownerId: string;
  weekLabel: string;
  startDate: string; // YYYY-MM-DD
  dietType: DietType;
  targetCalories: number;
  householdSize: number;
  estimatedWeeklyCostDkk: number;
  days: MealPlanDay[];
  mealPrepTips: string[];
  createdAtIso?: string;
}

export interface ShoppingItem {
  id: string;
  ownerId: string;
  name: string;
  amount: string;
  category: GroceryCategory;
  estimatedPriceDkk: number;
  checked: boolean;
  fromMealPlanId: string;
}

export interface Recipe {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  imageUrl: string;
  dietType: DietType;
  mealType: MealSlot;
  prepMinutes: number;
  servings: number;
  estimatedCostDkk: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  ingredients: string[];
  steps: string[];
  tags: string[];
  isFavorite: boolean;
}

export interface ReceiptLineItem {
  name: string;
  quantity: string;
  priceDkk: number;
  category: GroceryCategory;
}

export interface Receipt {
  id: string;
  ownerId: string;
  storeName: string;
  purchaseDate: string; // YYYY-MM-DD
  totalDkk: number;
  primaryCategory: GroceryCategory;
  items: ReceiptLineItem[];
  tags: string[];
  notes: string;
}

export interface CloudBackup {
  id: string;
  ownerId: string;
  label: string;
  deviceName: string;
  createdAtIso: string;
  counts: {
    mealPlans: number;
    recipes: number;
    receipts: number;
    shoppingItems: number;
  };
  snapshotData: {
    profile: UserProfile;
    mealPlans: MealPlan[];
    recipes: Recipe[];
    receipts: Receipt[];
    shoppingItems: ShoppingItem[];
  };
}

export type AppSection =
  | 'madplan'
  | 'indkoeb'
  | 'opskrifter'
  | 'kvitteringer'
  | 'budget'
  | 'indstillinger';

export const GROCERY_CATEGORIES: GroceryCategory[] = [
  'Frugt & Grønt',
  'Mejeri & Æg',
  'Kød & Fisk',
  'Plantebaseret',
  'Kolonial',
  'Brød & Bageri',
  'Drikkevarer',
  'Frost',
  'Husholdning',
  'Snacks & Sødt',
];

export const DIET_LABELS: Record<DietType, string> = {
  almindelig: 'Almindelig kost',
  vegetarisk: 'Vegetarisk',
  vegansk: 'Vegansk',
  pesketarisk: 'Pesketarisk',
  lowcarb: 'Low-carb / Keto',
  glutenfri: 'Glutenfri',
};

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Morgenmad',
  lunch: 'Frokost',
  dinner: 'Aftensmad',
};
