interface SuccessOverlayProps {
  open: boolean;
  icon: string;
  title: string;
  message: string;
  onClose: () => void;
  okText: string;
}

export function SuccessOverlay({
  open,
  icon,
  title,
  message,
  onClose,
  okText,
}: SuccessOverlayProps) {
  if (!open) return null;

  return (
    <div className="export-success-overlay" onClick={onClose}>
      <div className="export-success-modal" onClick={(event) => event.stopPropagation()}>
        <div className="export-success-icon">{icon}</div>
        <h3 className="export-success-title">{title}</h3>
        <p className="export-success-message">{message}</p>
        <button type="button" className="export-success-button" onClick={onClose}>
          {okText}
        </button>
      </div>
    </div>
  );
}
