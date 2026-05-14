/**
 * Header Component
 * =================
 * Shows the Boardspell logo and title at the top of every page.
 */

import React from 'react';

const Header: React.FC = () => (
  <header style={{
    background:  'linear-gradient(135deg, #6C47FF 0%, #4A90E2 100%)',
    boxShadow:   '0 2px 8px rgba(108, 71, 255, 0.3)',
    position:    'sticky',
    top:         0,
    zIndex:      100,
  }}>
    <div style={{
      maxWidth:       1100,
      margin:         '0 auto',
      padding:        '14px 24px',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'space-between',
    }}>
      {/* Logo and App Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 24 }}>⚡</span>
        <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>
          Boardspell
        </span>
      </div>

      {/* Tagline */}
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 400 }}>
        Cross-Board Automation Builder
      </span>
    </div>
  </header>
);

export default Header;