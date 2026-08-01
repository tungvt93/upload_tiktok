// Shared status helpers for the TikTok Manager UI.
// Centralizes the status → color mapping and human-readable labels so that
// cards, badges and the detail modal stay consistent.

export const STATUS_LABELS = {
  idle: 'Idle',
  uploading: 'Uploading',
  engaging: 'Engaging',
  success: 'Success',
  error: 'Error',
  no_videos: 'No Videos'
};

export const getStatusColor = (status = 'idle') => {
  switch (status) {
    case 'uploading': return 'var(--accent)';
    case 'engaging': return '#EC4899';
    case 'success': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'no_videos': return '#EAB308';
    default: return 'var(--text-muted)';
  }
};

// Backwards-compatible alias.
export const statusColor = getStatusColor;
