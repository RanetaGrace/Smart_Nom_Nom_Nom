import { useState, useRef, useEffect } from 'react';
import type { Ingredient } from '../types';

type Props = {
  ingredients: Ingredient[];
  value: string;
  onChange: (ingredientId: string) => void;
  placeholder?: string;
  className?: string;
};

export function IngredientSelect({
  ingredients,
  value,
  onChange,
  placeholder = 'Search ingredients…',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = ingredients.find((i) => i.id === value);

  // Keep input text in sync when value changes from outside
  useEffect(() => {
    if (!open) {
      setQuery(selected?.name ?? '');
    }
  }, [value, selected?.name, open]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(selected?.name ?? '');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [selected?.name]);

  const filtered = query.trim()
    ? ingredients.filter((i) =>
        i.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : ingredients;

  function handleSelect(ing: Ingredient) {
    onChange(ing.id);
    setQuery(ing.name);
    setOpen(false);
  }

  function handleClear() {
    onChange('');
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="flex gap-1">
        <input
          ref={inputRef}
          type="text"
          value={open ? query : selected?.name ?? query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange(''); // clear selection while typing
          }}
          onFocus={() => {
            setOpen(true);
            setQuery(selected?.name ?? '');
          }}
          placeholder={placeholder}
          className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          autoComplete="off"
        />
        {(value || query) && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2 text-slate-400 hover:text-slate-600 text-sm"
            aria-label="Clear"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <ul className="absolute z-40 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No matches</li>
          ) : (
            filtered.slice(0, 50).map((ing) => (
              <li key={ing.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(ing)}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 ${
                    ing.id === value ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-slate-800'
                  }`}
                >
                  {ing.name}
                  {ing.family && ing.family !== ing.name && (
                    <span className="text-slate-400 text-xs ml-1">({ing.family})</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
