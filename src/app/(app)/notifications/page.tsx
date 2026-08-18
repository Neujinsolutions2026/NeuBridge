import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markAllReadAction } from "./actions";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session) return null;

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    include: { project: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
        <form action={markAllReadAction}>
          <button className="text-xs font-medium text-blue-600 hover:underline">Mark all as read</button>
        </form>
      </div>

      <div className="mt-6 divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {notifications.map((n) => (
          <Link
            key={n.id}
            href={n.projectId ? `/projects/${n.projectId}` : "/dashboard"}
            className={`flex items-start justify-between gap-4 px-5 py-3 hover:bg-gray-50 ${!n.read ? "bg-blue-50/40" : ""}`}
          >
            <div>
              <p className="text-sm text-gray-800">{n.message}</p>
              {n.project && <p className="text-xs text-gray-400">{n.project.code}</p>}
            </div>
            <p className="whitespace-nowrap text-xs text-gray-400">
              {n.createdAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          </Link>
        ))}
        {notifications.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-gray-400">No notifications yet.</p>
        )}
      </div>
    </div>
  );
}
