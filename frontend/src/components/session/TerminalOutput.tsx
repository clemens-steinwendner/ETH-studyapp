"use client";

interface TerminalOutputProps {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export function TerminalOutput({ stdout, stderr, exitCode }: TerminalOutputProps) {
  const hasOutput = stdout || stderr || exitCode !== null;
  const passed = exitCode === 0;

  return (
    <div className="h-full flex flex-col bg-black/40 terminal-glow">
      {/* Tab bar */}
      <div className="flex items-center gap-4 px-4 py-1.5 bg-black/20 text-[10px] font-mono text-neutral-500 border-b border-white/5 flex-shrink-0">
        <span className="text-white border-b border-primary-container pb-0.5">Terminal</span>
        <span className="cursor-pointer hover:text-neutral-300">Output</span>
        <span className="cursor-pointer hover:text-neutral-300">Debug Console</span>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1">
        {!hasOutput && (
          <div className="text-neutral-600 italic">Run your code to see output here.</div>
        )}

        {stdout && (
          <>
            <div className="flex items-start gap-2">
              <span className="text-emerald-500 font-bold">$</span>
              <span className="text-neutral-300 italic">executing…</span>
            </div>
            <pre className="text-white bg-primary-container/20 border-l-2 border-primary-container p-2 whitespace-pre-wrap">
              {stdout}
            </pre>
          </>
        )}

        {stderr && (
          <pre className="text-red-400 whitespace-pre-wrap">
            {stderr}
          </pre>
        )}

        {exitCode !== null && (
          <div className="flex items-center gap-3 pt-2">
            <span
              className={`px-2 py-0.5 text-[9px] font-bold border rounded-sm ${
                passed
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border-red-500/20"
              }`}
            >
              {passed ? "UNIT TESTS PASSED" : `EXIT CODE: ${exitCode}`}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
