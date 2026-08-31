"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/authz";

async function requireAdmin() {
  const session = await auth();
  if (!session || !isAdmin(session)) throw new Error("Forbidden");
  return session;
}

export async function createClientAction(_prevState: string | undefined, formData: FormData) {
  await requireAdmin();

  const companyName = (formData.get("companyName") as string).trim();
  const contactName = (formData.get("contactName") as string).trim();
  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = (formData.get("password") as string) || "password123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return "That email is already in use by another account.";
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const company = await prisma.company.create({ data: { name: companyName } });
  await prisma.user.create({
    data: { name: contactName, email, passwordHash, role: "CLIENT", companyId: company.id },
  });

  redirect("/admin");
}

export async function createClientContactAction(companyId: string, _prevState: string | undefined, formData: FormData) {
  await requireAdmin();

  const contactName = (formData.get("contactName") as string).trim();
  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = (formData.get("password") as string) || "password123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !existing.deactivatedAt) {
    return "That email is already in use by an active account.";
  }

  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    // Previously removed - reactivate under this company instead of failing
    // on the duplicate email, same as team member re-hiring.
    await prisma.user.update({
      where: { id: existing.id },
      data: { name: contactName, passwordHash, role: "CLIENT", companyId, deactivatedAt: null },
    });
  } else {
    await prisma.user.create({ data: { name: contactName, email, passwordHash, role: "CLIENT", companyId } });
  }

  redirect("/admin");
}

export async function createTeamMemberAction(_prevState: string | undefined, formData: FormData) {
  await requireAdmin();

  const name = (formData.get("name") as string).trim();
  const email = (formData.get("email") as string).trim().toLowerCase();
  const password = (formData.get("password") as string) || "password123";
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "INTERNAL";

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && !existing.deactivatedAt) {
    return "That email is already in use by an active account.";
  }

  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    // They were previously removed - reactivate them instead of failing on
    // the duplicate email, so re-hiring someone (or fixing a mistake) works.
    await prisma.user.update({
      where: { id: existing.id },
      data: { name, passwordHash, role, deactivatedAt: null },
    });
  } else {
    await prisma.user.create({ data: { name, email, passwordHash, role } });
  }

  redirect("/admin");
}

export async function removeTeamMemberAction(userId: string) {
  const session = await requireAdmin();
  if (userId === session.user.id) throw new Error("You can't remove your own account");

  // Deactivate rather than delete - they lose access to everything, but
  // their name stays attached to the messages, documents, tasks, and call
  // logs they already authored, so project history keeps making sense.
  await prisma.user.update({ where: { id: userId }, data: { deactivatedAt: new Date() } });
  await prisma.projectMember.deleteMany({ where: { userId } });
  await prisma.project.updateMany({ where: { pocId: userId }, data: { pocId: null } });

  revalidatePath("/admin");
}

export async function createProjectAction(formData: FormData) {
  const session = await requireAdmin();

  const code = (formData.get("code") as string).trim();
  const name = (formData.get("name") as string).trim();
  const description = (formData.get("description") as string) || null;
  const companyId = formData.get("companyId") as string;
  const startDate = formData.get("startDate") as string | null;
  const dueDate = formData.get("dueDate") as string | null;
  const memberIds = formData.getAll("memberIds") as string[];

  await prisma.project.create({
    data: {
      code,
      name,
      description,
      companyId,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      members: {
        create: (memberIds.length > 0 ? memberIds : [session.user.id]).map((userId) => ({ userId })),
      },
    },
  });

  redirect("/admin");
}
