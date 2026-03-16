import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-options";
import { getUserById } from "@/lib/services/data-service";

export async function getCurrentSessionUser() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return null;
  }

  try {
    return await getUserById(userId);
  } catch {
    return null;
  }
}
