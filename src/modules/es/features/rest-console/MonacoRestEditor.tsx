import Editor, { loader, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useCallback, useRef } from "react";

// Use CDN for monaco workers — unpkg is more reliable than jsDelivr in some regions
loader.config({
  paths: {
    vs: "https://unpkg.com/monaco-editor@0.55.1/min/vs",
  },
});

interface MonacoRestEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string | number;
  language?: string;
  readOnly?: boolean;
}

export function MonacoRestEditor({
  value,
  onChange,
  height = "300px",
  language = "json",
  readOnly = false,
}: MonacoRestEditorProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const handleEditorDidMount = useCallback((editor: Parameters<OnMount>[0]) => {
    editorRef.current = editor;
    // Ctrl+Enter to execute
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      window.dispatchEvent(new CustomEvent("monaco-rest-execute"));
    });
  }, []);

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      onChange={(val) => onChange(val ?? "")}
      onMount={handleEditorDidMount}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: "'SF Mono', Menlo, Consolas, monospace",
        lineNumbers: "on",
        lineDecorationsWidth: 0,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: "off",
        tabSize: 2,
        insertSpaces: true,
        bracketPairColorization: { enabled: true },
        guides: { bracketPairs: true, indentation: true },
        readOnly,
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        padding: { top: 0, bottom: 0 },
      }}
    />
  );
}
