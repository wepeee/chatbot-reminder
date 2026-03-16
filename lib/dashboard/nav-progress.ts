export const DASHBOARD_NAV_START_EVENT = "dashboard-nav-start";

export function dispatchDashboardNavStart() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(DASHBOARD_NAV_START_EVENT));
}
