import AppProviders from "./app/providers/AppProviders";
import AppShell from "./app/shell/AppShell";

function App() {
  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}

export default App;