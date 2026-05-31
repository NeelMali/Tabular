/**
 * Column editor component.
 * Manages the dynamic list of column names.
 */
export function initColumnEditor(initialColumns, onChange) {
  const colList = document.getElementById('colList');
  const addColBtn = document.getElementById('addCol');
  let columns = [...initialColumns];

  function render() {
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
        onChange(columns);
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
        onChange(columns);
      });
    });

    // Do not call onChange() here, as it causes a circular dependency during initial setup
  }

  function addColumn() {
    columns.push('');
    render();
    const inputs = colList.querySelectorAll('input');
    inputs[inputs.length - 1]?.focus();
  }

  addColBtn.addEventListener('click', addColumn);

  /**
   * Set columns externally (e.g., when loading from history).
   */
  function setColumns(newCols) {
    columns = [...newCols];
    render();
  }

  /**
   * Get current columns (non-empty only).
   */
  function getColumns() {
    return columns.filter((c) => c.trim());
  }

  // Initial render
  render();

  return { setColumns, getColumns };
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
