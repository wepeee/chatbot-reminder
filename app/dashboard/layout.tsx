import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { DashboardRouteLoadingBar } from "@/components/dashboard/route-loading-bar";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { authOptions } from "@/lib/auth-options";
import { getUserById } from "@/lib/services/data-service";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;

  if (!sessionUserId) {
    redirect("/login");
  }

  const appUser = await getUserById(sessionUserId).catch(() => null);
  if (!appUser) {
    redirect("/login");
  }

  const displayName = appUser.full_name?.trim() || session.user?.name?.trim() || "Teman Belajar";
  const avatarUrl = session.user?.image ?? null;

  return (
    <div className="dashboard-grid min-h-screen bg-background">
      <DashboardRouteLoadingBar />
      <div className="flex min-h-screen">
        <DashboardSidebar />
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <DashboardTopbar userName={displayName} avatarUrl={avatarUrl} />
          <main className="min-w-0 flex-1 p-4 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
