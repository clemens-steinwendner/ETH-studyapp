"use client";

interface TerminalOutputProps {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export function TerminalOutput({ stdout, stderr, exitCode }: TerminalOutputProps) {
  return (
    <div className="bg-black font-mono text-sm p-3 h-full overflow-y-auto">
      {stdout && <pre className="text-green-400 whitespace-pre-wrap">{stdout}</pre>}
      {stderr && <pre className="text-red-400 whitespace-pre-wrap">{stderr}</pre>}
      {exitCode !== null && (
        <p className={`mt-1 ${exitCode === 0 ? "text-green-500" : "text-red-500"}`}>
          Exit code: {exitCode}
        </p>
      )}
      {!stdout && !stderr && exitCode === null && (
        <p className="text-gray-600">Run your code to see output here.</p>
      )}
    </div>
  );
}
