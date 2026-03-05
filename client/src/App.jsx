import { useState, useEffect } from 'react';
import Header from './components/Header';
import UrlQueryBar from './components/UrlQueryBar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import BatchMonitorPanel from './components/BatchMonitorPanel';
import ReportsPanel from './components/ReportsPanel';
import { useChat } from './hooks/useChat';
import { loadTheme, saveTheme } from './utils/storage';

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

  // Lifted batch state so it persists across panel switches
  const [batchStatuses, setBatchStatuses] = useState({});
  const [batchResult, setBatchResult] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    saveTheme(darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then(setProviderInfo)
      .catch(() => {});
  }, []);

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
