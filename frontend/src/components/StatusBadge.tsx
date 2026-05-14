/**
 * Status Badge Component
 * =======================
 * Shows a colored badge for automation status (active/paused)
 * or log status (success/failed/skipped).
 */

import React from 'react';

interface Props {
  status: string;
}

// Color mapping for each status type
const COLORS: Record<string, { bg: string; text: string }> = {
  success: { bg: '#E6F9F0', text: '#00875A' },
  failed:  { bg: '#FFF0F0', text: '#DE350B' },
  skipped: { bg: '#F4F5F7', text: '#6B778C' },
  active:  { bg: '#E6F4FF', text: '#0065FF' },
  paused:  { bg: '#FFF8E1', text: '#FF8B00' },
};

const StatusBadge: React.FC<Props> = ({ status }) => {
  const color = COLORS[status] || COLORS.skipped;

  return (
    <span style={{
      backgroundColor: color.bg,
      color:           color.text,
      padding:         '3px 10px',
      borderRadius:    12,
      fontSize:        12,
      fontWeight:      600,
      textTransform:   'capitalize',
      whiteSpace:      'nowrap',
    }}>
      {status}
    </span>
  );
};

export default StatusBadge;