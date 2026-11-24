// ============================================================
// ALPHA 1.0 — Core Types
// ============================================================

export type ExpirationType = 'date' | 'unknown' | 'na';

export interface Expiration {
  type: ExpirationType;
  date?: string; // YYYY-MM-DD when type === 'date'
}

export type TripStatus = 'active' | 'completed';

// ----- Ingredient -----
export interface Ingredient {
  id: string; // ING-001
  name: string;
  // Essential classification (used for "different form" matching)
  type: string;       // e.g. "Meat and Poultry", "Vegetables"
  family: string;     // e.g. "Chicken", "Onion"
  subcategory: string; // e.g. "Breast", "Yellow"
  // Optional fields
  preferredUnit?: string;
  preferredForm?: string;
  storageType?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ----- Recipe -----
export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: string;
  note?: string; // e.g. "for sautéing"
}

export interface Recipe {
  id: string; // REC-001
  name: string;
  primaryIngredientId: string;
  servings: number;
  ingredients: RecipeIngredient[];
  // Optional
  prepTime?: number; // minutes
  cookTime?: number;
  totalTime?: number;
  rating?: number | null; // 1-5 or null
  tags: string[];
  instructions?: string;
  image?: string;
  isSomeday: boolean;
  createdAt: string;
  updatedAt: string;
}

// ----- Planned Meal (Meal Plan entry) -----
export interface PlannedIngredient {
  ingredientId: string;
  quantity: number;
  unit: string;
  note?: string;
}

export type MealType = 'BF' | 'LN' | 'DN' | 'DS' | 'SN' | '';

export type MealStatus = 'planned' | 'eaten' | 'skipped';

export interface PlannedMeal {
  id: string; // MEAL-001
  date: string; // YYYY-MM-DD
  recipeId?: string | null; // null = free-text meal
  title: string;
  servings: number;
  ingredients: PlannedIngredient[]; // can fully override recipe
  mealType?: MealType; // BF, LN, DN, DS, SN
  notes?: string;
  status?: MealStatus; // planned | eaten | skipped
  createdAt: string;
  updatedAt: string;
}

export const MEAL_TYPE_LABELS: Record<string, string> = {
  BF: 'Breakfast',
  LN: 'Lunch',
  DN: 'Dinner',
  DS: 'Dessert',
  SN: 'Snack',
};

// ----- Inventory Batch -----
export interface InventoryBatch {
  id: string; // BAT-001
  ingredientId: string;
  quantity: number;
  unit: string;
  location: string; // Refrigerator, Freezer, Pantry, etc.
  expiration: Expiration;
  tripId?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ----- Shopping Trip -----
export interface PurchasedItemSnapshot {
  ingredientId: string;
  name: string; // snapshot in case ingredient is later renamed/deleted
  quantity: number;
  unit: string;
}

export interface ShoppingTrip {
  id: string; // TRIP-001
  status: TripStatus;
  totalCost?: number | null;
  purchasedItems: PurchasedItemSnapshot[];
  notes?: string;
  createdAt: string;
  completedAt?: string | null;
}

// ----- Grocery decision (for different-form prompts) -----
export interface GroceryFormDecision {
  id: string;
  plannedMealId: string;
  requiredIngredientId: string;
  candidateBatchId: string; // the different-form batch
  decision: 'accept' | 'decline' | 'pending';
  createdAt: string;
}

// ----- ID counters (for sequential IDs) -----
export interface IdCounter {
  entity: 'ingredient' | 'recipe' | 'batch' | 'meal' | 'trip';
  lastNumber: number;
}

// ----- Units -----
export const COMMON_UNITS = [
  'g', 'kg', 'oz', 'lb',
  'ml', 'L', 'tsp', 'tbsp', 'cup',
  'piece', 'each', 'clove', 'slice',
  'can', 'bottle', 'package',
] as const;

export type Unit = typeof COMMON_UNITS[number] | string;

// Simple conversion factors to a base unit (grams for weight, ml for volume)
// Only used when units are compatible
export const UNIT_TO_BASE: Record<string, { base: 'g' | 'ml' | 'piece'; factor: number }> = {
  g: { base: 'g', factor: 1 },
  kg: { base: 'g', factor: 1000 },
  oz: { base: 'g', factor: 28.3495 },
  lb: { base: 'g', factor: 453.592 },
  ml: { base: 'ml', factor: 1 },
  L: { base: 'ml', factor: 1000 },
  tsp: { base: 'ml', factor: 4.92892 },
  tbsp: { base: 'ml', factor: 14.7868 },
  cup: { base: 'ml', factor: 236.588 },
  piece: { base: 'piece', factor: 1 },
  each: { base: 'piece', factor: 1 },
  clove: { base: 'piece', factor: 1 },
  slice: { base: 'piece', factor: 1 },
  can: { base: 'piece', factor: 1 },
  bottle: { base: 'piece', factor: 1 },
  package: { base: 'piece', factor: 1 },
};

// Inventory locations
export const STORAGE_LOCATIONS = [
  'Refrigerator',
  'Freezer',
  'Pantry',
  'Counter',
  'Other',
] as const;

// Ingredient type categories (from original design)
export const INGREDIENT_TYPES = [
  'Meat and Poultry',
  'Seafood',
  'Vegetables',
  'Fruits',
  'Dairy and Eggs',
  'Grains and Cereals',
  'Beans and Legumes',
  'Nuts and Seeds',
  'Oils and Fats',
  'Condiments and Sauces',
  'Herbs and Spices',
  'Baking Ingredients',
  'Beverages',
  'Prepared Foods',
  'Other',
] as const;
