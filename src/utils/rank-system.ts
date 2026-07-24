export interface RankTier {
  id: string;
  name: string;
  tierGroup: 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'ascendant' | 'transcendant' | 'relentless';
  level?: number;
  requiredHours: number;
  badgeColor: string;
  badgeGradient: string;
  videoFileName: string;
}

export const RANK_TIERS: RankTier[] = [
  // Iron
  { id: 'iron_1', name: 'Iron 1', tierGroup: 'iron', level: 1, requiredHours: 0, badgeColor: '#6B7280', badgeGradient: 'linear-gradient(135deg, #4B5563, #9CA3AF)', videoFileName: 'iron.mp4' },
  { id: 'iron_2', name: 'Iron 2', tierGroup: 'iron', level: 2, requiredHours: 2, badgeColor: '#71717A', badgeGradient: 'linear-gradient(135deg, #52525B, #A1A1AA)', videoFileName: 'iron.mp4' },
  { id: 'iron_3', name: 'Iron 3', tierGroup: 'iron', level: 3, requiredHours: 3, badgeColor: '#78716C', badgeGradient: 'linear-gradient(135deg, #57534E, #A8A29E)', videoFileName: 'iron.mp4' },
  
  // Bronze
  { id: 'bronze_1', name: 'Bronze 1', tierGroup: 'bronze', level: 1, requiredHours: 5, badgeColor: '#B45309', badgeGradient: 'linear-gradient(135deg, #78350F, #D97706)', videoFileName: 'bronze.mp4' },
  { id: 'bronze_2', name: 'Bronze 2', tierGroup: 'bronze', level: 2, requiredHours: 7, badgeColor: '#C2410C', badgeGradient: 'linear-gradient(135deg, #881337, #EA580C)', videoFileName: 'bronze.mp4' },
  { id: 'bronze_3', name: 'Bronze 3', tierGroup: 'bronze', level: 3, requiredHours: 10, badgeColor: '#D97706', badgeGradient: 'linear-gradient(135deg, #92400E, #F59E0B)', videoFileName: 'bronze.mp4' },
  
  // Silver
  { id: 'silver_1', name: 'Silver 1', tierGroup: 'silver', level: 1, requiredHours: 12, badgeColor: '#94A3B8', badgeGradient: 'linear-gradient(135deg, #64748B, #CBD5E1)', videoFileName: 'silver.mp4' },
  { id: 'silver_2', name: 'Silver 2', tierGroup: 'silver', level: 2, requiredHours: 16, badgeColor: '#CBD5E1', badgeGradient: 'linear-gradient(135deg, #94A3B8, #E2E8F0)', videoFileName: 'silver.mp4' },
  { id: 'silver_3', name: 'Silver 3', tierGroup: 'silver', level: 3, requiredHours: 20, badgeColor: '#E2E8F0', badgeGradient: 'linear-gradient(135deg, #CBD5E1, #F8FAFC)', videoFileName: 'silver.mp4' },
  
  // Gold
  { id: 'gold_1', name: 'Gold 1', tierGroup: 'gold', level: 1, requiredHours: 26, badgeColor: '#EAB308', badgeGradient: 'linear-gradient(135deg, #CA8A04, #FDE047)', videoFileName: 'gold.mp4' },
  { id: 'gold_2', name: 'Gold 2', tierGroup: 'gold', level: 2, requiredHours: 33, badgeColor: '#FACC15', badgeGradient: 'linear-gradient(135deg, #D97706, #FEF08A)', videoFileName: 'gold.mp4' },
  { id: 'gold_3', name: 'Gold 3', tierGroup: 'gold', level: 3, requiredHours: 41, badgeColor: '#FDE047', badgeGradient: 'linear-gradient(135deg, #EAB308, #FFFBEB)', videoFileName: 'gold.mp4' },
  
  // Platinum
  { id: 'platinum_1', name: 'Platinum 1', tierGroup: 'platinum', level: 1, requiredHours: 52, badgeColor: '#06B6D4', badgeGradient: 'linear-gradient(135deg, #0891B2, #67E8F9)', videoFileName: 'platinum.mp4' },
  { id: 'platinum_2', name: 'Platinum 2', tierGroup: 'platinum', level: 2, requiredHours: 65, badgeColor: '#0891B2', badgeGradient: 'linear-gradient(135deg, #0E7490, #22D3EE)', videoFileName: 'platinum.mp4' },
  { id: 'platinum_3', name: 'Platinum 3', tierGroup: 'platinum', level: 3, requiredHours: 80, badgeColor: '#22D3EE', badgeGradient: 'linear-gradient(135deg, #06B6D4, #A5F3FC)', videoFileName: 'platinum.mp4' },
  
  // Diamond
  { id: 'diamond_1', name: 'Diamond 1', tierGroup: 'diamond', level: 1, requiredHours: 98, badgeColor: '#3B82F6', badgeGradient: 'linear-gradient(135deg, #1D4ED8, #93C5FD)', videoFileName: 'diamond.mp4' },
  { id: 'diamond_2', name: 'Diamond 2', tierGroup: 'diamond', level: 2, requiredHours: 118, badgeColor: '#2563EB', badgeGradient: 'linear-gradient(135deg, #1E40AF, #60A5FA)', videoFileName: 'diamond.mp4' },
  { id: 'diamond_3', name: 'Diamond 3', tierGroup: 'diamond', level: 3, requiredHours: 140, badgeColor: '#60A5FA', badgeGradient: 'linear-gradient(135deg, #2563EB, #BFDBFE)', videoFileName: 'diamond.mp4' },
  
  // Ascendant
  { id: 'ascendant_1', name: 'Ascendant 1', tierGroup: 'ascendant', level: 1, requiredHours: 165, badgeColor: '#10B981', badgeGradient: 'linear-gradient(135deg, #047857, #6EE7B7)', videoFileName: 'ascendant.mp4' },
  { id: 'ascendant_2', name: 'Ascendant 2', tierGroup: 'ascendant', level: 2, requiredHours: 195, badgeColor: '#059669', badgeGradient: 'linear-gradient(135deg, #065F46, #34D399)', videoFileName: 'ascendant.mp4' },
  { id: 'ascendant_3', name: 'Ascendant 3', tierGroup: 'ascendant', level: 3, requiredHours: 230, badgeColor: '#34D399', badgeGradient: 'linear-gradient(135deg, #10B981, #A7F3D0)', videoFileName: 'ascendant.mp4' },
  
  // Transcendant
  { id: 'transcendant', name: 'Transcendant', tierGroup: 'transcendant', requiredHours: 270, badgeColor: '#8B5CF6', badgeGradient: 'linear-gradient(135deg, #6D28D9, #C4B5FD)', videoFileName: 'transcendant.mp4' },
  
  // Relentless
  { id: 'relentless', name: 'Relentless', tierGroup: 'relentless', requiredHours: 365, badgeColor: '#EF4444', badgeGradient: 'linear-gradient(135deg, #B91C1C, #FCA5A5)', videoFileName: 'relentless.mp4' },
];

