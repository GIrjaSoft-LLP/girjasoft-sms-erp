"use client";

import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 767px)";

export function useResponsiveSidebar() {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const sync = () => {
      const mobile = media.matches;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return {
    isMobile,
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar: () => setSidebarOpen((open) => !open),
    collapsedDesktop: !isMobile && !sidebarOpen,
    mobileOpen: isMobile && sidebarOpen,
  };
}
