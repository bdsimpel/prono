"use client";

import { useState, useEffect, type ReactNode } from "react";

export default function PredictionBlur({
  deadline,
  children,
}: {
  deadline: string;
  children: ReactNode;
}) {
  const [isBlurred, setIsBlurred] = useState(
    () => Date.now() < new Date(deadline).getTime(),
  );

  useEffect(() => {
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0) {
      setIsBlurred(false);
      return;
    }
    const timer = setTimeout(() => setIsBlurred(false), ms);
    return () => clearTimeout(timer);
  }, [deadline]);

  if (!isBlurred) return <>{children}</>;

  return <span className="blur-sm select-none">{children}</span>;
}
