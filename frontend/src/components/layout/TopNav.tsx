"use client";

interface TopNavProps {
  title?: string;
  subtitle?: string;
  budgetPct?: number;
  extra?: React.ReactNode;
}

export function TopNav({ title = "Technical Workbench", subtitle, budgetPct, extra }: TopNavProps) {
  return (
    <header className="flex justify-between items-center w-full px-6 py-2 sticky top-0 z-40 bg-neutral-100 border-b border-surface-container">
      <div className="flex items-center gap-6 font-mono text-xs font-medium uppercase tracking-widest">
        <span className="text-sm font-black text-neutral-900 font-['Inter']">{title}</span>
        <div className="h-4 w-px bg-neutral-300" />
        {subtitle && (
          <span className="text-[#A31B1F] font-bold">{subtitle}</span>
        )}
        {budgetPct !== undefined && (
          <div className="flex items-center gap-2">
            <span
              className={`font-bold ${budgetPct >= 80 ? "text-[#A31B1F]" : "text-neutral-600"}`}
            >
              API Usage: {budgetPct}%
            </span>
            <div className="w-20 h-1.5 bg-neutral-300 rounded-full overflow-hidden">
              <div
                className="bg-primary-container h-full transition-all"
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        {extra}
        <button className="p-1 text-neutral-600 hover:text-[#A31B1F] transition-colors">
          <span className="material-symbols-outlined">account_tree</span>
        </button>
        <button className="p-1 text-neutral-600 hover:text-[#A31B1F] transition-colors">
          <span className="material-symbols-outlined">memory</span>
        </button>
      </div>
    </header>
  );
}
