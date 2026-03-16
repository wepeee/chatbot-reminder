import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth-options";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const hasAppSession = typeof session?.user?.id === "string" && session.user.id.length > 0;

  if (!hasAppSession) {
    redirect("/login");
  }

  redirect("/dashboard");
}

