/**
 * Rough UK supermarket prices in pence for one portion as the food list defines it (e.g. "Chicken breast,
 * cooked, 100 g" is priced as the raw meat it takes). Mid-range own-label prices, late 2026, rounded.
 * APEX's own estimates for budgeting, not any shop's price list. Foods not listed have no estimate.
 */
export const FOOD_PRICE_PENCE: Record<number, number> = {
  1: 100, 2: 70, 3: 80, 4: 90, 6: 400, 7: 75, 8: 160, 9: 50, 11: 230, 12: 110, 13: 300, 14: 180, 15: 130, 16: 90,
  17: 30, 18: 60, 19: 50, 20: 120, 21: 80, 22: 20, 23: 30, 24: 40, 25: 25, 26: 70, 27: 90,
  29: 50, 31: 70, 32: 40, 33: 25, 34: 25, 37: 30, 38: 30, 40: 40, 41: 25, 43: 20,
  44: 10, 45: 30, 47: 8, 49: 25, 51: 20, 52: 15, 53: 12, 54: 8, 55: 10, 56: 50, 57: 8, 58: 10, 59: 25, 60: 12, 61: 40,
  62: 20, 63: 40, 64: 35, 66: 15,
  67: 18, 68: 30, 71: 80, 72: 60, 73: 90, 75: 50, 76: 35, 78: 30, 79: 15, 80: 50,
  81: 15, 82: 35, 83: 30, 84: 6, 85: 8, 86: 25, 87: 30, 88: 20, 89: 15, 90: 20, 91: 12, 92: 15, 93: 20, 95: 75,
  96: 10, 97: 10, 98: 45, 102: 20, 103: 15, 104: 25, 105: 25,
};
