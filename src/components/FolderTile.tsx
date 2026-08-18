import Link from "next/link";

export function FolderTile({
  href,
  label,
  sublabel,
  count,
}: {
  href: string;
  label: string;
  sublabel?: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      title={sublabel ? `${label} (${sublabel})` : label}
      className="group flex w-28 shrink-0 flex-col items-center gap-2 rounded-lg p-3 text-center hover:bg-gray-50"
    >
      <div className="relative h-16 w-20">
        <div className="absolute left-0 top-0 h-4 w-9 rounded-t-md bg-amber-400" />
        <div className="absolute inset-x-0 bottom-0 top-2.5 rounded-md rounded-tl-none bg-gradient-to-b from-amber-300 to-amber-500 shadow-sm ring-1 ring-black/5 transition-transform group-hover:-translate-y-0.5" />
        {typeof count === "number" && count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1 text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
      </div>
      <div className="w-full min-w-0">
        <p className="truncate text-sm font-medium text-gray-800 group-hover:text-gray-900">{label}</p>
        {sublabel && <p className="truncate text-xs text-gray-400">{sublabel}</p>}
      </div>
    </Link>
  );
}
