import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { deactivatedAt: true } });
  if (!currentUser || currentUser.deactivatedAt) redirect("/login");

  const [unreadCount, company] = await Promise.all([
    prisma.notification.count({ where: { userId: session.user.id, read: false } }),
    session.user.companyId
      ? prisma.company.findUnique({ where: { id: session.user.companyId } })
      : Promise.resolve(null),
  ]);

  const isAdmin = session.user.role === "ADMIN";

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar isAdmin={isAdmin} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          name={session.user.name ?? session.user.email ?? "User"}
          companyName={company?.name}
          unreadCount={unreadCount}
        />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">{children}</main>
      </div>
    </div>
  );
}
