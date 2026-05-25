import { Modal } from "antd";
import { useTranslation } from "react-i18next";

interface RedisKeyDeleteModalProps {
  open: boolean;
  keys: string[];
  loading: boolean;
  error: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}

export function RedisKeyDeleteModal({ open, keys, loading, error, onClose, onSubmit }: RedisKeyDeleteModalProps) {
  const { t } = useTranslation();

  const isBatch = keys.length > 1;
  const previewKeys = keys.slice(0, 5);

  return (
    <Modal
      title={isBatch ? t("redis.browser.deleteKeys") : t("redis.browser.deleteKey")}
      open={open}
      onOk={() => void onSubmit()}
      onCancel={onClose}
      okText={t("common.delete")}
      cancelText={t("common.cancel")}
      confirmLoading={loading}
      okButtonProps={{ danger: true }}
    >
      <div className="redis-delete-modal" style={{ marginTop: "12px" }}>
        <div>{isBatch ? t("redis.browser.deleteBatchConfirm", { count: keys.length }) : t("redis.browser.deleteConfirm", { key: keys[0] ?? "" })}</div>
        {keys.length > 0 && (
          <div className="redis-delete-preview">
            {previewKeys.map((key) => (
              <div key={key} className="redis-delete-preview-item">{key}</div>
            ))}
            {keys.length > previewKeys.length && <div className="muted">{t("redis.browser.moreKeys", { count: keys.length - previewKeys.length })}</div>}
          </div>
        )}
        {error && <div className="text-danger">{error}</div>}
      </div>
    </Modal>
  );
}