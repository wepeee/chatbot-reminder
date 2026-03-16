import type { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";

import { env } from "@/lib/env";
import { ensureUserByDiscord } from "@/lib/services/data-service";

type DiscordProfile = {
  global_name?: string | null;
  username?: string | null;
};

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: env.AUTH_DISCORD_ID,
      clientSecret: env.AUTH_DISCORD_SECRET
    })
  ],
  secret: env.AUTH_SECRET,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  callbacks: {
    async signIn({ account }) {
      if (account?.provider !== "discord") {
        return false;
      }

      const allowedDiscordId = env.DISCORD_ALLOWED_USER_ID?.trim();
      if (!allowedDiscordId) {
        return true;
      }

      return account.providerAccountId === allowedDiscordId;
    },
    async jwt({ token, account, profile }) {
      const discordUserId =
        account?.provider === "discord"
          ? account.providerAccountId
          : typeof token.discordUserId === "string"
            ? token.discordUserId
            : null;

      if (!discordUserId) {
        return token;
      }

      const discordProfile = profile as DiscordProfile | undefined;
      const displayName =
        discordProfile?.global_name?.trim() ||
        discordProfile?.username?.trim() ||
        (typeof token.name === "string" ? token.name : null) ||
        "Discord User";

      const appUser = await ensureUserByDiscord({
        discordUserId,
        fullName: displayName,
        timezone: env.APP_TIMEZONE
      });

      token.appUserId = appUser.id;
      token.discordUserId = discordUserId;

      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.appUserId === "string") {
        session.user.id = token.appUserId;
      }

      if (session.user && typeof token.discordUserId === "string") {
        session.user.discordUserId = token.discordUserId;
      }

      return session;
    }
  }
};
