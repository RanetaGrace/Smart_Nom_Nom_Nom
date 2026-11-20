import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { InventoryBatch, Ingredient } from '../types';
import { formatQuantity } from '../utils/units';

export function Inventory() {
  const batches = useLiveQuery(() => db.inventoryBatches.toArray(), []);
  const ingredients = useLiveQuery(() => db.ingredients.toArray(), []);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!batches || !ingredients) {
    return <p className="text-slate-500">Loading...</p>;
  }

  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));

  // Group batches by ingredient
  const byIngredient = new Map<string, InventoryBatch[]>();
  for (const batch of batches) {
    const list = byIngredient.get(batch.ingredientId) ?? [];
    list.push(batch);
    byIngredient.set(batch.ingredientId, list);
  }

  // Sort ingredients by name
  const grouped = [...byIngredient.entries()]
    .map(([ingId, bats]) => ({
      ingredient: ingredientMap.get(ingId),
      batches: bats,
    }))
    .filter((g) => g.ingredient)
    .sort((a, b) => a.ingredient!.name.localeCompare(b.ingredient!.name));

  // Count expired
  const today = new Date().toISOString().slice(0, 10);
  let expiredCount = 0;
  for (const batch of batches) {
    if (batch.expiration.type === 'date' && batch.expiration.date && batch.expiration.date < today) {
      expiredCount++;
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function totalFor(bats: InventoryBatch[], preferredUnit?: string) {
    // Simple sum when units match; otherwise show first unit
    if (bats.length === 0) return null;
    const unit = preferredUnit || bats[0].unit;
    const sameUnit = bats.every((b) => b.unit === unit);
    if (sameUnit) {
      const total = bats.reduce((sum, b) => sum + b.quantity, 0);
      return formatQuantity(total, unit);
    }
    return `${bats.length} batch${bats.length !== 1 ? 'es' : ''}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-slate-800">Inventory</h2>
        <Link
          to="/inventory/new"
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition"
        >
          + Add Batch
        </Link>
      </div>

      {expiredCount > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
          {expiredCount} batch{expiredCount !== 1 ? 'es' : ''} expired — still available, flagged for your judgment.
        </div>
      )}

      {grouped.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>No inventory yet.</p>
          <Link to="/inventory/new" className="mt-2 inline-block text-emerald-600 hover:underline">
            Add your first batch
          </Link>
        </div>
      )}

      <ul className="space-y-2">
        {grouped.map(({ ingredient, batches: bats }) => {
          const isOpen = expanded.has(ingredient!.id);
          const hasExpired = bats.some(
            (b) => b.expiration.type === 'date' && b.expiration.date && b.expiration.date < today
          );

          return (
            <li key={ingredient!.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(ingredient!.id)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition"
              >
                <div>
                  <div className="font-medium text-slate-800 flex items-center gap-2">
                    {ingredient!.name}
                    {hasExpired && (
                      <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                        expired
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500">
                    {totalFor(bats, ingredient!.preferredUnit)} · {bats.length} batch
                    {bats.length !== 1 ? 'es' : ''}
                  </div>
                </div>
                <span className="text-slate-400 text-sm">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 px-4 py-3 space-y-2 bg-slate-50">
                  {bats.map((batch) => (
                    <BatchRow key={batch.id} batch={batch} today={today} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BatchRow({ batch, today }: { batch: InventoryBatch; today: string }) {
  const isExpired =
    batch.expiration.type === 'date' &&
    batch.expiration.date &&
    batch.expiration.date < today;

  let expLabel = '';
  if (batch.expiration.type === 'date' && batch.expiration.date) {
    expLabel = isExpired
      ? `Expired ${batch.expiration.date}`
      : `Expires ${batch.expiration.date}`;
  } else if (batch.expiration.type === 'unknown') {
    expLabel = 'Expiration unknown';
  } else {
    expLabel = 'No expiration';
  }

  return (
    <div
      className={`flex items-start justify-between gap-3 p-3 rounded-lg bg-white border ${
        isExpired ? 'border-amber-200' : 'border-slate-200'
      }`}
    >
      <div>
        <div className="font-medium text-slate-800">
          {formatQuantity(batch.quantity, batch.unit)}
        </div>
        <div className="text-sm text-slate-500">
          {batch.location} · {expLabel}
        </div>
        {batch.notes && <div className="text-xs text-slate-400 mt-0.5">{batch.notes}</div>}
      </div>
      <Link
        to={`/inventory/batch/${batch.id}`}
        className="text-sm text-emerald-600 hover:underline shrink-0"
      >
        Edit
      </Link>
    </div>
  );
}
