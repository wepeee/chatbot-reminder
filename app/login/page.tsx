import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { LoginShowcase } from "@/components/auth/login-showcase";
import { authOptions } from "@/lib/auth-options";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  const hasAppSession = typeof session?.user?.id === "string" && session.user.id.length > 0;

  if (hasAppSession) {
    redirect("/dashboard");
  }

  return <LoginShowcase />;
}
