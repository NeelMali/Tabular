const container = document.getElementById('toastContainer');

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration - Auto-dismiss in milliseconds
 */
export function showToast(message, type = 'info', duration = 4000) {
  const icons = {
    success: 'ti-circle-check',
    error: 'ti-alert-circle',
    info: 'ti-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="ti ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Auto-dismiss
  const timer = setTimeout(() => removeToast(toast), duration);

  // Click to dismiss
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    removeToast(toast);
  });
}

function removeToast(el) {
  if (!el.parentElement) return;
  el.classList.add('removing');
  el.addEventListener('animationend', () => el.remove());
}