export interface RankProgressInfo {
  currentRank: RankTier;
  nextRank: RankTier | null;
  currentHours: number;
  minHoursForCurrent: number;
  maxHoursForNext: number;
  progressPercent: number;
  hoursRemainingToNext: number;
}

export function getRankFromHours(totalHours: number): RankTier {
  let matched = RANK_TIERS[0];
  for (const tier of RANK_TIERS) {
    if (totalHours >= tier.requiredHours) {
      matched = tier;
    } else {
      break;
    }
  }
  return matched;
}

export function getRankProgressInfo(totalHours: number): RankProgressInfo {
  const currentRank = getRankFromHours(totalHours);
  const currentIndex = RANK_TIERS.findIndex(t => t.id === currentRank.id);
  const nextRank = currentIndex < RANK_TIERS.length - 1 ? RANK_TIERS[currentIndex + 1] : null;

  const minHoursForCurrent = currentRank.requiredHours;
  const maxHoursForNext = nextRank ? nextRank.requiredHours : currentRank.requiredHours;

  let progressPercent = 100;
  let hoursRemainingToNext = 0;

  if (nextRank) {
    const hoursInTier = totalHours - minHoursForCurrent;
    const tierSpan = maxHoursForNext - minHoursForCurrent;
    progressPercent = Math.min(100, Math.max(0, (hoursInTier / tierSpan) * 100));
    hoursRemainingToNext = Math.max(0, maxHoursForNext - totalHours);
  }

  return {
    currentRank,
    nextRank,
    currentHours: totalHours,
    minHoursForCurrent,
    maxHoursForNext,
    progressPercent,
    hoursRemainingToNext,
  };
}

export function formatStudyTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}
