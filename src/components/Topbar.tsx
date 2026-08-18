import Link from "next/link";
import { BellIcon, UserIcon } from "@/components/icons";

export function Topbar({
  name,
  companyName,
  unreadCount,
}: {
  name: string;
  companyName?: string | null;
  unreadCount: number;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-end gap-5 border-b border-gray-200 bg-white px-6">
      <Link href="/notifications" className="relative text-gray-500 hover:text-gray-700">
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </Link>
      <Link href="/profile" className="flex items-center gap-2 hover:opacity-80">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-600">
          <UserIcon className="h-5 w-5" />
        </span>
        <div className="text-sm leading-tight">
          <p className="font-medium text-gray-900">{name}</p>
          {companyName && <p className="text-xs text-gray-500">{companyName}</p>}
        </div>
      </Link>
    </header>
  );
}
