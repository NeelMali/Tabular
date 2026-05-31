/**
 * Export functions for CSV, Excel (XLSX), and JSON.
 * Uses SheetJS loaded from CDN for Excel export.
 */

/**
 * Initialize export button handlers.
 * @param {Function} getState - Returns { columns, data, filename }
 */
export function initExport(getState) {
  document.getElementById('exportCsv').addEventListener('click', () => {
    const { columns, data, filename } = getState();
    if (!data?.length) return;
    exportCsv(columns, data, filename);
  });

  document.getElementById('exportXlsx').addEventListener('click', () => {
    const { columns, data, filename } = getState();
    if (!data?.length) return;
    exportXlsx(columns, data, filename);
  });

  document.getElementById('exportJson').addEventListener('click', () => {
    const { columns, data, filename } = getState();
    if (!data?.length) return;
    exportJson(data, filename);
  });
}

function exportCsv(columns, data, filename) {
  const rows = [
    columns.join(','),
    ...data.map((r) =>
      columns.map((c) => {
        const v = r[c] ?? '';
        return '"' + String(v).replace(/"/g, '""') + '"';
      }).join(',')
    )
  ];

  downloadBlob(
    new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' }),
    `${sanitizeFilename(filename)}_data.csv`
  );
}

async function exportXlsx(columns, data, filename) {
  // Dynamically load SheetJS if not already loaded
  if (!window.XLSX) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  }

  const rows = data.map((r) => {
    const o = {};
    columns.forEach((c) => { o[c] = r[c] ?? ''; });
    return o;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: columns });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');
  XLSX.writeFile(wb, `${sanitizeFilename(filename)}_data.xlsx`);
}

function exportJson(data, filename) {
  const json = JSON.stringify(data, null, 2);
  downloadBlob(
    new Blob([json], { type: 'application/json' }),
    `${sanitizeFilename(filename)}_data.json`
  );
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function sanitizeFilename(name) {
  return (name || 'extracted').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
