/**
 * Column editor component.
 * Manages the dynamic list of column names.
 */

let columns = [];
let onChangeCallback = null;

function render() {
  const colList = document.getElementById('colList');
  if (!colList) return;
  colList.innerHTML = '';
  columns.forEach((col, i) => {
    const row = document.createElement('div');
    row.className = 'col-row';
    row.innerHTML = `
      <span class="col-num">${i + 1}</span>
      <input type="text" value="${escapeAttr(col)}" placeholder="Column name e.g. Phone Number" data-idx="${i}">
      <button class="btn-icon del-btn" data-idx="${i}" title="Remove column">
        <i class="ti ti-trash"></i>
      </button>
    `;
    colList.appendChild(row);
  });

  // Input change listeners
  colList.querySelectorAll('input').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      columns[+e.target.dataset.idx] = e.target.value;
      if (onChangeCallback) onChangeCallback(columns);
    });

    // Enter key → add new column
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addColumn();
      }
    });
  });

  // Delete listeners
  colList.querySelectorAll('.del-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      columns.splice(+btn.dataset.idx, 1);
      render();
      if (onChangeCallback) onChangeCallback(columns);
    });
  });
}

function addColumn() {
  columns.push('');
  render();
  const colList = document.getElementById('colList');
  if (colList) {
    const inputs = colList.querySelectorAll('input');
    if (inputs.length > 0) inputs[inputs.length - 1].focus();
  }
}

export function initColumnEditor(onChange) {
  onChangeCallback = onChange;
  const addColBtn = document.getElementById('addCol');
  if (addColBtn) addColBtn.addEventListener('click', addColumn);
  render();
}

/**
 * Set columns externally (e.g., when loading from history).
 */
export function setColumns(newCols) {
  columns = [...newCols];
  render();
}

/**
 * Get current columns (non-empty only).
 */
export function getColumns() {
  return columns.filter((c) => c.trim());
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
