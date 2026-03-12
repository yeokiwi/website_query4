import { useState, useEffect } from 'react';

export default function WebsiteListEditor({ onClose, disabled }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [defaultPromptTemplate, setDefaultPromptTemplate] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [websitesRes, configRes] = await Promise.all([
          fetch('/api/batch-monitor/websites'),
          fetch('/api/config'),
        ]);
        const data = await websitesRes.json();
        const config = await configRes.json();
        const urls = data.urls || [];
        const prompts = data.prompts || {};
        setDefaultPromptTemplate(config.defaultPromptTemplate || '');
        setRows(
          urls.length > 0
            ? urls.map((u) => ({ url: u, prompt: prompts[u] || '', showPrompt: !!prompts[u] }))
            : [{ url: '', prompt: '', showPrompt: false }]
        );
      } catch {
        setRows([{ url: '', prompt: '', showPrompt: false }]);
      }
      setLoading(false);
    })();
  }, []);

  const updateRow = (index, field, value) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
    if (field === 'url') {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  };

  const togglePrompt = (index) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, showPrompt: !r.showPrompt } : r
      )
    );
  };

  const removeRow = (index) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setErrors({});
  };

  const addRow = () => {
    setRows((prev) => [...prev, { url: '', prompt: '', showPrompt: false }]);
  };

  const moveRow = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      [next[index], next[newIndex]] = [next[newIndex], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    // Clean up and validate
    const cleanedRows = rows
      .filter((r) => r.url.trim().length > 0)
      .map((r) => {
        let url = r.url.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = 'https://' + url;
        }
        return { url, prompt: r.prompt.trim() };
      });

    const cleaned = cleanedRows.map((r) => r.url);

    // Client-side validation
    const newErrors = {};
    const seen = new Set();
    cleaned.forEach((url, i) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
          newErrors[i] = 'Must use HTTPS';
        }
      } catch {
        newErrors[i] = 'Invalid URL';
      }
      if (seen.has(url)) {
        newErrors[i] = 'Duplicate URL';
      }
      seen.add(url);
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setRows(cleanedRows.map((r) => ({ url: r.url, prompt: r.prompt, showPrompt: !!r.prompt })));
      return;
    }

    // Build prompts map (only non-empty custom prompts)
    const prompts = {};
    cleanedRows.forEach((r) => {
      if (r.prompt) {
        prompts[r.url] = r.prompt;
      }
    });

    setSaving(true);
    try {
      const res = await fetch('/api/batch-monitor/websites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: cleaned, prompts }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.invalidUrls) {
          const serverErrors = {};
          data.invalidUrls.forEach((inv) => {
            const idx = cleaned.indexOf(inv.url);
            if (idx >= 0) serverErrors[idx] = inv.error;
          });
          setErrors(serverErrors);
          setRows(cleanedRows.map((r) => ({ url: r.url, prompt: r.prompt, showPrompt: !!r.prompt })));
        }
      } else {
        onClose();
      }
    } catch (err) {
      setErrors({ _general: err.message });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Edit Website List</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {errors._general && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-sm">
            {errors._general}
          </div>
        )}

        <div className="space-y-2 mb-4">
          {rows.map((row, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveRow(i, -1)}
                    disabled={i === 0 || disabled}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                    title="Move up"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveRow(i, 1)}
                    disabled={i === rows.length - 1 || disabled}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                    title="Move down"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1">
                  <input
                    type="text"
                    value={row.url}
                    onChange={(e) => updateRow(i, 'url', e.target.value)}
                    placeholder="https://example.com"
                    disabled={disabled}
                    className={`w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-gray-800 dark:text-gray-200 ${
                      errors[i]
                        ? 'border-red-400 dark:border-red-500'
                        : 'border-gray-200 dark:border-gray-600'
                    }`}
                  />
                  {errors[i] && (
                    <p className="text-xs text-red-500 mt-0.5">{errors[i]}</p>
                  )}
                </div>
                <button
                  onClick={() => togglePrompt(i)}
                  disabled={disabled}
                  className={`p-1 rounded transition-colors ${
                    row.showPrompt || row.prompt
                      ? 'text-blue-500 hover:text-blue-600'
                      : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
                  title={row.showPrompt ? 'Hide custom prompt' : 'Customise prompt'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => removeRow(i)}
                  disabled={disabled}
                  className="text-gray-400 hover:text-red-500 disabled:opacity-30 p-1"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
              {row.showPrompt && (
                <div className="ml-9 mr-9">
                  <textarea
                    value={row.prompt}
                    onChange={(e) => updateRow(i, 'prompt', e.target.value)}
                    placeholder={defaultPromptTemplate || 'Enter custom prompt... Use [url] and [date] as placeholders.'}
                    disabled={disabled}
                    rows={4}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 text-gray-800 dark:text-gray-200 resize-y"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    Optional. Use <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">[url]</code> and <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">[date]</code> as placeholders. Leave empty to use the default prompt.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          disabled={disabled}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 mb-4"
        >
          + Add URL
        </button>

        <div className="flex items-center gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={disabled || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={onClose}
            disabled={disabled}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
