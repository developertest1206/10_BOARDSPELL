import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import AutomationList from './pages/AutomationList';
import AutomationBuilder from './pages/AutomationBuilder';
import ExecutionLogs from './pages/ExecutionLogs';

const DEFAULT_WORKSPACE_ID = '34981119';

function App() {
  const [workspaceId, setWorkspaceId] = useState<string>(DEFAULT_WORKSPACE_ID);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    try {
      const monday = (window as any).mondaySdk?.() || null;
      if (monday) {
        monday.get('context')
          .then((res: any) => {
            const accountId = res?.data?.account?.id;
            if (accountId) setWorkspaceId(String(accountId));
          })
          .catch(() => console.log('⚠️ Outside monday.com'))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', background:'#F4F5F7', fontFamily:'sans-serif' }}>
      <div style={{ fontSize:64, marginBottom:16 }}>⚡</div>
      <h2 style={{ color:'#172B4D', margin:'0 0 8px' }}>Loading Boardspell...</h2>
      <p style={{ color:'#6B778C', margin:0 }}>Cross-Board Automation Builder</p>
    </div>
  );

  return (
    <BrowserRouter>
      <div style={{ minHeight:'100vh', background:'#F4F5F7', fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <Header />
        <Routes>
          <Route path="/"                   element={<AutomationList   workspaceId={workspaceId} />} />
          <Route path="/builder"            element={<AutomationBuilder workspaceId={workspaceId} />} />
          <Route path="/builder/:id"        element={<AutomationBuilder workspaceId={workspaceId} />} />
          <Route path="/logs/:automationId" element={<ExecutionLogs />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;