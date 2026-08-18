import Link from "next/link";
import { DashboardIcon, LogoutIcon, ShieldIcon } from "@/components/icons";
import { logoutAction } from "@/app/(app)/actions";

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
        <span className="font-bold text-gray-900">Client Project Portal</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
        >
          <DashboardIcon className="h-5 w-5 text-gray-500" />
          Dashboard
        </Link>
        {isAdmin && (
          <>
            <div className="my-2 border-t border-gray-200" />
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <ShieldIcon className="h-5 w-5 text-gray-500" />
              Admin Console
            </Link>
          </>
        )}
      </nav>
      <form action={logoutAction} className="border-t border-gray-200 p-3">
        <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
          <LogoutIcon className="h-5 w-5 text-gray-500" />
          Logout
        </button>
      </form>
    </aside>
  );
}
