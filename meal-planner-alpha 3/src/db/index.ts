import Dexie, { type Table } from 'dexie';
import type {
  Ingredient,
  Recipe,
  PlannedMeal,
  InventoryBatch,
  ShoppingTrip,
  GroceryFormDecision,
  IdCounter,
} from '../types';

export class MealPlannerDB extends Dexie {
  ingredients!: Table<Ingredient, string>;
  recipes!: Table<Recipe, string>;
  plannedMeals!: Table<PlannedMeal, string>;
  inventoryBatches!: Table<InventoryBatch, string>;
  shoppingTrips!: Table<ShoppingTrip, string>;
  groceryFormDecisions!: Table<GroceryFormDecision, string>;
  idCounters!: Table<IdCounter, string>;

  constructor() {
    super('MealPlannerAlpha');

    this.version(1).stores({
      ingredients: 'id, name, type, family, subcategory, active, createdAt',
      recipes: 'id, name, primaryIngredientId, isSomeday, createdAt',
      plannedMeals: 'id, date, recipeId, createdAt',
      inventoryBatches: 'id, ingredientId, location, tripId, createdAt',
      shoppingTrips: 'id, status, createdAt, completedAt',
      groceryFormDecisions: 'id, plannedMealId, requiredIngredientId, decision',
      idCounters: 'entity',
    });
  }
}

export const db = new MealPlannerDB();

// ----- Sequential ID generation -----
export async function nextId(entity: IdCounter['entity']): Promise<string> {
  const prefixMap: Record<IdCounter['entity'], string> = {
    ingredient: 'ING',
    recipe: 'REC',
    batch: 'BAT',
    meal: 'MEAL',
    trip: 'TRIP',
  };

  return db.transaction('rw', db.idCounters, async () => {
    let counter = await db.idCounters.get(entity);
    if (!counter) {
      counter = { entity, lastNumber: 0 };
    }
    counter.lastNumber += 1;
    await db.idCounters.put(counter);
    const num = String(counter.lastNumber).padStart(3, '0');
    return `${prefixMap[entity]}-${num}`;
  });
}

// ----- Export / Import -----
export async function exportAllData() {
  const [
    ingredients,
    recipes,
    plannedMeals,
    inventoryBatches,
    shoppingTrips,
    groceryFormDecisions,
    idCounters,
  ] = await Promise.all([
    db.ingredients.toArray(),
    db.recipes.toArray(),
    db.plannedMeals.toArray(),
    db.inventoryBatches.toArray(),
    db.shoppingTrips.toArray(),
    db.groceryFormDecisions.toArray(),
    db.idCounters.toArray(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      ingredients,
      recipes,
      plannedMeals,
      inventoryBatches,
      shoppingTrips,
      groceryFormDecisions,
      idCounters,
    },
  };
}

export async function importAllData(payload: Awaited<ReturnType<typeof exportAllData>>) {
  if (!payload?.data) throw new Error('Invalid import file');

  await db.transaction(
    'rw',
    [
      db.ingredients,
      db.recipes,
      db.plannedMeals,
      db.inventoryBatches,
      db.shoppingTrips,
      db.groceryFormDecisions,
      db.idCounters,
    ],
    async () => {
      await Promise.all([
        db.ingredients.clear(),
        db.recipes.clear(),
        db.plannedMeals.clear(),
        db.inventoryBatches.clear(),
        db.shoppingTrips.clear(),
        db.groceryFormDecisions.clear(),
        db.idCounters.clear(),
      ]);

      const d = payload.data;
      if (d.ingredients?.length) await db.ingredients.bulkPut(d.ingredients);
      if (d.recipes?.length) await db.recipes.bulkPut(d.recipes);
      if (d.plannedMeals?.length) await db.plannedMeals.bulkPut(d.plannedMeals);
      if (d.inventoryBatches?.length) await db.inventoryBatches.bulkPut(d.inventoryBatches);
      if (d.shoppingTrips?.length) await db.shoppingTrips.bulkPut(d.shoppingTrips);
      if (d.groceryFormDecisions?.length) await db.groceryFormDecisions.bulkPut(d.groceryFormDecisions);
      if (d.idCounters?.length) await db.idCounters.bulkPut(d.idCounters);
    }
  );
}
