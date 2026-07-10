import type { Sex } from "./types";

export interface CategoryRule {
  effectiveFrom: string;
  effectiveTo?: string;
  men: number[];
  women: number[];
  olympicMen?: number[];
  olympicWomen?: number[];
  label: string;
}

export const IWF_CATEGORY_RULES: CategoryRule[] = [
  {
    effectiveFrom: "2025-06-01",
    effectiveTo: "2026-07-31",
    men: [60, 65, 71, 79, 88, 94, 110, Infinity],
    women: [48, 53, 58, 63, 69, 77, 86, Infinity],
    label: "IWF June 2025 categories"
  },
  {
    effectiveFrom: "2026-08-01",
    men: [60, 65, 70, 75, 85, 95, 110, Infinity],
    women: [49, 53, 57, 61, 69, 77, 86, Infinity],
    olympicMen: [65, 75, 85, 95, 110, Infinity],
    olympicWomen: [53, 61, 69, 77, 86, Infinity],
    label: "IWF August 2026 categories"
  }
];

export function getCategoryRule(date: string): CategoryRule {
  const target = new Date(date).getTime();
  const found = [...IWF_CATEGORY_RULES]
    .reverse()
    .find((rule) => {
      const from = new Date(rule.effectiveFrom).getTime();
      const to = rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : Infinity;
      return target >= from && target <= to;
    });

  return found ?? IWF_CATEGORY_RULES[0];
}

export function getIwfCategories(date: string, sex: Sex, olympic = false): number[] {
  const rule = getCategoryRule(date);
  if (sex === "female") {
    return olympic && rule.olympicWomen ? rule.olympicWomen : rule.women;
  }
  return olympic && rule.olympicMen ? rule.olympicMen : rule.men;
}

export function getBodyweightCategory(
  bodyweightKg: number,
  sex: Sex,
  date: string,
  olympic = false
): number {
  const categories = getIwfCategories(date, sex, olympic);
  return categories.find((category) => bodyweightKg <= category) ?? Infinity;
}

export function formatCategory(category: number): string {
  return Number.isFinite(category) ? `${category} kg` : "+";
}

export function formatBodyweightClass(bodyweightKg: number, sex: Sex, date: string, olympic = false): string {
  const category = getBodyweightCategory(bodyweightKg, sex, date, olympic);
  if (category === Infinity) {
    const lastFinite = getIwfCategories(date, sex, olympic).filter(Number.isFinite).at(-1);
    return `+${lastFinite} kg`;
  }
  return `${category} kg`;
}
