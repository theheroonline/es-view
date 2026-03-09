/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLATFORM: "browser" | "tauri";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
