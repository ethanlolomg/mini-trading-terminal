import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. Used to gate the instant-trade panel to
 * desktop viewports (the task targets Desktop only).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Tailwind's `lg` breakpoint — our threshold for "desktop". */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
