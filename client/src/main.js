import { extractData, detectColumns } from './api.js';
import { initFileUpload } from './components/FileUpload.js';
import { initColumnEditor, getColumns, setColumns } from './components/ColumnEditor.js';
import { showToast } from './components/Toast.js';
import { renderTable, clearTable, addColumn } from './components/ResultTable.js';
import { initExport } from './components/ExportBar.js';
import { initHistory } from './components/History.js';

// ── Module-level state ──
let currentFile = null;
let currentData = null;
let isExtracting = false;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initApp();
});

function initApp() {
  const extractBtn   = document.getElementById('extractBtn');
  const readyHint    = document.getElementById('readyHint');
  const progressBar  = document.getElementById('progressBar');
  const statusDiv    = document.getElementById('status');
  const detectBtn    = document.getElementById('detectColsBtn');

  // ── File Upload ──
  initFileUpload((file) => {
    currentFile = file;
    clearTable();
    detectBtn.disabled = !file;
    checkReady();
  });

  // ── Column Editor ──
  initColumnEditor(checkReady);

  // ── Export Bar ──
  initExport(() => ({
    columns: getColumns(),
    data: currentData,
    filename: currentFile ? currentFile.name : 'extracted'
  }));

  // ── History Sidebar ──
  initHistory((extraction) => {
    currentData = extraction.data;
    // Restore columns into the editor
    setColumns(extraction.columns);
    renderTable(extraction.columns, extraction.data, (updated) => {
      currentData = updated;
    });
  });

  // ── Add Column to result table (button in result header) ──
  document.getElementById('addColToResult')?.addEventListener('click', () => {
    addColumn();
  });

  // ── Auto-Detect Columns ──
  detectBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    const origHTML = detectBtn.innerHTML;
    detectBtn.disabled = true;
    detectBtn.innerHTML = '<div class="spinner"></div><span>Detecting…</span>';

    try {
      const res = await detectColumns(currentFile);
      if (res.columns && res.columns.length > 0) {
        setColumns(res.columns);
        checkReady();
        showToast(`Detected ${res.columns.length} columns`, 'success');
      } else {
        showToast('No columns detected. Add them manually.', 'info');
      }
    } catch (err) {
      showToast(err.message || 'Detection failed', 'error');
    } finally {
      detectBtn.innerHTML = origHTML;
      detectBtn.disabled = false;
    }
  });

  // ── Extract ──
  extractBtn.addEventListener('click', async () => {
    const cols = getColumns();
    if (!currentFile || !cols.length || isExtracting) return;

    isExtracting = true;
    checkReady();
    clearTable();
    progressBar.classList.add('active', 'indeterminate');
    setStatus('info', '<div class="spinner"></div> Extracting data…');

    try {
      const result = await extractData(currentFile, cols);
      currentData = result.data;

      // Show add-column button inside result header
      const addColBtn = document.getElementById('addColToResult');
      if (addColBtn) addColBtn.style.display = 'inline-flex';

      renderTable(result.columns, result.data, (updated) => {
        currentData = updated;
      });

      setStatus('success', `<i class="ti ti-check"></i> ${result.rowCount} row${result.rowCount === 1 ? '' : 's'} extracted`);
      showToast('Extraction complete!', 'success');
    } catch (err) {
      setStatus('error', `<i class="ti ti-alert-triangle"></i> ${err.message}`);
      showToast(err.message, 'error');
    } finally {
      isExtracting = false;
      progressBar.classList.remove('active', 'indeterminate');
      checkReady();
    }
  });

  // ── Helpers ──
  function checkReady() {
    const cols = getColumns();
    const ready = !!currentFile && cols.length > 0;
    extractBtn.disabled = !ready || isExtracting;

    if (isExtracting) {
      readyHint.textContent = 'Extracting…';
      readyHint.className = 'ready-hint';
    } else if (ready) {
      readyHint.textContent = 'Ready';
      readyHint.className = 'ready-hint ready';
    } else {
      readyHint.textContent = currentFile ? 'Add at least one column' : 'Upload a file first';
      readyHint.className = 'ready-hint';
    }
  }

  function setStatus(type, html) {
    statusDiv.className = `status ${type}`;
    statusDiv.innerHTML = html;
  }
}

function initTheme() {
  const toggle = document.getElementById('themeToggle');
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);

  toggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  });
}
