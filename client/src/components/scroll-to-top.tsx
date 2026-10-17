import { useEffect } from "react";
import { useLocation } from "wouter";

/** Garante que cada troca de rota comece no topo da página. */
export function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location]);

  return null;
}
