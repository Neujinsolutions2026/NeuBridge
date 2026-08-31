import Link from "next/link";
import Image from "next/image";
import { DashboardIcon, LogoutIcon, ShieldIcon } from "@/components/icons";
import { logoutAction } from "@/app/(app)/actions";

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center justify-center border-b border-gray-200 px-4">
        <Image src="/Neubridge.png" alt="Neubridge" width={140} height={51} priority />
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
