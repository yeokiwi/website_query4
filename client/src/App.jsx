import { useState, useEffect } from 'react';
import Header from './components/Header';
import UrlQueryBar from './components/UrlQueryBar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import BatchMonitorPanel from './components/BatchMonitorPanel';
import ReportsPanel from './components/ReportsPanel';
import LoginPage from './components/LoginPage';
import ChangeCredentials from './components/ChangeCredentials';
import { useChat } from './hooks/useChat';
import { loadTheme, saveTheme } from './utils/storage';
import { getToken, setToken, clearToken, apiFetch } from './utils/api';

function getTodayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => loadTheme() === 'dark');
  const [showBatch, setShowBatch] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [providerInfo, setProviderInfo] = useState(null);
  const [currentDate, setCurrentDate] = useState(getTodayString);
  const { messages, isLoading, sendMessage, clearChat } = useChat();

  // Auth state
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [showChangeCredentials, setShowChangeCredentials] = useState(false);

  // Lifted batch state so it persists across panel switches
  const [batchStatuses, setBatchStatuses] = useState({});
  const [batchResult, setBatchResult] = useState(null);

  // Check existing token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    fetch('/api/auth/verify', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) setAuthenticated(true);
        else clearToken();
      })
      .catch(() => clearToken())
      .finally(() => setAuthChecking(false));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    saveTheme(darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (!authenticated) return;
    apiFetch('/api/config')
      .then((r) => r.json())
      .then(setProviderInfo)
      .catch(() => {});
  }, [authenticated]);

  const handleLogin = (token) => {
    setToken(token);
    setAuthenticated(true);
  };

  const handleLogout = async () => {
    const token = getToken();
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // ignore
    }
    clearToken();
    setAuthenticated(false);
  };

  const handleCredentialsChanged = () => {
    setShowChangeCredentials(false);
    clearToken();
    setAuthenticated(false);
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

  if (authChecking) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const isDisabled = isLoading || batchRunning;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        onBatchMonitor={() => { setShowBatch((v) => !v); setShowReports(false); }}
        onReports={() => { setShowReports((v) => !v); setShowBatch(false); }}
        onClearChat={clearChat}
        onHome={goHome}
        providerInfo={providerInfo}
        showBatch={showBatch}
        showReports={showReports}
        onChangeCredentials={() => setShowChangeCredentials(true)}
        onLogout={handleLogout}
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

      {showChangeCredentials && (
        <ChangeCredentials
          token={getToken()}
          onClose={() => setShowChangeCredentials(false)}
          onCredentialsChanged={handleCredentialsChanged}
        />
      )}
    </div>
  );
}
