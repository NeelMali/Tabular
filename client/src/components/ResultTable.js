/**
 * Editable result table component.
 * Module-level state allows external callers (Add Column button) to mutate the live table.
 */

let _columns = [];
let _data = [];
let _onDataChange = null;

// ── Public API ──────────────────────────────────────

/**
 * Render the extracted data as an editable table.
 */
export function renderTable(columns, data, onDataChange) {
  _columns = [...columns];
  _data = data;
  _onDataChange = onDataChange || null;

  const section = document.getElementById('resultSection');
  section.style.display = 'block';

  buildTable();
  updateBadge();
  renderToolbar();

  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Clear and hide the result table. */
export function clearTable() {
  _columns = [];
  _data = [];
  _onDataChange = null;

  const section = document.getElementById('resultSection');
  section.style.display = 'none';

  const toolbar = section.querySelector('.table-toolbar');
  if (toolbar) toolbar.remove();

  // Hide the add-column-to-result button
  const addColBtn = document.getElementById('addColToResult');
  if (addColBtn) addColBtn.style.display = 'none';
}

/** Add a new empty row to the live table. */
export function addRow() {
  if (!_columns.length) return;
  const row = {};
  _columns.forEach(c => { row[c] = null; });
  _data.push(row);
  buildTable();
  updateBadge();
  if (_onDataChange) _onDataChange(_data);

  const lastCell = document.querySelector(`[data-row="${_data.length - 1}"].editable-cell`);
  if (lastCell) startEditing(lastCell);
}

/** Prompt for a new column name and add it to the live table. */
export function addColumn() {
  const name = prompt('Column name:');
  if (!name || !name.trim()) return;

  const col = name.trim();
  if (_columns.includes(col)) {
    alert('A column with this name already exists.');
    return;
  }

  _columns.push(col);
  _data.forEach(row => { row[col] = null; });
  buildTable();
  if (_onDataChange) _onDataChange(_data);
}

// ── Private helpers ─────────────────────────────────

function buildTable() {
  const wrap = document.getElementById('tableWrap');
  if (!wrap) return;

  // Handle empty data
  if (!_data || _data.length === 0) {
    wrap.innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--text-tertiary);font-size:var(--text-sm);">
        <i class="ti ti-table-off" style="font-size:24px;display:block;margin-bottom:8px;"></i>
        No records found for the given columns.
      </div>
    `;
    return;
  }

  let html = '<table><thead><tr>';
  html += '<th class="row-num-th">#</th>';
  _columns.forEach(c => { html += `<th>${esc(c)}</th>`; });
  html += '<th class="action-th"></th></tr></thead><tbody>';

  _data.forEach((row, ri) => {
    html += `<tr data-row="${ri}"><td class="row-num">${ri + 1}</td>`;
    _columns.forEach(c => {
      const val = row[c];
      const empty = val === null || val === undefined || val === '';
      const display = empty ? '' : String(val);
      html += `<td class="editable-cell${empty ? ' null-cell' : ''}" data-row="${ri}" data-col="${escAttr(c)}" title="Click to edit">${empty ? '—' : esc(display)}</td>`;
    });
    html += `<td class="row-actions"><button class="btn-delete-row" data-row="${ri}" title="Delete row"><i class="ti ti-trash"></i></button></td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  wrap.innerHTML = html;

  wrap.querySelectorAll('.editable-cell').forEach(cell => {
    cell.addEventListener('click', () => startEditing(cell));
  });

  wrap.querySelectorAll('.btn-delete-row').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteRow(parseInt(btn.dataset.row, 10));
    });
  });
}

function startEditing(cell) {
  if (cell.querySelector('input')) return;

  const ri = parseInt(cell.dataset.row, 10);
  const col = cell.dataset.col;
  const current = _data[ri][col];
  const display = current == null ? '' : String(current);

  cell.classList.remove('null-cell');
  cell.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cell-editor';
  input.value = display;
  cell.appendChild(input);
  input.focus();
  input.select();

  const commit = () => {
    const val = input.value.trim();
    _data[ri][col] = val === '' ? null : val;
    cell.classList.toggle('null-cell', val === '');
    cell.textContent = val === '' ? '—' : val;
    if (val !== '') cell.title = val;
    if (_onDataChange) _onDataChange(_data);
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') {
      cell.classList.toggle('null-cell', display === '');
      cell.textContent = display === '' ? '—' : display;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      input.blur();
      const all = [...document.querySelectorAll('.editable-cell')];
      const next = all[all.indexOf(cell) + (e.shiftKey ? -1 : 1)];
      if (next) startEditing(next);
    }
  });
}

function deleteRow(ri) {
  _data.splice(ri, 1);
  buildTable();
  updateBadge();
  if (_onDataChange) _onDataChange(_data);
}

function updateBadge() {
  const badge = document.getElementById('rowBadge');
  if (badge) badge.textContent = `${_data.length} row${_data.length === 1 ? '' : 's'}`;
}

function renderToolbar() {
  const section = document.getElementById('resultSection');
  section.querySelector('.table-toolbar')?.remove();

  const toolbar = document.createElement('div');
  toolbar.className = 'table-toolbar';
  toolbar.innerHTML = `
    <div style="display:flex;gap:var(--space-sm);">
      <button class="btn-add-row" id="addRowBtn"><i class="ti ti-row-insert-bottom"></i> Add row</button>
      <button class="btn-add-row" id="addColBtn"><i class="ti ti-column-insert-right"></i> Add column</button>
    </div>
    <span class="edit-hint"><i class="ti ti-edit"></i> Click any cell to edit</span>
  `;

  const wrap = document.getElementById('tableWrap');
  wrap.parentNode.insertBefore(toolbar, wrap.nextSibling);

  document.getElementById('addRowBtn').addEventListener('click', addRow);
  document.getElementById('addColBtn').addEventListener('click', addColumn);
}

// ── Escape helpers ───────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(s) {
  return String(s).replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
