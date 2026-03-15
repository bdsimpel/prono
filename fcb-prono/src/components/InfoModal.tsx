"use client";

import { useState } from "react";

export default function InfoModal() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-white/10 text-gray-500 hover:text-white hover:border-white/20 transition-colors"
        aria-label="Regels en puntentelling"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <circle cx="12" cy="12" r="10" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 16v-4m0-4h.01"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative glass-card-subtle max-w-md w-full p-6 md:p-8 max-h-[80vh] overflow-y-auto"
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <h3 className="heading-display text-2xl text-white mb-4">
              PUNTENTELLING
            </h3>
            <div className="space-y-3 text-sm text-gray-400 mb-6">
              <div className="flex justify-between items-center">
                <span>Exacte score</span>
                <span className="text-white font-medium">
                  10 + totaal goals
                </span>
              </div>
              <div className="border-t border-white/[0.06]" />
              <div className="flex justify-between items-center">
                <span>Juist doelpuntenverschil</span>
                <span className="text-white font-medium">7 punten</span>
              </div>
              <div className="border-t border-white/[0.06]" />
              <div className="flex justify-between items-center">
                <span>Juist resultaat</span>
                <span className="text-white font-medium">5 punten</span>
              </div>
              <div className="border-t border-white/[0.06]" />
              <div className="flex justify-between items-center">
                <span>Fout</span>
                <span className="text-white font-medium">0 punten</span>
              </div>
            </div>

            <h3 className="heading-display text-2xl text-white mb-4">
              REGELS
            </h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="text-cb-gold shrink-0">&bull;</span>
                Deelname kost &euro;2 per persoon
              </li>
              <li className="flex gap-2">
                <span className="text-cb-gold shrink-0">&bull;</span>
                Alle voorspellingen moeten ingevuld zijn voor de eerste wedstrijd
              </li>
              <li className="flex gap-2">
                <span className="text-cb-gold shrink-0">&bull;</span>
                Voorspellingen kunnen achteraf niet meer gewijzigd worden
              </li>
              <li className="flex gap-2">
                <span className="text-cb-gold shrink-0">&bull;</span>
                De pot wordt verdeeld: 50% winnaar, 33% tweede, 17% derde
              </li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
