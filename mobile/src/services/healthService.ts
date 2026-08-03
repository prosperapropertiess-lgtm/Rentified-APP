import { PropertyHealthRecord } from '../app/property-health';

export const healthService = {
  calculateOverallHealthScore(systems: PropertyHealthRecord['systems']): number {
    if (!systems || systems.length === 0) return 90;

    let score = 100;
    systems.forEach((sys) => {
      if (sys.status === 'service_due') score -= 8;
      if (sys.status === 'needs_replacement') score -= 20;
    });

    return Math.max(0, Math.min(100, score));
  },

  getScoreMeta(score: number) {
    if (score >= 90) {
      return { bg: 'bg-emerald-500', text: 'text-emerald-700', border: 'border-emerald-500/30', label: 'Excellent 🟢' };
    }
    if (score >= 70) {
      return { bg: 'bg-amber-500', text: 'text-amber-800', border: 'border-amber-500/30', label: 'Needs Attention 🟡' };
    }
    return { bg: 'bg-rose-500', text: 'text-rose-700', border: 'border-rose-500/30', label: 'Critical 🔴' };
  },
};
