/**
 * TableForge — Main application entry point.
 * Orchestrates all components and manages global state.
 */

import { extractData } from './api.js';
import { showToast } from './components/Toast.js';
import { initFileUpload } from './components/FileUpload.js';
import { initColumnEditor } from './components/ColumnEditor.js';
import { renderTable, clearTable } from './components/ResultTable.js';
import { initExport } from './components/ExportBar.js';
import { initHistory } from './components/History.js';

// ── State ──
let currentFile = null;
let currentData = [];
let currentFilename = '';
let columnEditor = null;
let historyModule = null;

// ── Boot the app ──
try {
  init();
} catch (err) {
  console.error('❌ App initialization failed:', err);
  document.body.innerHTML += `<div style="position:fixed;bottom:20px;left:20px;right:20px;background:#fef2f2;color:#991b1b;padding:16px;border-radius:8px;font-family:sans-serif;z-index:9999;border:1px solid #fca5a5;">
    <strong>App Error:</strong> ${err.message}<br><small>Check browser console (F12) for details.</small>
  </div>`;
}

function init() {
  // ── Theme ──
  initTheme();

  // ── DOM refs ──
  const extractBtn = document.getElementById('extractBtn');
  const readyHint = document.getElementById('readyHint');
  const statusEl = document.getElementById('status');
  const progressBar = document.getElementById('progressBar');
  const progressFill = document.getElementById('progressFill');

  // ── File Upload ──
  initFileUpload((file, error) => {
    if (error) {
      showToast(error, 'error');
      currentFile = null;
    } else {
      currentFile = file;
      if (file) {
        showToast(`Selected: ${file.name}`, 'info', 2000);
      }
    }
    checkReady();
  });

  // ── Column Editor ──
  columnEditor = initColumnEditor(
    ['Name', 'Surname', 'Phone Number', 'Email'],
    () => checkReady()
  );

  // ── Export ──
  initExport(() => ({
    columns: columnEditor.getColumns(),
    data: currentData,
    filename: currentFilename
  }));

  // ── History ──
  historyModule = initHistory((extraction) => {
    columnEditor.setColumns(extraction.columns);
    currentData = extraction.result;
    currentFilename = extraction.filename;
    renderTable(extraction.columns, extraction.result);
  });

  // ── Readiness Check ──
  function checkReady() {
    const cols = columnEditor.getColumns();
    const ok = currentFile && cols.length > 0;
    extractBtn.disabled = !ok;

    if (!currentFile) {
      readyHint.textContent = 'Upload a file to begin';
      readyHint.classList.remove('ready');
    } else if (!cols.length) {
      readyHint.textContent = 'Add at least one column';
      readyHint.classList.remove('ready');
    } else {
      readyHint.textContent = '✓ Ready to extract!';
      readyHint.classList.add('ready');
    }
  }

  // ── Extract ──
  extractBtn.addEventListener('click', async () => {
    const cols = columnEditor.getColumns();
    if (!currentFile || !cols.length) return;

    extractBtn.disabled = true;
    extractBtn.innerHTML = '<span class="spinner"></span> Extracting...';
    setStatus('Uploading and processing with AI...', 'info');
    showProgress();
    clearTable();

    try {
      const result = await extractData(currentFile, cols);
      currentData = result.data;
      currentFilename = result.filename;
      renderTable(cols, result.data);
      setStatus(`Successfully extracted ${result.rowCount} row${result.rowCount === 1 ? '' : 's'}`, 'success');
      showToast(`Extracted ${result.rowCount} row${result.rowCount === 1 ? '' : 's'} from ${result.filename}`, 'success');
      historyModule.refreshHistory();
    } catch (err) {
      setStatus(`Error: ${err.message}`, 'error');
      showToast(err.message, 'error', 6000);
    }

    hideProgress();
    extractBtn.disabled = false;
    extractBtn.innerHTML = '<i class="ti ti-sparkles"></i><span>Extract Data</span>';
    checkReady();
  });

  // ── Status Helpers ──
  function setStatus(msg, type) {
    const icons = { info: 'ti-loader-2', error: 'ti-alert-circle', success: 'ti-circle-check' };
    const iconClass = type === 'info' ? `${icons[type]} spin-icon` : icons[type];
    statusEl.className = `status ${type}`;
    statusEl.innerHTML = `<i class="ti ${iconClass}"></i> ${msg}`;
    if (type === 'success') {
      setTimeout(() => { statusEl.className = 'status'; }, 5000);
    }
  }

  function showProgress() {
    progressBar.classList.add('active', 'indeterminate');
    progressFill.style.width = '';
  }

  function hideProgress() {
    progressBar.classList.remove('active', 'indeterminate');
  }

  // ── Initial state ──
  checkReady();
  console.log('✅ TableForge initialized successfully');
}

// ── Theme Toggle ──
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;
  const icon = themeToggle.querySelector('i');

  const saved = localStorage.getItem('theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }

  updateIcon();

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateIcon();
  });

  function updateIcon() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    icon.className = isDark ? 'ti ti-sun' : 'ti ti-moon';
  }
}

// ── Spinning animation for loading ──
const style = document.createElement('style');
style.textContent = `.spin-icon { animation: spin 1s linear infinite; }`;
document.head.appendChild(style);
