import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, nextId } from '../db';
import { calculateGroceryNeeds, type GroceryRequirement } from '../utils/grocery';
import { formatQuantity } from '../utils/units';
import type { ShoppingTrip, PurchasedItemSnapshot } from '../types';

export function Grocery() {
  const [requirements, setRequirements] = useState<GroceryRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchased, setPurchased] = useState<
    { ingredientId: string; name: string; quantity: number; unit: string }[]
  >([]);
  const [formDecisions, setFormDecisions] = useState<
    Record<string, 'accept' | 'decline'>
  >({});
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [tripTotal, setTripTotal] = useState('');
  const [message, setMessage] = useState('');

  const trips = useLiveQuery(() => db.shoppingTrips.toArray(), []);
  const decisions = useLiveQuery(() => db.groceryFormDecisions.toArray(), []);

  // Recalculate whenever data changes
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
    return () => {
      cancelled = true;
    };
  }, [meals, batches, decisions]);

  // Load pending decisions into local state
  useEffect(() => {
    if (!decisions) return;
    const map: Record<string, 'accept' | 'decline'> = {};
    for (const d of decisions) {
      if (d.decision === 'accept' || d.decision === 'decline') {
        map[`${d.requiredIngredientId}`] = d.decision;
      }
    }
    setFormDecisions(map);
  }, [decisions]);

  async function handleFormDecision(
    req: GroceryRequirement,
    decision: 'accept' | 'decline'
  ) {
    // For simplicity in ALPHA: store a decision keyed by required ingredient
    // and adjust remaining if accepted (using first different-form batch)
    const id = await nextId('trip'); // reuse counter style, or just use crypto
    // Actually use a simple id
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

  function unmarkPurchased(ingredientId: string) {
    setPurchased((prev) => prev.filter((p) => p.ingredientId !== ingredientId));
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

    // Create inventory batches for each purchased item
    for (const item of purchased) {
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

    // Update trip
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
        ? `Purchase recorded. ${snapshots.length} batch(es) added to Inventory. Trip completed.`
        : `Purchase recorded. ${snapshots.length} batch(es) added to Inventory. Trip still active (add total cost later).`
    );
  }

  // Build display list: still needed after form decisions
  const toBuy = requirements.filter((req) => {
    const decision = formDecisions[req.ingredientId];
    if (req.remaining > 0.001) return true;
    // If only different-form and not yet declined, still show for decision
    if (req.differentFormBatches.length > 0 && decision !== 'decline' && decision !== 'accept') {
      return true;
    }
    if (decision === 'accept' && req.differentFormBatches.length > 0) {
      // Treat as partially covered — for ALPHA we just hide if they accepted
      return false;
    }
    return false;
  });

  const purchasedIds = new Set(purchased.map((p) => p.ingredientId));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-slate-800">Grocery</h2>
      </div>

      <p className="text-sm text-slate-600">
        Calculated from your Meal Plan minus current Inventory. Exact matches are subtracted
        automatically. Different forms will ask for confirmation.
      </p>

      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg">
          {message}
          <button
            type="button"
            onClick={() => setMessage('')}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading && <p className="text-slate-500">Calculating…</p>}

      {!loading && toBuy.length === 0 && purchased.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>Nothing to buy right now.</p>
          <p className="text-sm mt-1">
            Plan some meals or your inventory already covers what’s planned.
          </p>
        </div>
      )}

      {/* To Buy */}
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
                  className={`p-4 bg-white rounded-xl border ${
                    isPurchased ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-800">{req.name}</div>
                      <div className="text-sm text-slate-600">
                        Need {formatQuantity(req.totalRequired, req.unit)}
                        {req.available > 0 && (
                          <span className="text-slate-400">
                            {' '}
                            · have {formatQuantity(req.available, req.availableUnit)}
                          </span>
                        )}
                      </div>
                      {req.remaining > 0.001 && (
                        <div className="text-sm font-medium text-emerald-700 mt-0.5">
                          Buy {formatQuantity(req.remaining, req.remainingUnit)}
                        </div>
                      )}
                      {needsFormDecision && (
                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                          <p className="text-amber-800 mb-2">
                            You have a different form of this ingredient in inventory. Count it?
                          </p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleFormDecision(req, 'accept')}
                              className="px-2 py-1 bg-emerald-600 text-white text-xs rounded"
                            >
                              Yes, count it
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFormDecision(req, 'decline')}
                              className="px-2 py-1 bg-slate-200 text-slate-700 text-xs rounded"
                            >
                              No, still buy
                            </button>
                          </div>
                        </div>
                      )}
                      {decision === 'accept' && (
                        <div className="text-xs text-emerald-600 mt-1">Using different form from inventory</div>
                      )}
                      {decision === 'decline' && req.remaining <= 0.001 && (
                        <div className="text-sm font-medium text-emerald-700 mt-0.5">
                          Buy {formatQuantity(req.totalRequired, req.unit)}
                        </div>
                      )}
                    </div>
                    <div>
                      {!isPurchased ? (
                        <button
                          type="button"
                          onClick={() => markPurchased(req)}
                          className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
                        >
                          Purchased
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => unmarkPurchased(req.ingredientId)}
                          className="px-3 py-1.5 text-sm text-emerald-700 bg-emerald-100 rounded-lg"
                        >
                          ✓ Purchased
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

      {/* Purchased this session */}
      {purchased.length > 0 && (
        <section className="space-y-3">
          <h3 className="font-medium text-slate-800">Purchased (this trip)</h3>
          <ul className="space-y-1">
            {purchased.map((p) => (
              <li key={p.ingredientId} className="text-sm text-slate-600 flex justify-between">
                <span>
                  {p.name} — {formatQuantity(p.quantity, p.unit)}
                </span>
                <button
                  type="button"
                  onClick={() => unmarkPurchased(p.ingredientId)}
                  className="text-slate-400 hover:text-red-500"
                >
                  undo
                </button>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-end gap-3 pt-2">
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
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
            >
              Record Purchase → Inventory
            </button>
          </div>
          <p className="text-xs text-slate-500">
            This creates inventory batches and a shopping trip. Enter the total to mark the trip completed.
          </p>
        </section>
      )}

      {/* Recent trips */}
      {trips && trips.length > 0 && (
        <section className="pt-4 border-t border-slate-200">
          <h3 className="font-medium text-slate-800 mb-2">Recent Trips</h3>
          <ul className="space-y-1 text-sm text-slate-600">
            {trips
              .slice()
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .slice(0, 5)
              .map((t) => (
                <li key={t.id}>
                  {t.status === 'completed' ? '✓' : '○'}{' '}
                  {new Date(t.createdAt).toLocaleDateString()} —{' '}
                  {t.purchasedItems.length} item{t.purchasedItems.length !== 1 ? 's' : ''}
                  {t.totalCost != null && ` · $${t.totalCost.toFixed(2)}`}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
