import { isWails, waitForWails } from "../wailsapi";

function describeDesktopRuntime() {
  return (
    `window.go: ${typeof window.go}, ` +
    `window.go.app: ${typeof window.go?.app}, ` +
    `window.go.app.App: ${typeof window.go?.app?.App}, ` +
    `window.go.backend: ${typeof window.go?.backend}, ` +
    `window.go.backend.App: ${typeof window.go?.backend?.App}, ` +
    `window.go.main: ${typeof window.go?.main}, ` +
    `window.go.main.App: ${typeof window.go?.main?.App}`
  );
}

export async function requireDesktop(featureName = "Desktop operations") {
  await waitForWails();

  if (!isWails()) {
    throw new Error(`${featureName} require desktop mode (Wails). ${describeDesktopRuntime()}`);
  }
}