/**
 * Toast notification component.
 */

const ICONS = {
  success: 'ti-circle-check',
  error: 'ti-alert-circle',
  info: 'ti-info-circle'
};

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration - Auto-dismiss in milliseconds
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="ti ${ICONS[type] || ICONS.info} toast-icon"></i>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  const timer = setTimeout(() => removeToast(toast), duration);
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    removeToast(toast);
  });
}

function removeToast(el) {
  if (!el.parentElement) return;
  el.classList.add('hiding');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}
