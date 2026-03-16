import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const discordUserId = process.env.SEED_DISCORD_USER_ID?.trim();

  if (!discordUserId) {
    console.log("Seed skipped: set SEED_DISCORD_USER_ID to create/update a user.");
    return;
  }

  const fullName = process.env.SEED_USER_FULL_NAME ?? "Discord User";
  const timezone = process.env.APP_TIMEZONE ?? "Asia/Jakarta";

  const user = await prisma.user.upsert({
    where: { discord_user_id: discordUserId },
    update: {
      full_name: fullName,
      timezone
    },
    create: {
      full_name: fullName,
      discord_user_id: discordUserId,
      timezone
    }
  });

  console.log("Seed success:", {
    id: user.id,
    full_name: user.full_name,
    discord_user_id: user.discord_user_id,
    timezone: user.timezone
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
