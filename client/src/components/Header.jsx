export default function Header({ darkMode, onToggleDark, onBatchMonitor, onReports, onClearChat, onHome, providerInfo, showBatch, showReports }) {
  const providerLabel = providerInfo
    ? `${providerInfo.provider === 'deepseek' ? 'DeepSeek' : 'Anthropic'} — ${providerInfo.model}`
    : null;

  const providerColor = providerInfo?.provider === 'deepseek'
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
    : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm flex-wrap gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onHome} className="text-lg font-bold text-gray-800 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          Website Monitor
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400">/ with batching capability</span>
        {providerLabel && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${providerColor}`}>
            {providerLabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleDark}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        <button
          onClick={onBatchMonitor}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
            showBatch
              ? 'bg-indigo-600 text-white'
              : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
          }`}
        >
          Batch Monitor
        </button>
        <button
          onClick={onReports}
          className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
            showReports
              ? 'bg-green-600 text-white'
              : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50'
          }`}
        >
          Reports
        </button>
        <button
          onClick={onClearChat}
          className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 font-medium"
        >
          Clear Chat
        </button>
      </div>
    </header>
  );
}
