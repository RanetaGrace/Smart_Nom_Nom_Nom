import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { InventoryBatch } from '../types';
import { formatQuantity } from '../utils/units';

export function Inventory() {
  const batches = useLiveQuery(() => db.inventoryBatches.toArray(), []);
  const ingredients = useLiveQuery(() => db.ingredients.toArray(), []);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!batches || !ingredients) {
    return <p className="text-slate-500">Loading...</p>;
  }

  const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));
  const today = new Date().toISOString().slice(0, 10);

  // Group formal ingredients
  const byIngredient = new Map<string, InventoryBatch[]>();
  const freeTextBatches: InventoryBatch[] = [];

  for (const batch of batches) {
    if (!batch.ingredientId) {
      freeTextBatches.push(batch);
    } else {
      const list = byIngredient.get(batch.ingredientId) ?? [];
      list.push(batch);
      byIngredient.set(batch.ingredientId, list);
    }
  }

  const grouped = [...byIngredient.entries()]
    .map(([ingId, bats]) => ({
      key: ingId,
      name: ingredientMap.get(ingId)?.name ?? 'Unknown',
      preferredUnit: ingredientMap.get(ingId)?.preferredUnit,
      batches: bats,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Free-text as their own "group"
  if (freeTextBatches.length > 0) {
    // group free-text by name
    const ftMap = new Map<string, InventoryBatch[]>();
    for (const b of freeTextBatches) {
      const name = b.freeTextName || 'Leftovers / Other';
      const list = ftMap.get(name) ?? [];
      list.push(b);
      ftMap.set(name, list);
    }
    for (const [name, bats] of ftMap) {
      grouped.push({ key: `ft-${name}`, name, preferredUnit: undefined, batches: bats });
    }
    grouped.sort((a, b) => a.name.localeCompare(b.name));
  }

  let expiredCount = 0;
  for (const batch of batches) {
    if (batch.expiration.type === 'date' && batch.expiration.date && batch.expiration.date < today) {
      expiredCount++;
    }
  }

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function totalFor(bats: InventoryBatch[], preferredUnit?: string) {
    if (bats.length === 0) return null;
    const unit = preferredUnit || bats[0].unit;
    const sameUnit = bats.every((b) => b.unit === unit);
    if (sameUnit) {
      const total = bats.reduce((sum, b) => sum + b.quantity, 0);
      return formatQuantity(total, unit);
    }
    return `${bats.length} batch${bats.length !== 1 ? 'es' : ''}`;
  }

  async function deleteBatch(batchId: string) {
    if (!confirm('Delete this batch from inventory?')) return;
    await db.inventoryBatches.delete(batchId);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Inventory</h2>
        <Link
          to="/inventory/new"
          className="px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg"
        >
          + Add
        </Link>
      </div>

      {expiredCount > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
          {expiredCount} batch{expiredCount !== 1 ? 'es' : ''} expired — still available, your call.
        </div>
      )}

      {grouped.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>No inventory yet.</p>
          <Link to="/inventory/new" className="mt-2 inline-block text-emerald-600">
            Add your first item
          </Link>
        </div>
      )}

      <ul className="space-y-2">
        {grouped.map(({ key, name, preferredUnit, batches: bats }) => {
          const isOpen = expanded.has(key);
          const hasExpired = bats.some(
            (b) => b.expiration.type === 'date' && b.expiration.date && b.expiration.date < today
          );

          return (
            <li key={key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(key)}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
              >
                <div>
                  <div className="font-medium text-slate-800 flex items-center gap-2">
                    {name}
                    {hasExpired && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                        expired
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500">
                    {totalFor(bats, preferredUnit)} · {bats.length} batch{bats.length !== 1 ? 'es' : ''}
                  </div>
                </div>
                <span className="text-slate-400 text-sm">{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 px-3 py-2 space-y-2 bg-slate-50">
                  {bats.map((batch) => (
                    <BatchRow key={batch.id} batch={batch} today={today} onDelete={deleteBatch} />
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

function BatchRow({
  batch,
  today,
  onDelete,
}: {
  batch: InventoryBatch;
  today: string;
  onDelete: (id: string) => void;
}) {
  const isExpired =
    batch.expiration.type === 'date' &&
    batch.expiration.date &&
    batch.expiration.date < today;

  let expLabel = '';
  if (batch.expiration.type === 'date' && batch.expiration.date) {
    expLabel = isExpired ? `Expired ${batch.expiration.date}` : `Expires ${batch.expiration.date}`;
  } else if (batch.expiration.type === 'unknown') {
    expLabel = 'Expiration unknown';
  } else {
    expLabel = 'No expiration';
  }

  return (
    <div
      className={`flex items-start justify-between gap-2 p-3 rounded-lg bg-white border ${
        isExpired ? 'border-amber-200' : 'border-slate-200'
      }`}
    >
      <div className="min-w-0">
        <div className="font-medium text-slate-800">
          {formatQuantity(batch.quantity, batch.unit)}
        </div>
        <div className="text-sm text-slate-500">
          {batch.location} · {expLabel}
        </div>
        {batch.notes && <div className="text-xs text-slate-400 mt-0.5">{batch.notes}</div>}
      </div>
      <div className="flex gap-2 shrink-0">
        <Link to={`/inventory/batch/${batch.id}`} className="text-sm text-emerald-600">
          Edit
        </Link>
        <button
          type="button"
          onClick={() => onDelete(batch.id)}
          className="text-sm text-red-500"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
