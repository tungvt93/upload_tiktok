// Shared status helpers for the TikTok Manager UI.
// Centralizes the status → color mapping and human-readable labels so that
// cards, badges and modals stay consistent.

export const STATUS_LABELS = {
  idle: 'Idle',
  uploading: 'Uploading',
  logging_in: 'Logging In',
  engaging: 'Engaging',
  changing_avatar: 'Changing Avatar',
  adding_favorite_music: 'Adding Music',
  success: 'Success',
  error: 'Error',
  no_videos: 'No Videos'
};

export const getStatusColor = (status = 'idle') => {
  switch (status) {
    case 'uploading': return 'var(--accent)';
    case 'logging_in': return '#10B981';
    case 'engaging': return '#EC4899';
    case 'changing_avatar': return '#3B82F6';
    case 'adding_favorite_music': return '#A855F7';
    case 'success': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'no_videos': return '#EAB308';
    default: return 'var(--text-muted)';
  }
};

// Backwards-compatible alias.
export const statusColor = getStatusColor;
