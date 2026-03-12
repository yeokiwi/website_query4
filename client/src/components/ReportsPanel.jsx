import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { formatDate } from '../utils/formatTime';
import { apiFetch } from '../utils/api';

export default function ReportsPanel({ onClose }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportContent, setReportContent] = useState('');
  const [deleting, setDeleting] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/reports');
      const data = await res.json();
      setReports(data.reports || []);
    } catch {
      setReports([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const viewReport = async (filename) => {
    setSelectedReport(filename);
    try {
      const res = await apiFetch(`/api/reports/${filename}`);
      const text = await res.text();
      setReportContent(text);
    } catch {
      setReportContent('Failed to load report.');
    }
  };

  const deleteReport = async (filename, e) => {
    e.stopPropagation();
    if (!confirm(`Delete report "${filename}"?`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/reports/${filename}`, { method: 'DELETE' });
      if (selectedReport === filename) {
        setSelectedReport(null);
        setReportContent('');
      }
      await fetchReports();
    } catch {
      // ignore
    }
    setDeleting(false);
  };

  const deleteAllReports = async () => {
    if (!confirm(`Delete all ${reports.length} reports?`)) return;
    setDeleting(true);
    try {
      await apiFetch('/api/reports', { method: 'DELETE' });
      setSelectedReport(null);
      setReportContent('');
      await fetchReports();
    } catch {
      // ignore
    }
    setDeleting(false);
  };

  const exportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const contentEl = document.getElementById('report-content');
    if (!contentEl) return;

    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>${selectedReport}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a; font-size: 14px; line-height: 1.6; }
  h1 { font-size: 22px; border-bottom: 1px solid #ddd; padding-bottom: 8px; }
  h2 { font-size: 18px; margin-top: 24px; }
  h3 { font-size: 15px; margin-top: 20px; }
  pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 13px; }
  code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; font-size: 13px; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
  th { background: #f5f5f5; }
  blockquote { border-left: 3px solid #ddd; margin: 12px 0; padding: 4px 16px; color: #555; }
  a { color: #2563eb; }
  ul, ol { padding-left: 24px; }
  hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
</style></head><body>${contentEl.innerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
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
          <div className="flex items-center gap-2">
            {!selectedReport && reports.length > 0 && (
              <button
                onClick={deleteAllReports}
                disabled={deleting}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 font-medium disabled:opacity-50"
              >
                Delete All
              </button>
            )}
            {selectedReport && (
              <>
                <button
                  onClick={exportPdf}
                  className="px-3 py-1.5 text-sm rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 font-medium"
                >
                  Export PDF
                </button>
                <button
                  onClick={(e) => deleteReport(selectedReport, e)}
                  disabled={deleting}
                  className="px-3 py-1.5 text-sm rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 font-medium disabled:opacity-50"
                >
                  Delete
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {selectedReport ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div id="report-content" className="markdown-content text-sm">
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
                  <div
                    onClick={() => viewReport(report.filename)}
                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{domain}</span>
                        <span className="text-xs text-gray-400 ml-2">{formatSize(report.size)}</span>
                      </div>
                      {report.summary && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                          {report.summary}
                        </p>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {formatDate(report.timestamp)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteReport(report.filename, e)}
                      disabled={deleting}
                      className="ml-3 p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 flex-shrink-0"
                      title="Delete report"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
