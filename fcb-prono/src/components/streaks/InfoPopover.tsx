"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface InfoPopoverProps {
  children: React.ReactNode;
}

export default function InfoPopover({ children }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    // If button is in the left half of the screen, align popup to the left
    setAlignRight(rect.left > window.innerWidth / 2);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleToggle = () => {
    if (!open) updatePosition();
    setOpen((v) => !v);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        ref={btnRef}
        onClick={handleToggle}
        className={`text-gray-600 hover:text-gray-400 transition-colors ${open ? "text-gray-400" : ""}`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute z-50 top-full mt-1 w-[190px] bg-cb-dark border border-white/[0.1] rounded-lg shadow-2xl p-2.5 ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
