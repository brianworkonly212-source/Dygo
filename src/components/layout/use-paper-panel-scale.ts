"use client";

import { useEffect, useState } from "react";

export function getPaperPanelScale() {
  if (typeof window === "undefined") return 1;

  const downscale = Math.min(1, window.innerHeight / 1024);
  if (window.innerHeight <= 1080 || window.innerWidth < 2200) return downscale;

  return Math.min(1.18, window.innerHeight / 1080, window.innerWidth / 1920);
}

export function usePaperPanelScale() {
  const [panelScale, setPanelScale] = useState(getPaperPanelScale);

  useEffect(() => {
    function updatePanelScale() {
      setPanelScale(getPaperPanelScale());
    }

    updatePanelScale();
    window.addEventListener("resize", updatePanelScale);
    return () => window.removeEventListener("resize", updatePanelScale);
  }, []);

  return panelScale;
}
