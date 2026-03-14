"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef } from "react";

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function ScrollToTop() {
  const pathname = usePathname();
  const prevPathname = useRef(pathname);

  useIsomorphicLayoutEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      // Scroll the mobile scroll container
      const mainEl = document.getElementById("main-scroll");
      if (mainEl) mainEl.scrollTop = 0;
      // Also reset window scroll for desktop
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
}
