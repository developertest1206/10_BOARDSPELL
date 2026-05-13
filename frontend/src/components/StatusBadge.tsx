import React from 'react';

interface Props { status: string; }

const colors: Record<string, { bg: string; text: string }> = {
  success: { bg:'#E6F9F0', text:'#00875A' },
  failed:  { bg:'#FFF0F0', text:'#DE350B' },
  skipped: { bg:'#F4F5F7', text:'#6B778C' },
  active:  { bg:'#E6F4FF', text:'#0065FF' },
  paused:  { bg:'#FFF8E1', text:'#FF8B00' },
};

const StatusBadge: React.FC<Props> = ({ status }) => {
  const c = colors[status] || colors.skipped;
  return (
    <span style={{ backgroundColor:c.bg, color:c.text, padding:'3px 10px', borderRadius:12, fontSize:12, fontWeight:600, textTransform:'capitalize' }}>
      {status}
    </span>
  );
};

export default StatusBadge;