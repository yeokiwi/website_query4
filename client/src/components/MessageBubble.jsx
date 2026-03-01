import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ToolActivityCard from './ToolActivityCard';
import { formatTime } from '../utils/formatTime';

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
        }`}
      >
        <div className={`text-xs mb-1 ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>
          {isUser ? 'You' : 'Assistant'} &middot; {formatTime(message.timestamp)}
        </div>

        {message.tools && message.tools.length > 0 && (
          <div className="mb-2 space-y-2">
            {message.tools.map((tool, i) => (
              <ToolActivityCard key={i} tool={tool} />
            ))}
          </div>
        )}

        {isUser ? (
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="markdown-content text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content || ''}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
