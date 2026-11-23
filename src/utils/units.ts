import { UNIT_TO_BASE } from '../types';

/**
 * Try to convert a quantity from one unit to another.
 * Returns null if the units are incompatible.
 */
export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string
): number | null {
  if (fromUnit === toUnit) return quantity;

  const from = UNIT_TO_BASE[fromUnit];
  const to = UNIT_TO_BASE[toUnit];

  if (!from || !to) return null;
  if (from.base !== to.base) return null;

  // Convert to base, then to target
  const inBase = quantity * from.factor;
  return inBase / to.factor;
}

/**
 * Compare two quantities. Returns the difference in the *required* unit,
 * or null if they cannot be compared.
 */
export function compareQuantities(
  requiredQty: number,
  requiredUnit: string,
  availableQty: number,
  availableUnit: string
): { remaining: number; unit: string } | null {
  // Prefer converting available → required unit
  const availableInRequired = convertQuantity(availableQty, availableUnit, requiredUnit);
  if (availableInRequired !== null) {
    return {
      remaining: Math.max(0, requiredQty - availableInRequired),
      unit: requiredUnit,
    };
  }

  // Try the other direction
  const requiredInAvailable = convertQuantity(requiredQty, requiredUnit, availableUnit);
  if (requiredInAvailable !== null) {
    const remainingInAvailable = Math.max(0, requiredInAvailable - availableQty);
    // Convert remaining back if possible, otherwise keep available unit
    const remainingInRequired = convertQuantity(remainingInAvailable, availableUnit, requiredUnit);
    return {
      remaining: remainingInRequired ?? remainingInAvailable,
      unit: remainingInRequired !== null ? requiredUnit : availableUnit,
    };
  }

  return null; // incompatible
}

export function formatQuantity(qty: number, unit: string): string {
  const rounded = Math.round(qty * 100) / 100;
  return `${rounded} ${unit}`;
}
