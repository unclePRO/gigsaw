/**
 * Universal budget normalization utility for Gigsaw.
 * Guarantees that the sum of all milestone/work-package allocated prices
 * strictly matches the project's total budget.
 */

export function normalizePackageBudgets<
  T extends { allocatedPrice?: number; quotationAmount?: number; category?: string }
>(packages: T[], totalBudget: number): T[] {
  if (!packages || packages.length === 0) return packages;
  const budget = Math.max(0, Math.round(Number(totalBudget) || 0));
  const n = packages.length;

  if (budget <= 0) {
    for (const p of packages) {
      p.allocatedPrice = 0;
      if (p.quotationAmount != null || 'quotationAmount' in p) {
        p.quotationAmount = 0;
      }
    }
    return packages;
  }

  // 1. Establish raw weights
  // If packages have existing positive prices, use them as relative ratios.
  // Otherwise default to standard domain weighting (dev ~ 60%, design ~ 25%, marketing ~ 15%).
  const hasValidPrices = packages.some((p) => Number(p.allocatedPrice) > 0);
  const rawWeights: number[] = packages.map((p) => {
    if (hasValidPrices && Number(p.allocatedPrice) > 0) {
      return Number(p.allocatedPrice);
    }
    const cat = (p.category || '').toLowerCase();
    if (cat === 'dev') return 0.6;
    if (cat === 'designer') return 0.25;
    if (cat === 'marketer') return 0.15;
    return 1 / n;
  });

  const sumWeights = rawWeights.reduce((s, w) => s + w, 0) || 1;

  let allocatedSoFar = 0;
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      // Last package takes exact remainder to enforce invariant: sum === budget
      const remainder = budget - allocatedSoFar;
      const finalPrice = Math.max(budget >= n ? 1 : 0, remainder);
      packages[i].allocatedPrice = finalPrice;
      if (packages[i].quotationAmount != null || 'quotationAmount' in packages[i]) {
        packages[i].quotationAmount = finalPrice;
      }
      allocatedSoFar += finalPrice;
    } else {
      const share = (rawWeights[i] / sumWeights) * budget;
      const minNeededForRest = budget >= n ? n - 1 - i : 0;
      const maxAllowed = Math.max(budget >= n ? 1 : 0, budget - allocatedSoFar - minNeededForRest);
      const minAllowed = budget >= n ? 1 : 0;
      const rounded = Math.min(maxAllowed, Math.max(minAllowed, Math.round(share)));

      packages[i].allocatedPrice = rounded;
      if (packages[i].quotationAmount != null || 'quotationAmount' in packages[i]) {
        packages[i].quotationAmount = rounded;
      }
      allocatedSoFar += rounded;
    }
  }

  // Final sanity correction in case clamping created a slight mismatch
  const actualSum = packages.reduce((s, p) => s + (Number(p.allocatedPrice) || 0), 0);
  if (actualSum !== budget && n > 0) {
    const diff = budget - actualSum;
    let bestIdx = n - 1;
    let maxVal = -1;
    for (let i = 0; i < n; i++) {
      if ((packages[i].allocatedPrice || 0) > maxVal) {
        maxVal = packages[i].allocatedPrice || 0;
        bestIdx = i;
      }
    }
    packages[bestIdx].allocatedPrice = Math.max(0, (packages[bestIdx].allocatedPrice || 0) + diff);
    if (packages[bestIdx].quotationAmount != null || 'quotationAmount' in packages[bestIdx]) {
      packages[bestIdx].quotationAmount = packages[bestIdx].allocatedPrice;
    }
  }

  return packages;
}
