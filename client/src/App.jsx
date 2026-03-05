import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import UrlQueryBar from './components/UrlQueryBar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import BatchMonitorPanel from './components/BatchMonitorPanel';
import ReportsPanel from './components/ReportsPanel';
import ChangePasswordModal from './components/ChangePasswordModal';
import LoginPage from './components/LoginPage';
import { useChat } from './hooks/useChat';
import { loadTheme, saveTheme, loadToken, saveToken, clearToken } from './utils/storage';
import { setAuthFailureHandler } from './utils/authFetch';

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
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { messages, isLoading, sendMessage, clearChat } = useChat();

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
    const token = loadToken();
    fetch('/api/config', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then(setProviderInfo)
      .catch(() => {});
  }, [authenticated]);

  const handleLogin = (token) => {
    saveToken(token);
    setAuthenticated(true);
  };

  const goHome = () => {
    setShowBatch(false);
    setShowReports(false);
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

  if (!authChecked) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900" />;
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
        onBatchMonitor={() => { setShowBatch(true); setShowReports(false); }}
        onReports={() => { setShowReports(true); setShowBatch(false); }}
        onClearChat={clearChat}
        onHome={goHome}
        onLogout={handleLogout}
        onChangePassword={() => setShowChangePassword(true)}
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
        />
      )}

      {showReports && (
        <ReportsPanel onClose={() => setShowReports(false)} />
      )}

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
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
