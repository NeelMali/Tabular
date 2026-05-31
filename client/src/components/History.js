import { getHistory, getExtraction, deleteExtraction } from '../api.js';
import { showToast } from './Toast.js';

let _initialized = false;
let _onLoad = null;

/**
 * Initialize the History sidebar. Safe to call once only.
 */
export function initHistory(onLoadExtraction) {
  _onLoad = onLoadExtraction;

  if (_initialized) return;
  _initialized = true;

  const sidebar      = document.getElementById('sidebar');
  const historyList  = document.getElementById('historyList');

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
    }
  });

  // Auto-load history when sidebar opens via historyToggle (defined in main.js)
  sidebar.addEventListener('transitionend', () => {
    if (sidebar.classList.contains('open')) refreshHistory();
  });

  async function refreshHistory() {
    historyList.innerHTML = '<div class="empty-state"><div class="spinner" style="margin:auto"></div></div>';
    try {
      const items = await getHistory();
      renderList(items);
    } catch {
      historyList.innerHTML = `
        <div class="empty-state">
          <i class="ti ti-alert-circle"></i>
          <p>Failed to load history</p>
        </div>`;
    }
  }

  function renderList(items) {
    if (!items.length) {
      historyList.innerHTML = `
        <div class="empty-state">
          <i class="ti ti-archive-off"></i>
          <p>No extractions yet</p>
        </div>`;
      return;
    }

    historyList.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="hi-name" title="${escAttr(item.filename)}">${escHtml(item.filename)}</div>
        <div class="hi-meta">
          <span class="hi-badge">${item.file_type || 'File'}</span>
          <span>${item.row_count} row${item.row_count === 1 ? '' : 's'}</span>
          <span>·</span>
          <span>${timeAgo(item.created_at)}</span>
        </div>
        <button class="hi-delete" title="Delete"><i class="ti ti-trash"></i></button>
      `;

      el.addEventListener('click', async e => {
        if (e.target.closest('.hi-delete')) return;
        try {
          const full = await getExtraction(item.id);
          if (_onLoad) _onLoad(full);
          sidebar.classList.remove('open');
          showToast(`Loaded "${item.filename}"`, 'success');
        } catch {
          showToast('Failed to load extraction', 'error');
        }
      });

      el.querySelector('.hi-delete').addEventListener('click', async e => {
        e.stopPropagation();
        try {
          await deleteExtraction(item.id);
          el.style.transition = 'opacity 0.2s, transform 0.2s';
          el.style.opacity = '0';
          el.style.transform = 'translateX(20px)';
          setTimeout(() => {
            el.remove();
            if (!historyList.querySelector('.history-item')) renderList([]);
          }, 220);
          showToast('Deleted', 'info');
        } catch {
          showToast('Failed to delete', 'error');
        }
      });

      historyList.appendChild(el);
    });
  }
}

// ── Helpers ──

function timeAgo(iso) {
  try {
    const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    if (mins < 10080) return `${Math.floor(mins / 1440)}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function escAttr(s) {
  return String(s).replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
