import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Run once against production after the first deploy to create the one
// account you can log in with. Does not touch demo companies/projects -
// prisma/seed.ts is for local dev only.
async function main() {
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD before running this script, e.g.\n" +
        '  ADMIN_NAME="Your Name" ADMIN_EMAIL="you@company.com" ADMIN_PASSWORD="..." DATABASE_URL="..." npx tsx prisma/seed-admin.ts'
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash, role: Role.ADMIN, deactivatedAt: null },
    create: { name, email, passwordHash, role: Role.ADMIN },
  });

  console.log(`Admin account ready: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
