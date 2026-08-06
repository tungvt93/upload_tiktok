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
  <div className="card-actions">
    <button
      className="btn btn-sm btn-card"
      onClick={() => onOpen(profile.id)}
    >
      <ExternalLink size={14} />
      OPEN
    </button>

    <button
      className={`btn btn-sm ${profile.status === 'uploading' ? 'btn-card--accent' : 'btn-card'}`}
      onClick={() => onStart(profile.id)}
      disabled={profile.status === 'uploading' || isEngaging}
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
      className={`btn btn-sm ${isEngaging ? 'btn-engage--active' : 'btn-engage'}`}
      onClick={() => (isEngaging ? onStopEngage(profile.id) : onEngage(profile.id))}
      disabled={profile.status === 'uploading'}
      title={isEngaging ? 'Dừng Auto Engage' : 'Bắt đầu xem & tương tác TikTok tự động'}
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
      className={`btn btn-sm ${isLoggingIn ? 'btn-login--active' : 'btn-login'}`}
      onClick={() => (isLoggingIn ? onStopLoginTikTok(profile.id) : onLoginTikTok(profile.id))}
      disabled={profile.status === 'uploading' || (!profile.cookies && !profile.email && !profile.pass)}
      title={(!profile.cookies && !profile.email && !profile.pass) ? 'Profile chưa có cookies hoặc email/password. Import CSV trước.' : (isLoggingIn ? 'Dừng Login' : 'Login TikTok')}
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
      className={`btn btn-sm ${isChangingAvatar ? 'btn-avatar--active' : 'btn-avatar'}`}
      onClick={() => onChangeAvatar(profile.id)}
      disabled={profile.status === 'uploading' || !selectedAvatarPath || isChangingAvatar}
      title={!selectedAvatarPath ? 'Select an avatar image first' : (isChangingAvatar ? 'Avatar change in progress...' : 'Change TikTok avatar')}
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
      className={`btn btn-sm ${isAddingFavoriteMusic ? 'btn-music--active' : 'btn-music'}`}
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
