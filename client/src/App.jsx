import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import UrlQueryBar from './components/UrlQueryBar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import BatchMonitorPanel from './components/BatchMonitorPanel';
import ReportsPanel from './components/ReportsPanel';
import LoginPage from './components/LoginPage';
import { useChat } from './hooks/useChat';
import { loadTheme, saveTheme, loadToken, saveToken, clearToken } from './utils/storage';
import { authFetch, setAuthFailureHandler } from './utils/authFetch';

function getTodayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => loadTheme() === 'dark');
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [providerInfo, setProviderInfo] = useState(null);
  const [currentDate, setCurrentDate] = useState(getTodayString);
  const { messages, isLoading, sendMessage, clearChat } = useChat();

  // Lifted batch state so it persists across panel switches
  const [batchStatuses, setBatchStatuses] = useState({});
  const [batchResult, setBatchResult] = useState(null);

  const handleLogout = useCallback(() => {
    const token = loadToken();
    if (token) {
      fetch('/api/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(() => {});
    }
    clearToken();
    setAuthenticated(false);
  }, []);

  // Register global auth failure handler
  useEffect(() => {
    setAuthFailureHandler(() => {
      setAuthenticated(false);
    });
  }, []);

  // Check existing token on mount
  useEffect(() => {
    const token = loadToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    fetch('/api/auth/check', {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((r) => {
        if (r.ok) {
          setAuthenticated(true);
        } else {
          clearToken();
        }
      })
      .catch(() => clearToken())
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    saveTheme(darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (!authenticated) return;
    authFetch('/api/config')
      .then((r) => r.json())
      .then(setProviderInfo)
      .catch(() => {});
  }, [authenticated]);

  const handleLogin = (token) => {
    saveToken(token);
    setAuthenticated(true);
  };

  const handleUrlQuery = (url) => {
    const dateLine = currentDate ? `The current date is ${currentDate}. ` : '';
    const prompt = `${dateLine}I need you to examine ${url} and focus specifically on:
- What's new or changed in the last 30 days?
- Any announcements, blog posts, or news from the past month
- Updates to products, services, or features
- Changes to pricing, terms of service, or policies
Please distinguish between what you can confirm as recent vs. what appears to be recent based on dates or context.`;
    sendMessage(prompt);
  };

  const goHome = () => {
    setShowBatch(false);
    setShowReports(false);
  };

  const isDisabled = isLoading || batchRunning;

  // Show nothing while checking auth
  if (!authChecked) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900" />;
  }

  // Show login page if not authenticated
  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        onBatchMonitor={() => { setShowBatch((v) => !v); setShowReports(false); }}
        onReports={() => { setShowReports((v) => !v); setShowBatch(false); }}
        onClearChat={clearChat}
        onHome={goHome}
        onLogout={handleLogout}
        providerInfo={providerInfo}
        showBatch={showBatch}
        showReports={showReports}
      />

      {showBatch && (
        <BatchMonitorPanel
          onClose={() => setShowBatch(false)}
          batchRunning={batchRunning}
          setBatchRunning={setBatchRunning}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          batchStatuses={batchStatuses}
          setBatchStatuses={setBatchStatuses}
          batchResult={batchResult}
          setBatchResult={setBatchResult}
        />
      )}

      {showReports && (
        <ReportsPanel onClose={() => setShowReports(false)} />
      )}

      {!showBatch && !showReports && (
        <>
          <UrlQueryBar
            onSubmit={handleUrlQuery}
            disabled={isDisabled}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
          />

          <div className="flex-1 overflow-y-auto">
            <MessageList messages={messages} isLoading={isLoading} />
          </div>

          <ChatInput onSend={sendMessage} disabled={isDisabled} />
        </>
      )}
    </div>
  );
}
