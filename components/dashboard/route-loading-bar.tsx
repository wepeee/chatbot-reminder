"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { DASHBOARD_NAV_START_EVENT } from "@/lib/dashboard/nav-progress";
import { cn } from "@/lib/utils";

export function DashboardRouteLoadingBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const loadingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const forceFinishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (forceFinishTimerRef.current) {
      clearTimeout(forceFinishTimerRef.current);
      forceFinishTimerRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    if (!loadingRef.current) {
      return;
    }

    clearTimers();
    setProgress(100);

    hideTimerRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
      loadingRef.current = false;
      hideTimerRef.current = null;
    }, 240);
  }, [clearTimers]);

  const start = useCallback(() => {
    if (loadingRef.current) {
      return;
    }

    clearTimers();
    loadingRef.current = true;
    setVisible(true);
    setProgress(10);

    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) {
          return prev;
        }

        return prev + Math.max(1, Math.round((90 - prev) * 0.15));
      });
    }, 180);

    forceFinishTimerRef.current = setTimeout(() => {
      finish();
    }, 8000);
  }, [clearTimers, finish]);

  useEffect(() => {
    if (loadingRef.current) {
      finish();
    }
  }, [routeKey, finish]);

  useEffect(() => {
    const onNavStart = () => start();

    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) return;

      const current = `${window.location.pathname}${window.location.search}`;
      const next = `${nextUrl.pathname}${nextUrl.search}`;
      if (current === next) return;

      start();
    };

    const onPopState = () => start();

    window.addEventListener(DASHBOARD_NAV_START_EVENT, onNavStart);
    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener(DASHBOARD_NAV_START_EVENT, onNavStart);
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, [clearTimers, start]);

  return (
    <div
      className={cn(
        "pointer-events-none fixed left-0 top-0 z-[100] h-1 bg-primary transition-[width,opacity] duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ width: `${progress}%` }}
      aria-hidden
    />
  );
}
