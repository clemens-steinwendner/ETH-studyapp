"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "book_2", label: "Library" },
  { href: "/session/new", icon: "science", label: "Study" },
  { href: "/budget", icon: "payments", label: "Budget" },
  { href: "/history", icon: "history", label: "History" },
];


export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    if (href === "/session/new") return pathname.startsWith("/session");
    return pathname.startsWith(href);
  }

  return (
    <aside className="h-full w-64 fixed left-0 top-0 bg-neutral-50 flex flex-col py-6 z-50 border-r border-neutral-200">
      <div className="px-6 mb-10">
        <h1 className="font-bold text-[#A31B1F] tracking-tighter uppercase text-xl leading-none">
          ETH Zurich
        </h1>
        <p className="font-mono text-[10px] tracking-widest uppercase text-neutral-500 mt-1">
          AI Study Assistant
        </p>
      </div>

      <nav className="flex-1 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-6 py-3 text-sm transition-all duration-150 ${
                active
                  ? "text-[#A31B1F] font-bold border-r-2 border-[#A31B1F] bg-neutral-200"
                  : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/50"
              }`}
            >
              <span className="material-symbols-outlined mr-3 text-[20px]">
                {item.icon}
              </span>
              <span className="font-['Inter'] text-[0.875rem] leading-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
