import { useState, useEffect } from 'react';
import Header from './components/Header';
import UrlQueryBar from './components/UrlQueryBar';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import BatchMonitorPanel from './components/BatchMonitorPanel';
import ReportsPanel from './components/ReportsPanel';
import { useChat } from './hooks/useChat';
import { loadTheme, saveTheme } from './utils/storage';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => loadTheme() === 'dark');
  const [showBatch, setShowBatch] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const { messages, isLoading, sendMessage, clearChat } = useChat();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    saveTheme(darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const handleUrlQuery = (url) => {
    const prompt = `I need you to examine ${url} and focus specifically on:
- What's new or changed in the last 30 days?
- Any announcements, blog posts, or news from the past month
- Updates to products, services, or features
- Changes to pricing, terms of service, or policies
Please distinguish between what you can confirm as recent vs. what appears to be recent based on dates or context.`;
    sendMessage(prompt);
  };

  const isDisabled = isLoading || batchRunning;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        onBatchMonitor={() => { setShowBatch(true); setShowReports(false); }}
        onReports={() => { setShowReports(true); setShowBatch(false); }}
        onClearChat={clearChat}
      />

      {showBatch && (
        <BatchMonitorPanel
          onClose={() => setShowBatch(false)}
          batchRunning={batchRunning}
          setBatchRunning={setBatchRunning}
        />
      )}

      {showReports && (
        <ReportsPanel onClose={() => setShowReports(false)} />
      )}

      {!showBatch && !showReports && (
        <>
          <UrlQueryBar onSubmit={handleUrlQuery} disabled={isDisabled} />

          <div className="flex-1 overflow-y-auto">
            <MessageList messages={messages} isLoading={isLoading} />
          </div>

          <ChatInput onSend={sendMessage} disabled={isDisabled} />
        </>
      )}
    </div>
  );
}
