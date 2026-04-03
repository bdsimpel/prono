"use client";

import TeamLogo from "@/components/TeamLogo";

interface StatsSummaryCardsProps {
  playerCount: number;
  totalExactScores: number;
  favoriteTeam: string | null;
}

export default function StatsSummaryCards({
  playerCount,
  totalExactScores,
  favoriteTeam,
}: StatsSummaryCardsProps) {
  return (
    <div className="flex items-center justify-center gap-4 md:gap-12 mt-5 md:mt-8">
      <div className="text-center">
        <div className="heading-display text-2xl md:text-4xl text-white font-bold">
          {playerCount}
        </div>
        <div className="text-[9px] md:text-xs text-gray-500 uppercase tracking-[0.15em] mt-0.5">
          Deelnemers
        </div>
      </div>
      <div className="stat-divider" />
      <div className="text-center">
        <div className="heading-display text-2xl md:text-4xl text-white font-bold">
          {totalExactScores}
        </div>
        <div className="text-[9px] md:text-xs text-gray-500 uppercase tracking-[0.15em] mt-0.5">
          Exacte scores
        </div>
      </div>
      <div className="stat-divider" />
      <div className="text-center">
        {favoriteTeam ? (
          <>
            <div className="flex items-center justify-center gap-2">
              <TeamLogo name={favoriteTeam} size={28} />
              <div className="heading-display text-lg md:text-2xl text-white font-bold">
                {favoriteTeam}
              </div>
            </div>
            <div className="text-[9px] md:text-xs text-gray-500 uppercase tracking-[0.15em] mt-0.5">
              Favoriete ploeg
            </div>
          </>
        ) : (
          <>
            <div className="heading-display text-2xl md:text-4xl text-white font-bold">
              —
            </div>
            <div className="text-[9px] md:text-xs text-gray-500 uppercase tracking-[0.15em] mt-0.5">
              Favoriete ploeg
            </div>
          </>
        )}
      </div>
    </div>
  );
}
