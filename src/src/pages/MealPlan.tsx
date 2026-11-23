import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { format, startOfWeek, addDays, addWeeks, isSameDay } from 'date-fns';
import { db } from '../db';
import type { PlannedMeal } from '../types';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold text-slate-800">Meal Plan</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o - 1)}
            className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset(0)}
            className="px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 rounded"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded"
          >
            →
          </button>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d, yyyy')}
      </p>

      <div className="space-y-3">
        {days.map((day) => {
          const dayMeals = mealsForDay(day);
          const isToday = isSameDay(day, today);

          return (
            <div
              key={day.toISOString()}
              className={`p-4 bg-white rounded-xl border ${
                isToday ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-slate-800">
                  {format(day, 'EEEE')}
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {format(day, 'MMM d')}
                  </span>
                  {isToday && (
                    <span className="ml-2 text-xs text-emerald-600 font-medium">Today</span>
                  )}
                </div>
                <Link
                  to={`/meal-plan/add?date=${format(day, 'yyyy-MM-dd')}`}
                  className="text-sm text-emerald-600 hover:underline"
                >
                  + Add meal
                </Link>
              </div>

              {dayMeals.length === 0 ? (
                <div className="text-sm text-slate-400 italic">No meals planned</div>
              ) : (
                <ul className="space-y-2">
                  {dayMeals.map((meal) => (
                    <li key={meal.id}>
                      <Link
                        to={`/meal-plan/${meal.id}`}
                        className="block p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition"
                      >
                        <div className="font-medium text-slate-800">{meal.title}</div>
                        <div className="text-sm text-slate-500">
                          {meal.servings} serving{meal.servings !== 1 ? 's' : ''}
                          {meal.recipeId && recipeMap.get(meal.recipeId) && (
                            <span className="ml-2 text-xs text-slate-400">
                              from recipe
                            </span>
                          )}
                          {!meal.recipeId && (
                            <span className="ml-2 text-xs text-violet-500">free-text</span>
                          )}
                          {' · '}
                          {meal.ingredients.length} ingredient
                          {meal.ingredients.length !== 1 ? 's' : ''}
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
