import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Globe,
  FolderOpen,
  Users,
  Link,
  Music,
  Zap,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
  CalendarClock,
  Activity
} from 'lucide-react';
import { motion } from 'framer-motion';
import { getStatusColor, STATUS_LABELS } from '../status';

// ---------------------------------------------------------------------------
// Reusable, self-contained profile detail component.
// Renders its own modal overlay + sectioned field layout. Depends only on the
// `profile` shape returned by GET /api/profiles (see backend/server.js).
//
// Props:
//   profile  – the profile object to display (required)
//   onClose  – callback invoked when the modal is dismissed (required)
//   title    – optional heading text (default: "Profile Details")
// ---------------------------------------------------------------------------

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString();
};

const Section = ({ title, icon: Icon, children }) => (
  <div style={{ marginBottom: '20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
      {Icon && <Icon size={14} color="var(--text-muted)" />}
      <span
        style={{
          fontSize: '0.7rem',
          fontWeight: '700',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)'
        }}
      >
        {title}
      </span>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      {children}
    </div>
  </div>
);

const Field = ({ label, value, mono }) => (
  <div
    style={{
      padding: '12px',
      borderRadius: '12px',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid var(--border)',
      minWidth: 0
    }}
  >
    <div
      style={{
        fontSize: '0.66rem',
        color: 'var(--text-muted)',
        marginBottom: '5px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: '0.9rem',
        fontWeight: '600',
        wordBreak: 'break-word',
        fontFamily: mono ? 'monospace' : 'inherit',
        lineHeight: 1.45
      }}
    >
      {value}
    </div>
  </div>
);

const Muted = ({ children }) => (
  <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontWeight: '400' }}>{children}</span>
);

const BoolBadge = ({ value }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '3px 10px',
      borderRadius: '999px',
      fontSize: '0.72rem',
      fontWeight: '700',
      background: value ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
      color: value ? 'var(--success)' : 'var(--error)',
      border: `1px solid ${value ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
    }}
  >
    <span
      style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: value ? 'var(--success)' : 'var(--error)'
      }}
    />
    {value ? 'Yes' : 'No'}
  </span>
);

const SchedulesChips = ({ schedules }) => {
  if (!Array.isArray(schedules) || schedules.length === 0) {
    return <Muted>None</Muted>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
      {schedules.map((time, i) => (
        <span
          key={`${time}-${i}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 10px',
            borderRadius: '999px',
            fontSize: '0.72rem',
            fontWeight: '700',
            background: 'rgba(56, 189, 248, 0.12)',
            color: 'var(--accent)',
            border: '1px solid rgba(56, 189, 248, 0.3)'
          }}
        >
          <Clock size={11} />
          {time}
        </span>
      ))}
    </div>
  );
};

const ProfileDetail = ({ profile, onClose, title = 'Profile Details' }) => {
  const [copied, setCopied] = useState(false);
  const [showJson, setShowJson] = useState(false);

  if (!profile) return null;

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(profile, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const color = getStatusColor(profile.status);
  const statusLabel = STATUS_LABELS[profile.status] || profile.status || 'Idle';
  const created = formatDate(profile.created_at);
  const lastRun = formatDate(profile.last_run);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '24px'
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="glass"
        style={{
          width: '100%',
          maxWidth: '680px',
          padding: '24px',
          borderRadius: '20px',
          maxHeight: '86vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div
              style={{
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 4px 12px rgba(255, 63, 182, 0.3)'
              }}
            >
              <Globe size={24} color="white" />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text)' }}>
                  {profile.name}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 10px',
                    borderRadius: '999px',
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: `color-mix(in srgb, ${color} 14%, transparent)`,
                    color,
                    border: `1px solid ${color}`
                  }}
                >
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={copyJson}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.78rem',
                transition: 'all 0.2s'
              }}
            >
              {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
            <button
              onClick={() => setShowJson((v) => !v)}
              title={showJson ? 'Hide raw JSON' : 'Show raw JSON'}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.2s'
              }}
            >
              {showJson ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '8px'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Identity */}
        <Section title="Identity" icon={Users}>
          <Field label="Profile ID" value={<Muted>{profile.id || 'N/A'}</Muted>} mono />
          <Field
            label="Group"
            value={
              profile.group_name ? (
                <>
                  <Users size={12} style={{ verticalAlign: '-1px', marginRight: 5, color: 'var(--primary)' }} />
                  {profile.group_name}
                </>
              ) : (
                <Muted>None</Muted>
              )
            }
          />
          <Field
            label="Created At"
            value={created ? <Muted>{created}</Muted> : <Muted>Unknown</Muted>}
          />
        </Section>

        {/* Upload */}
        <Section title="Upload" icon={FolderOpen}>
          <Field
            label="Video Folder"
            value={profile.video_folder ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <FolderOpen size={12} style={{ flexShrink: 0, color: 'var(--accent)' }} />
                {profile.video_folder}
              </span>
            ) : (
              <Muted>Global default</Muted>
            )}
            mono
          />
          <Field label="Upload Count" value={profile.upload_count ?? 1} />
          <Field
            label="Channel IDs"
            value={profile.channel_ids ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Link size={12} style={{ flexShrink: 0, color: 'var(--accent)' }} />
                {profile.channel_ids}
              </span>
            ) : (
              <Muted>None</Muted>
            )}
            mono
          />
          <Field
            label="Set Music"
            value={<BoolBadge value={!!profile.set_music} />}
          />
          <Field
            label="Needs Render"
            value={<BoolBadge value={!!profile.needs_render} />}
          />
          <Field
            label="Remove Title"
            value={<BoolBadge value={!!profile.remove_title} />}
          />
        </Section>

        {/* Network */}
        <Section title="Network" icon={Globe}>
          <Field
            label="Proxy"
            value={
              profile.proxy ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={12} style={{ flexShrink: 0, color: 'var(--accent)' }} />
                  {profile.proxy}
                </span>
              ) : (
                <Muted>None</Muted>
              )
            }
            mono
          />
        </Section>

        {/* Scheduling */}
        <Section title="Scheduling" icon={CalendarClock}>
          <Field label="Is Scheduled" value={<BoolBadge value={!!profile.is_scheduled} />} />
          <Field label="Auto Increment (10m)" value={<BoolBadge value={!!profile.auto_increment_schedule} />} />
          <Field label="Daily Times" value={<SchedulesChips schedules={profile.schedules} />} />
        </Section>

        {/* Activity */}
        <Section title="Activity" icon={Activity}>
          <Field
            label="Last Run"
            value={
              lastRun ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={12} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                  {lastRun}
                </span>
              ) : (
                <Muted>Never run</Muted>
              )
            }
          />
        </Section>

        {/* Raw JSON preview */}
        {showJson && (
          <motion.pre
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginTop: '8px',
              padding: '14px',
              borderRadius: '12px',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1px solid var(--border)',
              fontSize: '0.72rem',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'var(--text-muted)',
              maxHeight: '260px',
              overflowY: 'auto'
            }}
          >
            {JSON.stringify(profile, null, 2)}
          </motion.pre>
        )}

        {/* Feature legend */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginTop: '4px',
            paddingTop: '14px',
            borderTop: '1px solid var(--border)'
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)'
            }}
          >
            <Zap size={12} color="var(--primary)" /> Render bypass
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)'
            }}
          >
            <Trash2 size={12} color="var(--error)" /> Remove title
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)'
            }}
          >
            <Music size={12} color="var(--accent)" /> Set music
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ProfileDetail;
