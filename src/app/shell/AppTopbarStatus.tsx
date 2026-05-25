interface AppTopbarStatusProps {
  activeEngineLabel: string;
  activeConnectionStatus: string;
  visible: boolean;
}

export default function AppTopbarStatus({
  activeEngineLabel,
  activeConnectionStatus,
  visible,
}: AppTopbarStatusProps) {
  if (!visible) {
    return null;
  }

  return <span className={`mdb-window-chip status-${activeConnectionStatus}`}>{activeEngineLabel}</span>;
}