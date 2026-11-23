# Meal Planner — ALPHA 1.0

Personal grocery & meal-planning app focused on the connected workflow:

**Recipes → Meal Plan → Grocery (minus Inventory) → Purchase → Inventory batches**

## What's included so far

- Full TypeScript data model (Ingredients, Recipes, PlannedMeals, InventoryBatches, ShoppingTrips)
- Dexie (IndexedDB) storage layer with sequential IDs and export/import
- Unit conversion helpers
- Grocery calculation engine (exact match + different-form detection via classification)
- Mobile-first layout with bottom navigation
- Working Recipes list (search + Someday filter)
- Skeleton screens for Inventory, Grocery, Meal Plan

## Getting started

```bash
cd meal-planner-alpha
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

## Next pieces to build

1. Recipe create / edit form (with inline ingredient creation)
2. Inventory list + batch management
3. Meal Plan: add recipe or free-text meal + per-instance ingredient editing
4. Live Grocery list with different-form confirmation prompts
5. Purchase flow → create Inventory batches + complete Shopping Trip with total cost
6. Export / Import UI

## Design decisions locked for ALPHA 1.0

- Sequential IDs (`ING-001`, `REC-001`, etc.)
- Classification fields kept for future nutrition/budget and for different-form matching
- Different-form matches always ask the user (shown on Grocery list)
- Only trip total cost recorded (no per-item pricing yet)
- Expired items flagged but never auto-removed
- Local-only storage with clean abstraction for later backends
