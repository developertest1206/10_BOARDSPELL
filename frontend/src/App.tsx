/**
 * Main App Component
 * ===================
 * Sets up routing and detects the workspace ID from monday.com context.
 *
 * When running inside monday.com (as a Board View), it gets the workspace
 * ID automatically using the monday SDK.
 *
 * When running on localhost (development), it uses the DEFAULT_WORKSPACE_ID.
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header          from './components/Header';
import AutomationList  from './pages/AutomationList';
import AutomationBuilder from './pages/AutomationBuilder';
import ExecutionLogs   from './pages/ExecutionLogs';

// ── Change this to YOUR workspace ID for local development ────────────────────
// Get it by going to http://localhost:3000/oauth/start and authorizing
const DEFAULT_WORKSPACE_ID = '34981119';

function App() {
  const [workspaceId, setWorkspaceId] = useState<string>(DEFAULT_WORKSPACE_ID);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    /**
     * Try to get workspace ID from monday.com SDK context.
     * This works when the app is loaded inside monday.com as a Board View.
     * Falls back to DEFAULT_WORKSPACE_ID when running on localhost.
     */
    try {
      const monday = (window as any).mondaySdk?.() || null;

      if (monday) {
        monday.get('context')
          .then((res: any) => {
            const accountId = res?.data?.account?.id;
            if (accountId) {
              setWorkspaceId(String(accountId));
              console.log(`✅ monday.com workspace detected: ${accountId}`);
            }
          })
          .catch(() => {
            console.log('⚠️ Running outside monday.com — using default workspace ID');
          })
          .finally(() => setLoading(false));
      } else {
        // Not inside monday.com — use default workspace ID for local dev
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  // Show loading spinner while detecting workspace
  if (loading) return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#F4F5F7',
      fontFamily: 'sans-serif',
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>⚡</div>
      <h2 style={{ color: '#172B4D', margin: '0 0 8px' }}>Loading Boardspell...</h2>
      <p style={{ color: '#6B778C', margin: 0 }}>Cross-Board Automation Builder</p>
    </div>
  );

  return (
    <BrowserRouter>
      <div style={{
        minHeight:  '100vh',
        background: '#F4F5F7',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <Header />
        <Routes>
          {/* Automation list — home page */}
          <Route path="/"
            element={<AutomationList workspaceId={workspaceId} />} />

          {/* Create new automation */}
          <Route path="/builder"
            element={<AutomationBuilder workspaceId={workspaceId} />} />

          {/* Edit existing automation */}
          <Route path="/builder/:id"
            element={<AutomationBuilder workspaceId={workspaceId} />} />

          {/* View execution logs for an automation */}
          <Route path="/logs/:automationId"
            element={<ExecutionLogs />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;