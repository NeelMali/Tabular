import { getHistory, getExtraction, deleteExtraction } from '../api.js';
import { showToast } from './Toast.js';

/**
 * History sidebar component.
 */
export function initHistory(onLoadExtraction) {
  const sidebar = document.getElementById('sidebar');
  const historyToggle = document.getElementById('historyToggle');
  const sidebarClose = document.getElementById('sidebarClose');
  const historyList = document.getElementById('historyList');

  // Toggle sidebar
  historyToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    if (sidebar.classList.contains('open')) {
      refreshHistory();
    }
  });

  sidebarClose.addEventListener('click', () => {
    sidebar.classList.remove('open');
  });

  // Close on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
    }
  });

  async function refreshHistory() {
    try {
      const items = await getHistory();
      renderHistoryList(items);
    } catch {
      historyList.innerHTML = `
        <div class="empty-state">
          <i class="ti ti-alert-circle"></i>
          <p>Failed to load history</p>
        </div>
      `;
    }
  }

  function renderHistoryList(items) {
    if (!items.length) {
      historyList.innerHTML = `
        <div class="empty-state">
          <i class="ti ti-archive-off"></i>
          <p>No extractions yet</p>
        </div>
      `;
      return;
    }

    historyList.innerHTML = '';
    items.forEach((item) => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="hi-name" title="${escapeAttr(item.filename)}">${escapeHtml(item.filename)}</div>
        <div class="hi-meta">
          <span class="hi-badge">${item.file_type || 'File'}</span>
          <span>${item.row_count} row${item.row_count === 1 ? '' : 's'}</span>
          <span>·</span>
          <span>${formatDate(item.created_at)}</span>
        </div>
        <button class="hi-delete" title="Delete">
          <i class="ti ti-trash"></i>
        </button>
      `;

      // Load on click
      el.addEventListener('click', async (e) => {
        if (e.target.closest('.hi-delete')) return;
        try {
          const full = await getExtraction(item.id);
          onLoadExtraction(full);
          sidebar.classList.remove('open');
          showToast(`Loaded "${item.filename}"`, 'success');
        } catch {
          showToast('Failed to load extraction', 'error');
        }
      });

      // Delete button
      el.querySelector('.hi-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          await deleteExtraction(item.id);
          el.style.transition = 'opacity 0.2s, transform 0.2s';
          el.style.opacity = '0';
          el.style.transform = 'translateX(20px)';
          setTimeout(() => el.remove(), 200);
          showToast('Extraction deleted', 'info');

          // Check if list is empty after deletion
          setTimeout(() => {
            if (!historyList.children.length) {
              renderHistoryList([]);
            }
          }, 250);
        } catch {
          showToast('Failed to delete', 'error');
        }
      });

      historyList.appendChild(el);
    });
  }

  return { refreshHistory };
}

function formatDate(isoStr) {
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
