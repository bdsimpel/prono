"use client";

import { useEffect } from "react";

export default function ForceScrollTop() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return <script dangerouslySetInnerHTML={{ __html: "window.scrollTo(0,0)" }} />;
}
