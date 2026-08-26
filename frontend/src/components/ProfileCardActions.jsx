import React from 'react';
import {
  ExternalLink,
  Play,
  RefreshCw,
  StopCircle,
  Heart,
  LogIn,
  Camera,
  Music
} from 'lucide-react';
import IconActionButton from './IconActionButton';

// Icon-only actions for a profile row. Hover uses the instant data-tooltip toast.
const ProfileCardActions = ({
  profile,
  onOpen,
  onStart,
  isEngaging,
  onEngage,
  onStopEngage,
  isLoggingIn,
  onLoginTikTok,
  onStopLoginTikTok,
  onChangeAvatar,
  isChangingAvatar,
  selectedAvatarPath,
  onAddFavoriteMusic,
  isAddingFavoriteMusic,
  musicSearchTerm
}) => {
  const canLogin = profile.cookies || profile.email || profile.pass;
  const uploading = profile.status === 'uploading';
  const hasMusic = Boolean(musicSearchTerm && musicSearchTerm.trim());

  return (
    <div className="table-actions">
      <IconActionButton
        icon={<ExternalLink size={15} />}
        onClick={() => onOpen(profile.id)}
        title="Mở profile"
        color="var(--text)"
        bg="rgba(255, 255, 255, 0.05)"
        border="var(--border)"
        size="30px"
      />
      <IconActionButton
        icon={uploading ? <RefreshCw size={15} className="animate-pulse" /> : <Play size={15} fill="currentColor" />}
        onClick={() => onStart(profile.id)}
        disabled={uploading || isEngaging}
        title={uploading ? 'Đang upload' : 'Bắt đầu upload'}
        color={uploading ? 'var(--accent)' : 'var(--text)'}
        bg={uploading ? 'transparent' : 'rgba(255, 255, 255, 0.05)'}
        border="var(--border)"
        size="30px"
      />
      <IconActionButton
        icon={isEngaging ? <StopCircle size={15} className="animate-pulse" /> : <Heart size={15} />}
        onClick={() => (isEngaging ? onStopEngage(profile.id) : onEngage(profile.id))}
        disabled={uploading}
        title={isEngaging ? 'Dừng Auto Engage' : 'Bắt đầu xem & tương tác TikTok tự động'}
        color={isEngaging ? 'var(--error)' : 'var(--status-engage)'}
        bg={isEngaging ? 'rgba(239, 68, 68, 0.12)' : 'rgba(236, 72, 153, 0.08)'}
        border={isEngaging ? 'rgba(239,68,68,0.3)' : 'rgba(236,72,153,0.25)'}
        size="30px"
      />
      <IconActionButton
        icon={isLoggingIn ? <StopCircle size={15} className="animate-pulse" /> : <LogIn size={15} />}
        onClick={() => (isLoggingIn ? onStopLoginTikTok(profile.id) : onLoginTikTok(profile.id))}
        disabled={uploading || !canLogin}
        title={!canLogin ? 'Profile chưa có cookies hoặc email/password. Import CSV trước.' : (isLoggingIn ? 'Dừng Login' : 'Login TikTok')}
        color={isLoggingIn ? 'var(--error)' : 'var(--success)'}
        bg={isLoggingIn ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.08)'}
        border={isLoggingIn ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}
        size="30px"
      />
      <IconActionButton
        icon={isChangingAvatar ? <RefreshCw size={15} className="animate-pulse" /> : <Camera size={15} />}
        onClick={() => onChangeAvatar(profile.id)}
        disabled={uploading || !selectedAvatarPath || isChangingAvatar}
        title={!selectedAvatarPath ? 'Select an avatar image first' : (isChangingAvatar ? 'Avatar change in progress...' : 'Change TikTok avatar')}
        color={isChangingAvatar ? 'var(--status-avatar-active)' : 'var(--status-avatar)'}
        bg={isChangingAvatar ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)'}
        border="rgba(59,130,246,0.25)"
        size="30px"
      />
      <IconActionButton
        icon={isAddingFavoriteMusic ? <RefreshCw size={15} className="animate-pulse" /> : <Music size={15} />}
        onClick={() => onAddFavoriteMusic(profile.id, musicSearchTerm || '')}
        disabled={uploading || !hasMusic || isAddingFavoriteMusic}
        title={
          !hasMusic
            ? 'Enter a search term first'
            : isAddingFavoriteMusic
              ? 'Adding favorite music...'
              : 'Search and favorite a TikTok sound'
        }
        color={isAddingFavoriteMusic ? 'var(--status-music-active)' : 'var(--status-music)'}
        bg={isAddingFavoriteMusic ? 'rgba(168, 85, 247, 0.12)' : 'rgba(168, 85, 247, 0.08)'}
        border="rgba(168,85,247,0.25)"
        size="30px"
      />
    </div>
  );
};

export default ProfileCardActions;
