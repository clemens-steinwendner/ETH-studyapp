"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

interface CodeEditorProps {
  language: "python" | "sql" | "haskell" | "latex";
  value: string;
  onChange: (value: string) => void;
}

const LANGUAGE_MAP: Record<string, string> = {
  python: "python",
  sql: "sql",
  haskell: "haskell",
  latex: "latex",
};

export function CodeEditor({ language, value, onChange }: CodeEditorProps) {
  return (
    <MonacoEditor
      height="100%"
      language={LANGUAGE_MAP[language] ?? "plaintext"}
      value={value}
      theme="vs-dark"
      onChange={(v) => onChange(v ?? "")}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        wordWrap: "on",
        scrollBeyondLastLine: false,
      }}
    />
  );
}
