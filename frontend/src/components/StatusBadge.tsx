import type { VideoStatus } from '../types/video';

const STATUS_STYLES: Record<VideoStatus, { background: string; color: string; label: string }> = {
  UPLOADING: { background: '#fff3cd', color: '#856404', label: 'Uploading' },
  UPLOADED: { background: '#cce5ff', color: '#004085', label: 'Uploaded' },
  PROCESSING: { background: '#d1ecf1', color: '#0c5460', label: 'Processing' },
  READY: { background: '#d4edda', color: '#155724', label: 'Ready' },
  FAILED: { background: '#f8d7da', color: '#721c24', label: 'Failed' },
};

export default function StatusBadge({ status }: { status: VideoStatus }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.UPLOADING;
  return (
    <span
      className="status-badge"
      style={{ background: style.background, color: style.color }}
    >
      {style.label}
    </span>
  );
}
