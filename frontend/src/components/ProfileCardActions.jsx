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

// Action buttons row of a profile card:
// OPEN / START / ENGAGE / LOGIN / AVATAR / FAVORITES.
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
}) => (
  <div style={{
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
    padding: '8px 4px 4px',
    justifyContent: 'flex-end'
  }}>
    <button
      className="btn"
      onClick={() => onOpen(profile.id)}
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        color: 'white',
        border: '1px solid var(--border)',
        padding: '6px 12px',
        borderRadius: '8px',
        gap: '6px'
      }}
    >
      <ExternalLink size={14} />
      OPEN
    </button>

    <button
      className="btn"
      onClick={() => onStart(profile.id)}
      disabled={profile.status === 'uploading' || isEngaging}
      style={{
        background: profile.status === 'uploading' ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
        color: profile.status === 'uploading' ? 'var(--accent)' : 'white',
        border: '1px solid var(--border)',
        padding: '6px 12px',
        borderRadius: '8px',
        gap: '6px'
      }}
    >
      {profile.status === 'uploading' ? (
        <RefreshCw size={14} className="animate-pulse" />
      ) : (
        <Play size={14} fill="white" />
      )}
      {profile.status === 'uploading' ? 'ACTIVE' : 'START'}
    </button>

    {/* Auto Engage Button */}
    <button
      className="btn"
      onClick={() => (isEngaging ? onStopEngage(profile.id) : onEngage(profile.id))}
      disabled={profile.status === 'uploading'}
      title={isEngaging ? 'Dừng Auto Engage' : 'Bắt đầu xem & tương tác TikTok tự động'}
      style={{
        background: isEngaging ? 'rgba(239, 68, 68, 0.12)' : 'rgba(236, 72, 153, 0.08)',
        color: isEngaging ? '#EF4444' : '#EC4899',
        border: `1px solid ${isEngaging ? 'rgba(239,68,68,0.3)' : 'rgba(236,72,153,0.25)'}`,
        padding: '6px 12px',
        borderRadius: '8px',
        gap: '6px',
        fontWeight: '700',
        transition: 'all 0.2s',
        cursor: profile.status === 'uploading' ? 'not-allowed' : 'pointer'
      }}
    >
      {isEngaging ? (
        <>
          <StopCircle size={14} className="animate-pulse" />
          STOP
        </>
      ) : (
        <>
          <Heart size={14} />
          ENGAGE
        </>
      )}
    </button>

    {/* Login TikTok Button */}
    <button
      className="btn"
      onClick={() => (isLoggingIn ? onStopLoginTikTok(profile.id) : onLoginTikTok(profile.id))}
      disabled={profile.status === 'uploading' || (!profile.cookies && !profile.email && !profile.pass)}
      title={(!profile.cookies && !profile.email && !profile.pass) ? 'Profile chưa có cookies hoặc email/password. Import CSV trước.' : (isLoggingIn ? 'Dừng Login' : 'Login TikTok')}
      style={{
        background: isLoggingIn ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.08)',
        color: isLoggingIn ? '#EF4444' : '#10B981',
        border: `1px solid ${isLoggingIn ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}`,
        padding: '6px 12px',
        borderRadius: '8px',
        gap: '6px',
        fontWeight: '700',
        transition: 'all 0.2s',
        cursor: (profile.status === 'uploading' || (!profile.cookies && !profile.email && !profile.pass)) ? 'not-allowed' : 'pointer'
      }}
    >
      {isLoggingIn ? (
        <>
          <StopCircle size={14} className="animate-pulse" />
          STOP
        </>
      ) : (
        <>
          <LogIn size={14} />
          LOGIN
        </>
      )}
    </button>

    {/* Change Avatar Button */}
    <button
      className="btn"
      onClick={() => onChangeAvatar(profile.id)}
      disabled={profile.status === 'uploading' || !selectedAvatarPath || isChangingAvatar}
      title={!selectedAvatarPath ? 'Select an avatar image first' : (isChangingAvatar ? 'Avatar change in progress...' : 'Change TikTok avatar')}
      style={{
        background: isChangingAvatar ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)',
        color: isChangingAvatar ? '#3B82F6' : '#60A5FA',
        border: '1px solid rgba(59,130,246,0.25)',
        padding: '6px 12px',
        borderRadius: '8px',
        gap: '6px',
        fontWeight: '700',
        transition: 'all 0.2s',
        cursor: (profile.status === 'uploading' || !selectedAvatarPath) ? 'not-allowed' : 'pointer'
      }}
    >
      {isChangingAvatar ? (
        <RefreshCw size={14} className="animate-pulse" />
      ) : (
        <Camera size={14} />
      )}
      AVATAR
    </button>

    {/* Add Favorite Music Button */}
    <button
      className="btn"
      onClick={() => onAddFavoriteMusic(profile.id, musicSearchTerm || '')}
      disabled={
        profile.status === 'uploading' ||
        !musicSearchTerm ||
        !musicSearchTerm.trim() ||
        isAddingFavoriteMusic
      }
      title={
        !musicSearchTerm || !musicSearchTerm.trim()
          ? 'Enter a search term first'
          : isAddingFavoriteMusic
          ? 'Adding favorite music...'
          : 'Search and favorite a TikTok sound'
      }
      style={{
        background: isAddingFavoriteMusic ? 'rgba(168, 85, 247, 0.12)' : 'rgba(168, 85, 247, 0.08)',
        color: isAddingFavoriteMusic ? '#A855F7' : '#C084FC',
        border: '1px solid rgba(168,85,247,0.25)',
        padding: '6px 12px',
        borderRadius: '8px',
        gap: '6px',
        fontWeight: '700',
        transition: 'all 0.2s',
        cursor: (profile.status === 'uploading' || !musicSearchTerm || !musicSearchTerm.trim())
          ? 'not-allowed'
          : 'pointer'
      }}
    >
      {isAddingFavoriteMusic ? (
        <RefreshCw size={14} className="animate-pulse" />
      ) : (
        <Music size={14} />
      )}
      FAVORITES
    </button>
  </div>
);

export default ProfileCardActions;
