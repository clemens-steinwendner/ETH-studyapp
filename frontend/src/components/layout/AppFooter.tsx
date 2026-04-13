export function AppFooter() {
  return (
    <footer className="fixed bottom-0 left-64 right-0 h-8 bg-neutral-900 flex items-center justify-between px-4 z-50 border-t border-neutral-800">
      <div className="flex items-center gap-4">
        <span className="font-mono text-[10px] uppercase text-neutral-500">
          ETH Zurich | AI RAG Ingestion Active
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-[9px] text-emerald-500 uppercase tracking-tighter">
            System Ready
          </span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <a
          href="#"
          className="font-mono text-[10px] uppercase text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Documentation
        </a>
        <a
          href="#"
          className="font-mono text-[10px] uppercase text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          System Status
        </a>
      </div>
    </footer>
  );
}
