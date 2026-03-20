"use client";

import { useState } from "react";
import type { Edition, EditionScore } from "@/lib/types";

function getMedalIcon(rank: number) {
  switch (rank) {
    case 1:
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full glow-gold text-sm" title="Goud">
          🥇
        </span>
      );
    case 2:
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full glow-silver text-sm" title="Zilver">
          🥈
        </span>
      );
    case 3:
      return (
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full glow-bronze text-sm" title="Brons">
          🥉
        </span>
      );
    default:
      return null;
  }
}

function getRowGlow(rank: number) {
  switch (rank) {
    case 1:
      return "bg-cb-gold/[0.06]";
    case 2:
      return "bg-cb-silver/[0.04]";
    case 3:
      return "bg-cb-bronze/[0.04]";
    default:
      return "";
  }
}

interface ErelijstModalProps {
  editions: Edition[];
  editionScores: EditionScore[];
}

export default function ErelijstModal({ editions, editionScores }: ErelijstModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const sortedEditions = [...editions].sort((a, b) => b.year - a.year);

  const getTop3 = (edition: Edition) => {
    return editionScores
      .filter((es) => es.edition_id === edition.id && es.rank <= 3)
      .sort((a, b) => a.rank - b.rank);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-cb-gold hover:bg-cb-gold/[0.08] transition-colors"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
        </svg>
        Erelijst
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative glass-card-subtle max-w-lg w-full p-6 md:p-8 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              aria-label="Sluiten"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="heading-display text-2xl text-white mb-1">ERELIJST</h3>
            <p className="text-sm text-gray-500 mb-6">Top 3 per editie</p>

            <div className="space-y-6">
              {sortedEditions.map((edition) => {
                const top3 = getTop3(edition);
                if (top3.length === 0) return null;

                return (
                  <div key={edition.id}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="heading-display text-lg text-cb-blue">
                        {edition.label}
                      </span>
                      <span className="text-xs text-gray-600">
                        {edition.player_count} deelnemers
                      </span>
                    </div>
                    <div className="space-y-1">
                      {top3.map((score) => (
                        <div
                          key={`${score.edition_id}-${score.player_name}`}
                          className={`flex items-center gap-3 px-3 py-2 rounded ${getRowGlow(score.rank)}`}
                        >
                          {getMedalIcon(score.rank)}
                          <span className="flex-1 text-sm font-medium text-gray-200">
                            {score.player_name}
                          </span>
                          <span className="text-sm font-bold text-white">
                            {score.total_score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
