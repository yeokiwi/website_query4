export default function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3">
        <div className="text-xs text-gray-400 mb-1">Assistant</div>
        <div className="flex gap-1">
          <span className="typing-dot w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full inline-block" />
          <span className="typing-dot w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full inline-block" />
          <span className="typing-dot w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full inline-block" />
        </div>
      </div>
    </div>
  );
}
