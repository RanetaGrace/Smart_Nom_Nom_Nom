import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfWeek, addDays, addWeeks, isSameDay } from 'date-fns';
import { db } from '../db';
import type { PlannedMeal } from '../types';
import { MEAL_TYPE_LABELS } from '../types';

export function MealPlan() {
  const [weekOffset, setWeekOffset] = useState(0);
  const today = new Date();
  const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const meals = useLiveQuery(() => db.plannedMeals.toArray(), []);
  const recipes = useLiveQuery(() => db.recipes.toArray(), []);

  const recipeMap = new Map((recipes ?? []).map((r) => [r.id, r]));

  function mealsForDay(day: Date): PlannedMeal[] {
    const dateStr = format(day, 'yyyy-MM-dd');
    return (meals ?? [])
      .filter((m) => m.date === dateStr)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">Meal Plan</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg"
            aria-label="Previous week"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="px-2 h-9 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="w-9 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 rounded-lg"
            aria-label="Next week"
          >
            →
          </button>
        </div>
      </div>

      <p className="text-sm font-medium text-slate-600 -mt-2">{weekLabel}</p>

      <div className="space-y-3">
        {days.map((day) => {
          const dayMeals = mealsForDay(day);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={day.toISOString()}
              className={`p-3 bg-white rounded-xl border ${
                isToday ? 'border-emerald-400 ring-1 ring-emerald-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-slate-800">
                  {format(day, 'EEE')}
                  <span className="ml-1.5 text-sm font-normal text-slate-500">
                    {format(day, 'MMM d')}
                  </span>
                  {isToday && (
                    <span className="ml-2 text-[10px] font-semibold text-emerald-600 uppercase">
                      Today
                    </span>
                  )}
                </div>
                <Link
                  to={`/meal-plan/add?date=${format(day, 'yyyy-MM-dd')}`}
                  className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  + Add
                </Link>
              </div>

              {dayMeals.length === 0 ? (
                <div className="text-sm text-slate-400 py-1">No meals</div>
              ) : (
                <ul className="space-y-1.5">
                  {dayMeals.map((meal) => (
                    <li key={meal.id}>
                      <Link
                        to={`/meal-plan/${meal.id}`}
                        className="block p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-800 truncate">
                              {meal.mealType && (
                                <span className="text-[10px] font-semibold text-slate-500 mr-1.5">
                                  {meal.mealType}
                                </span>
                              )}
                              {meal.title}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              {meal.servings} serv
                              {meal.status === 'eaten' && (
                                <span className="ml-2 text-emerald-600">✓ Eaten</span>
                              )}
                              {meal.status === 'skipped' && (
                                <span className="ml-2 text-slate-400">✕ Skipped</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
