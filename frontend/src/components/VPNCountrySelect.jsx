import React from 'react';
import { Globe } from 'lucide-react';

const COUNTRIES = [
  'United States',
  'United Kingdom',
  'Canada',
  'Germany',
  'France',
  'Netherlands',
  'Japan',
  'Singapore',
  'Australia',
  'South Korea',
  'Hong Kong',
  'Taiwan',
  'India',
  'Brazil',
  'Mexico',
  'Spain',
  'Italy',
  'Sweden',
  'Switzerland',
  'Poland',
  'Turkey',
  'Russia',
  'Ukraine',
  'Argentina',
  'Colombia',
  'Thailand',
  'Vietnam',
  'Indonesia',
  'Philippines',
  'Malaysia',
  'South Africa',
  'Egypt',
  'United Arab Emirates',
  'Israel',
  'Ireland',
  'Belgium',
  'Austria',
  'Norway',
  'Denmark',
  'Finland',
  'Czech Republic',
  'Romania',
  'Greece',
  'Portugal',
  'Chile'
];

// Urban VPN country selector used inside the profile card settings.
// Props: value, onChange
const VPNCountrySelect = ({ value, onChange }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <Globe size={14} color="var(--text-muted)" />
      <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Urban VPN Country</span>
    </div>
    <select
      className="input"
      style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">-- None --</option>
      {COUNTRIES.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  </div>
);

export default VPNCountrySelect;
