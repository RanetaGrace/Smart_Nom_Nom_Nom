import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, nextId } from '../db';
import { calculateGroceryNeeds, type GroceryRequirement } from '../utils/grocery';
import { formatQuantity } from '../utils/units';
import type { ShoppingTrip, PurchasedItemSnapshot } from '../types';
import { COMMON_UNITS } from '../types';

type PurchasedItem = {
  ingredientId: string;
  name: string;
  quantity: number;
  unit: string;
  isManual?: boolean;
};

export function Grocery() {
  const [requirements, setRequirements] = useState<GroceryRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchased, setPurchased] = useState<PurchasedItem[]>([]);
  const [formDecisions, setFormDecisions] = useState<Record<string, 'accept' | 'decline'>>({});
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [tripTotal, setTripTotal] = useState('');
  const [message, setMessage] = useState('');

  // Manual add
  const [showManual, setShowManual] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualQty, setManualQty] = useState('1');
  const [manualUnit, setManualUnit] = useState('piece');

  const trips = useLiveQuery(() => db.shoppingTrips.toArray(), []);
  const decisions = useLiveQuery(() => db.groceryFormDecisions.toArray(), []);
  const meals = useLiveQuery(() => db.plannedMeals.toArray(), []);
  const batches = useLiveQuery(() => db.inventoryBatches.toArray(), []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const result = await calculateGroceryNeeds();
        if (!cancelled) setRequirements(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [meals, batches, decisions]);

  useEffect(() => {
    if (!decisions) return;
    const map: Record<string, 'accept' | 'decline'> = {};
    for (const d of decisions) {
      if (d.decision === 'accept' || d.decision === 'decline') {
        map[d.requiredIngredientId] = d.decision;
      }
    }
    setFormDecisions(map);
  }, [decisions]);

  async function handleFormDecision(req: GroceryRequirement, decision: 'accept' | 'decline') {
    const decisionId = crypto.randomUUID();
    await db.groceryFormDecisions.put({
      id: decisionId,
      plannedMealId: req.sources[0]?.mealId ?? '',
      requiredIngredientId: req.ingredientId,
      candidateBatchId: req.differentFormBatches[0]?.id ?? '',
      decision,
      createdAt: new Date().toISOString(),
    });
    setFormDecisions((prev) => ({ ...prev, [req.ingredientId]: decision }));
  }

  function markPurchased(req: GroceryRequirement) {
    const qty = req.remaining > 0 ? req.remaining : req.totalRequired;
    setPurchased((prev) => [
      ...prev,
      {
        ingredientId: req.ingredientId,
        name: req.name,
        quantity: qty,
        unit: req.remainingUnit || req.unit,
      },
    ]);
  }

  function updatePurchasedQty(ingredientId: string, quantity: number) {
    setPurchased((prev) =>
      prev.map((p) => (p.ingredientId === ingredientId ? { ...p, quantity } : p))
    );
  }

  function unmarkPurchased(ingredientId: string) {
    setPurchased((prev) => prev.filter((p) => p.ingredientId !== ingredientId));
  }

  function addManualItem() {
    if (!manualName.trim()) return;
    const id = `manual-${crypto.randomUUID()}`;
    setPurchased((prev) => [
      ...prev,
      {
        ingredientId: id,
        name: manualName.trim(),
        quantity: parseFloat(manualQty) || 1,
        unit: manualUnit,
        isManual: true,
      },
    ]);
    // Also show in to-buy style by adding to purchased directly as already "selected"
    setManualName('');
    setManualQty('1');
    setShowManual(false);
  }

  async function ensureActiveTrip() {
    if (activeTripId) return activeTripId;
    const id = await nextId('trip');
    const trip: ShoppingTrip = {
      id,
      status: 'active',
      purchasedItems: [],
      createdAt: new Date().toISOString(),
    };
    await db.shoppingTrips.add(trip);
    setActiveTripId(id);
    return id;
  }

  async function completePurchase() {
    if (purchased.length === 0) {
      setMessage('Nothing marked as purchased.');
      return;
    }

    const tripId = await ensureActiveTrip();
    const now = new Date().toISOString();

    for (const item of purchased) {
      if (item.isManual) {
        // Free-text inventory batch
        const batchId = await nextId('batch');
        await db.inventoryBatches.add({
          id: batchId,
          ingredientId: null,
          freeTextName: item.name,
          quantity: item.quantity,
          unit: item.unit,
          location: 'Refrigerator',
          expiration: { type: 'unknown' },
          tripId,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        const batchId = await nextId('batch');
        await db.inventoryBatches.add({
          id: batchId,
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unit: item.unit,
          location: 'Refrigerator',
          expiration: { type: 'unknown' },
          tripId,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const snapshots: PurchasedItemSnapshot[] = purchased.map((p) => ({
      ingredientId: p.ingredientId,
      name: p.name,
      quantity: p.quantity,
      unit: p.unit,
    }));

    const total = tripTotal ? parseFloat(tripTotal) : null;
    await db.shoppingTrips.update(tripId, {
      purchasedItems: snapshots,
      totalCost: total,
      status: total != null ? 'completed' : 'active',
      completedAt: total != null ? now : null,
    });

    setPurchased([]);
    setTripTotal('');
    setActiveTripId(null);
    setMessage(
      total != null
        ? `Recorded. ${snapshots.length} item(s) added to Inventory. Trip completed.`
        : `Recorded. ${snapshots.length} item(s) added to Inventory.`
    );
  }

  async function deleteTrip(tripId: string) {
    if (!confirm('Delete this shopping trip?')) return;
    await db.shoppingTrips.delete(tripId);
  }

  const toBuy = requirements.filter((req) => {
    const decision = formDecisions[req.ingredientId];
    if (req.remaining > 0.001) return true;
    if (req.differentFormBatches.length > 0 && decision !== 'decline' && decision !== 'accept') return true;
    if (decision === 'accept') return false;
    return false;
  });

  const purchasedIds = new Set(purchased.map((p) => p.ingredientId));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Grocery</h2>
        <button
          type="button"
          onClick={() => setShowManual(true)}
          className="text-sm font-medium text-emerald-600"
        >
          + Manual item
        </button>
      </div>

      <p className="text-sm text-slate-600">
        From Meal Plan minus Inventory. Different forms will ask for confirmation.
      </p>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex justify-between gap-2">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="underline shrink-0">OK</button>
        </div>
      )}

      {/* Manual add form */}
      {showManual && (
        <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
          <div className="font-medium text-slate-800">Add manual item</div>
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="Item name"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <div className="flex gap-2">
            <input
              type="number"
              step="any"
              min="0"
              value={manualQty}
              onChange={(e) => setManualQty(e.target.value)}
              className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
            <select
              value={manualUnit}
              onChange={(e) => setManualUnit(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              {COMMON_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addManualItem} className="px-3 py-2 bg-emerald-600 text-white text-sm rounded-lg">
              Add to purchased
            </button>
            <button type="button" onClick={() => setShowManual(false)} className="px-3 py-2 text-sm text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-slate-500">Calculating…</p>}

      {!loading && toBuy.length === 0 && purchased.length === 0 && (
        <div className="text-center py-10 text-slate-500">
          <p>Nothing to buy right now.</p>
        </div>
      )}

      {toBuy.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-medium text-slate-800">To Purchase</h3>
          <ul className="space-y-2">
            {toBuy.map((req) => {
              const isPurchased = purchasedIds.has(req.ingredientId);
              const decision = formDecisions[req.ingredientId];
              const needsFormDecision =
                req.remaining <= 0.001 &&
                req.differentFormBatches.length > 0 &&
                !decision;

              return (
                <li
                  key={req.ingredientId + req.unit}
                  className={`p-3 bg-white rounded-xl border ${isPurchased ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800">{req.name}</div>
                      <div className="text-sm text-slate-600">
                        Need {formatQuantity(req.totalRequired, req.unit)}
                        {req.available > 0 && (
                          <span className="text-slate-400"> · have {formatQuantity(req.available, req.availableUnit)}</span>
                        )}
                      </div>
                      {req.remaining > 0.001 && (
                        <div className="text-sm font-medium text-emerald-700 mt-0.5">
                          Buy {formatQuantity(req.remaining, req.remainingUnit)}
                        </div>
                      )}
                      {needsFormDecision && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                          <p className="text-amber-800 mb-2">Different form found in inventory. Count it?</p>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => handleFormDecision(req, 'accept')} className="px-2 py-1 bg-emerald-600 text-white text-xs rounded">Yes</button>
                            <button type="button" onClick={() => handleFormDecision(req, 'decline')} className="px-2 py-1 bg-slate-200 text-xs rounded">No, still buy</button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      {!isPurchased ? (
                        <button type="button" onClick={() => markPurchased(req)} className="px-3 py-1.5 text-sm bg-slate-100 rounded-lg">
                          Got it
                        </button>
                      ) : (
                        <button type="button" onClick={() => unmarkPurchased(req.ingredientId)} className="px-3 py-1.5 text-sm text-emerald-700 bg-emerald-100 rounded-lg">
                          ✓
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {purchased.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-medium text-slate-800">Purchased this trip</h3>
          <ul className="space-y-2">
            {purchased.map((p) => (
              <li key={p.ingredientId} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{p.name}</div>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={p.quantity}
                      onChange={(e) => updatePurchasedQty(p.ingredientId, parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                    />
                    <span className="text-sm text-slate-500 self-center">{p.unit}</span>
                  </div>
                </div>
                <button type="button" onClick={() => unmarkPurchased(p.ingredientId)} className="text-sm text-slate-400">
                  undo
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Trip total (optional)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={tripTotal}
                onChange={(e) => setTripTotal(e.target.value)}
                placeholder="0.00"
                className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <button
              type="button"
              onClick={completePurchase}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg"
            >
              Record → Inventory
            </button>
          </div>
        </section>
      )}

      {trips && trips.length > 0 && (
        <section className="pt-4 border-t border-slate-200">
          <h3 className="font-medium text-slate-800 mb-2">Recent Trips</h3>
          <ul className="space-y-2">
            {trips
              .slice()
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 8)
              .map((t) => (
                <li key={t.id} className="flex items-center justify-between text-sm text-slate-600">
                  <span>
                    {t.status === 'completed' ? '✓' : '○'}{' '}
                    {new Date(t.createdAt).toLocaleDateString()} — {t.purchasedItems.length} item
                    {t.purchasedItems.length !== 1 ? 's' : ''}
                    {t.totalCost != null && ` · $${t.totalCost.toFixed(2)}`}
                  </span>
                  <button type="button" onClick={() => deleteTrip(t.id)} className="text-red-500 text-xs">
                    Delete
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
