import { db } from '../db';
import type { InventoryBatch } from '../types';
import { convertQuantity } from './units';

export interface GroceryRequirement {
  ingredientId: string;
  name: string;
  totalRequired: number;
  unit: string;
  available: number;
  availableUnit: string;
  remaining: number;
  remainingUnit: string;
  exactMatchBatches: InventoryBatch[];
  differentFormBatches: InventoryBatch[];
  sources: { mealId: string; mealTitle: string; qty: number; unit: string }[];
}

/**
 * Calculate grocery needs from all planned meals vs current inventory.
 * This is the core of the connected system.
 */
export async function calculateGroceryNeeds(
  fromDate?: string,
  toDate?: string
): Promise<GroceryRequirement[]> {
  const allMeals = await db.plannedMeals.orderBy('date').toArray();
  const meals = allMeals.filter((m) => {
    if (fromDate && m.date < fromDate) return false;
    if (toDate && m.date > toDate) return false;
    return true;
  });

  if (meals.length === 0) return [];

  // Aggregate required ingredients
  const requiredMap = new Map<
    string,
    {
      ingredientId: string;
      totalQty: number;
      unit: string;
      sources: { mealId: string; mealTitle: string; qty: number; unit: string }[];
    }
  >();

  for (const meal of meals) {
    for (const ing of meal.ingredients) {
      const key = `${ing.ingredientId}::${ing.unit}`;
      const existing = requiredMap.get(key);
      if (existing) {
        existing.totalQty += ing.quantity;
        existing.sources.push({
          mealId: meal.id,
          mealTitle: meal.title,
          qty: ing.quantity,
          unit: ing.unit,
        });
      } else {
        requiredMap.set(key, {
          ingredientId: ing.ingredientId,
          totalQty: ing.quantity,
          unit: ing.unit,
          sources: [
            {
              mealId: meal.id,
              mealTitle: meal.title,
              qty: ing.quantity,
              unit: ing.unit,
            },
          ],
        });
      }
    }
  }

  const ingredientIds = [...new Set([...requiredMap.values()].map((r) => r.ingredientId))];
  const ingredients = await db.ingredients.bulkGet(ingredientIds);
  const ingredientMap = new Map(
    ingredients.filter(Boolean).map((i) => [i!.id, i!])
  );

  const allBatches = await db.inventoryBatches
    .where('ingredientId')
    .anyOf(ingredientIds)
    .toArray();

  // Related ingredients for different-form matching
  const allIngredients = await db.ingredients.toArray();
  const relatedIngredientIds = new Set<string>();
  for (const reqId of ingredientIds) {
    const reqIng = ingredientMap.get(reqId);
    if (!reqIng) continue;
    for (const other of allIngredients) {
      if (
        other.id !== reqId &&
        other.type === reqIng.type &&
        other.family === reqIng.family
      ) {
        relatedIngredientIds.add(other.id);
      }
    }
  }

  const relatedBatches =
    relatedIngredientIds.size > 0
      ? await db.inventoryBatches.where('ingredientId').anyOf([...relatedIngredientIds]).toArray()
      : [];

  const results: GroceryRequirement[] = [];

  for (const req of requiredMap.values()) {
    const ingredient = ingredientMap.get(req.ingredientId);
    if (!ingredient) continue;

    const exactBatches = allBatches.filter((b) => b.ingredientId === req.ingredientId);
    const differentBatches = relatedBatches;

    let totalAvailable = 0;
    let availableUnit = req.unit;

    for (const batch of exactBatches) {
      const availInReq = convertQuantity(batch.quantity, batch.unit, req.unit);
      if (availInReq !== null) {
        totalAvailable += availInReq;
      } else {
        totalAvailable += batch.quantity;
        availableUnit = batch.unit;
      }
    }

    const remaining = Math.max(0, req.totalQty - totalAvailable);

    results.push({
      ingredientId: req.ingredientId,
      name: ingredient.name,
      totalRequired: req.totalQty,
      unit: req.unit,
      available: totalAvailable,
      availableUnit,
      remaining,
      remainingUnit: req.unit,
      exactMatchBatches: exactBatches,
      differentFormBatches: differentBatches,
      sources: req.sources,
    });
  }

  return results.filter(
    (r) => r.remaining > 0.001 || r.differentFormBatches.length > 0
  );
}
