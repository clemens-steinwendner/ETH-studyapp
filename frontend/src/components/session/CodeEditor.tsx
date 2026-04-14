"use client";

import { useEffect, useRef } from "react";
import type * as Monaco from "monaco-editor";

interface CodeEditorProps {
  language: "python" | "sql" | "haskell" | "latex";
  value: string;
  onChange: (value: string) => void;
}

const LANGUAGE_MAP: Record<string, string> = {
  python: "python",
  sql: "sql",
  haskell: "plaintext",
  latex: "plaintext",
};

export function CodeEditor({ language, value, onChange }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Create editor once on mount
  useEffect(() => {
    if (!containerRef.current) return;
    let editor: Monaco.editor.IStandaloneCodeEditor;

    import("monaco-editor").then((monaco) => {
      if (!containerRef.current) return;
      editor = monaco.editor.create(containerRef.current, {
        value: "",
        language: LANGUAGE_MAP[language] ?? "plaintext",
        theme: "vs-dark",
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: "on",
        wordWrap: "on",
        scrollBeyondLastLine: false,
        automaticLayout: true,
      });
      editor.onDidChangeModelContent(() => {
        onChangeRef.current(editor.getValue());
      });
      editorRef.current = editor;
    });

    return () => {
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync value when parent changes it (e.g., clear on next question)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() !== value) {
      editor.setValue(value);
    }
  }, [value]);

  // Sync language
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;
    import("monaco-editor").then((monaco) => {
      monaco.editor.setModelLanguage(model, LANGUAGE_MAP[language] ?? "plaintext");
    });
  }, [language]);

  return <div ref={containerRef} style={{ height: "100%", width: "100%" }} />;
}
