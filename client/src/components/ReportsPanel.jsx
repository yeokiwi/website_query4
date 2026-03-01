import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatDate } from '../utils/formatTime';

export default function ReportsPanel({ onClose }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportContent, setReportContent] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/reports');
        const data = await res.json();
        setReports(data.reports || []);
      } catch {
        setReports([]);
      }
      setLoading(false);
    })();
  }, []);

  const viewReport = async (filename) => {
    setSelectedReport(filename);
    try {
      const res = await fetch(`/api/reports/${filename}`);
      const text = await res.text();
      setReportContent(text);
    } catch {
      setReportContent('Failed to load report.');
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {selectedReport ? (
              <button
                onClick={() => setSelectedReport(null)}
                className="text-blue-600 dark:text-blue-400 hover:underline mr-2"
              >
                Reports
              </button>
            ) : 'Reports'}
            {selectedReport && <span className="text-gray-500">/ {selectedReport}</span>}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {selectedReport ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="markdown-content text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {reportContent}
              </ReactMarkdown>
            </div>
          </div>
        ) : loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : reports.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No reports generated yet.</p>
        ) : (
          <ul className="space-y-2">
            {reports.map((report) => {
              let domain = '';
              try { domain = new URL(report.url).hostname; } catch { domain = report.filename; }
              return (
                <li key={report.filename}>
                  <button
                    onClick={() => viewReport(report.filename)}
                    className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{domain}</span>
                      <span className="text-xs text-gray-400">{formatSize(report.size)}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {formatDate(report.timestamp)}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
