import React from 'react';
import { FolderOpen, Video, Link, Users, Clock, Zap, Trash2, Music } from 'lucide-react';
import ToggleField from './ToggleField';
import VPNCountrySelect from './VPNCountrySelect';

// Expandable editing area of a profile card: group, upload folder, proxy,
// channel IDs, scheduling (with times + upload count), toggles and VPN country.
const ProfileSettings = ({
  profile,
  groups,
  onUpdateGroup,
  onUpdateFolder,
  onSelectFolder,
  onUpdateProxy,
  onUpdateChannelIds,
  onUpdateSchedule,
  onUpdateSchedules,
  onUpdateAutoIncrementSchedule,
  onUpdateUploadCount,
  onUpdateNeedsRender,
  onUpdateRemoveTitle,
  onUpdateSetMusic,
  vpnCountry,
  setVpnCountry
}) => (
  <div style={{ paddingTop: '20px' }}>
    {/* Group */}
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <FolderOpen size={14} color="var(--text-muted)" />
        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Group</span>
      </div>
      <select
        className="input"
        style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
        value={profile.group_id || ''}
        onChange={(e) => {
          const v = e.target.value;
          onUpdateGroup(profile.id, v === '' ? null : v);
        }}
      >
        <option value="">No group</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>{g.name}</option>
        ))}
      </select>
    </div>

    {/* Upload Folder */}
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Video size={14} color="var(--text-muted)" />
        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Upload Folder</span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          className="input"
          style={{ fontSize: '0.75rem', padding: '8px 12px', flex: 1 }}
          placeholder="Global Default"
          value={profile.video_folder || ''}
          onChange={(e) => onUpdateFolder(profile.id, e.target.value)}
        />
        <button
          onClick={() => onSelectFolder(profile.id)}
          className="btn-secondary"
          style={{ padding: '8px', minWidth: 'auto' }}
        >
          <FolderOpen size={14} />
        </button>
      </div>
    </div>

    {/* Proxy */}
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Link size={14} color="var(--text-muted)" />
        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Proxy Server (Optional)</span>
      </div>
      <input
        className="input"
        style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
        placeholder="http://user:pass@host:port"
        value={profile.proxy || ''}
        onChange={(e) => onUpdateProxy(profile.id, e.target.value)}
      />
    </div>

    {/* Channel IDs */}
    <div style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <Users size={14} color="var(--text-muted)" />
        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Channel IDs (comma separated)</span>
      </div>
      <textarea
        className="input"
        style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
        placeholder="e.g. UC123, UC456"
        value={profile.channel_ids || ''}
        onChange={(e) => onUpdateChannelIds(profile.id, e.target.value)}
        rows={2}
      />
    </div>

    {/* Scheduling */}
    <div style={{ marginBottom: '20px' }}>
      <ToggleField
        checked={profile.is_scheduled === 1}
        onChange={(checked) => onUpdateSchedule(profile.id, checked)}
        label="Schedule Public Video"
        description="Lên lịch công khai video"
      />

      {profile.is_scheduled === 1 && (
        <div style={{ marginTop: '12px', paddingLeft: '38px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Clock size={14} color="var(--text-muted)" />
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Daily Times (HH:mm, HH:mm)</span>
          </div>
          <input
            className="input"
            style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
            placeholder="e.g. 08:00, 18:00, 22:00"
            defaultValue={profile.schedules?.join(', ') || ''}
            onBlur={(e) => onUpdateSchedules(profile.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onUpdateSchedules(profile.id, e.target.value);
                e.target.blur();
              }
            }}
          />

          <div style={{ marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Video size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Số lượng video mỗi lần</span>
            </div>
            <input
              type="number"
              className="input"
              style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
              min="1"
              placeholder="Default: 1"
              value={profile.upload_count || 1}
              onChange={(e) => onUpdateUploadCount(profile.id, parseInt(e.target.value) || 1)}
            />
          </div>
        </div>
      )}
    </div>

    {/* Auto increment schedule */}
    <div style={{ marginBottom: '20px' }}>
      <ToggleField
        checked={profile.auto_increment_schedule === 1}
        onChange={(checked) => onUpdateAutoIncrementSchedule(profile.id, checked)}
        label="Lên lịch nối tiếp (10p)"
        description="V1: Public, V2: Mặc định, V3+: +10 phút"
      />
    </div>

    {/* Needs render */}
    <div style={{ marginBottom: '20px' }}>
      <ToggleField
        checked={profile.needs_render !== 0}
        onChange={(checked) => onUpdateNeedsRender(profile.id, checked)}
        label="Render video bypass"
        description="Bật: xử lý lách bản quyền qua render.py. Tắt: giữ nguyên video gốc."
        icon={Zap}
        iconColor="var(--primary)"
      />
    </div>

    {/* Remove title */}
    <div style={{ marginBottom: '20px' }}>
      <ToggleField
        checked={profile.remove_title !== 0}
        onChange={(checked) => onUpdateRemoveTitle(profile.id, checked)}
        label="Xóa tiêu đề khi upload"
        description="Bật: tự động xóa tiêu đề mặc định khi đăng. Tắt: giữ tiêu đề gốc."
        icon={Trash2}
        iconColor="var(--error)"
      />
    </div>

    {/* Set music */}
    <div style={{ marginBottom: '20px' }}>
      <ToggleField
        checked={profile.set_music === 1}
        onChange={(checked) => onUpdateSetMusic(profile.id, checked)}
        label="Set nhạc khi upload"
        description="Bật: mở Edit video, chọn nhạc từ Favorites rồi Save."
        icon={Music}
        iconColor="var(--accent)"
      />
    </div>

    {/* VPN Country */}
    <VPNCountrySelect value={vpnCountry} onChange={setVpnCountry} />
  </div>
);

export default ProfileSettings;
