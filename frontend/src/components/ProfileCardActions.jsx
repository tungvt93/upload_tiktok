import React from 'react';
import { ExternalLink, Play, RefreshCw, StopCircle, Heart } from 'lucide-react';
import StatusBadge from './StatusBadge';

// Bottom action bar of a profile card: status badge + OPEN / START / ENGAGE.
const ProfileCardActions = ({ profile, isEngaging, onOpen, onStart, onEngage, onStopEngage, vpnCountry }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingBottom: '4px' }}>
    <StatusBadge status={profile.status} size="md" />

    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      <button
        className="btn"
        onClick={() => onOpen(profile.id, vpnCountry)}
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
        onClick={() => onStart(profile.id, vpnCountry)}
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
        onClick={() => (isEngaging ? onStopEngage(profile.id) : onEngage(profile.id, vpnCountry))}
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
    </div>
  </div>
);

export default ProfileCardActions;
