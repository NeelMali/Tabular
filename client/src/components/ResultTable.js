/**
 * Editable result table.
 * Uses event delegation (single listener) for performance with large datasets.
 */

let _columns = [];
let _data = [];
let _onDataChange = null;

// ── Public API ──────────────────────────────────────

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

export function clearTable() {
  _columns = [];
  _data = [];
  _onDataChange = null;

  const section = document.getElementById('resultSection');
  section.style.display = 'none';
  section.querySelector('.table-toolbar')?.remove();

  const addColBtn = document.getElementById('addColToResult');
  if (addColBtn) addColBtn.style.display = 'none';
}

export function addRow() {
  if (!_columns.length) return;
  const row = {};
  _columns.forEach(c => { row[c] = null; });
  _data.push(row);
  buildTable();
  updateBadge();
  if (_onDataChange) _onDataChange(_data);
}

export function addColumn() {
  const name = prompt('Column name:');
  if (!name || !name.trim()) return;
  const col = name.trim();
  if (_columns.includes(col)) { alert('Column already exists.'); return; }

  _columns.push(col);
  _data.forEach(row => { row[col] = null; });
  buildTable();
  if (_onDataChange) _onDataChange(_data);
}

// ── Table rendering ─────────────────────────────────

function buildTable() {
  const wrap = document.getElementById('tableWrap');
  if (!wrap) return;

  if (!_data || _data.length === 0) {
    wrap.innerHTML = `
      <div style="padding:2rem;text-align:center;color:var(--text-tertiary);font-size:var(--text-sm);">
        <i class="ti ti-table-off" style="font-size:24px;display:block;margin-bottom:8px;"></i>
        No records found.
      </div>`;
    return;
  }

  // Build HTML as array for speed
  const parts = ['<table><thead><tr><th class="row-num-th">#</th>'];
  for (const c of _columns) parts.push(`<th>${esc(c)}</th>`);
  parts.push('<th class="action-th"></th></tr></thead><tbody>');

  for (let ri = 0; ri < _data.length; ri++) {
    const row = _data[ri];
    parts.push(`<tr data-row="${ri}"><td class="row-num">${ri + 1}</td>`);
    for (const c of _columns) {
      const val = row[c];
      const empty = val === null || val === undefined || val === '';
      parts.push(`<td class="editable-cell${empty ? ' null-cell' : ''}" data-row="${ri}" data-col="${escAttr(c)}">${empty ? '—' : esc(String(val))}</td>`);
    }
    parts.push(`<td class="row-actions"><button class="btn-delete-row" data-row="${ri}"><i class="ti ti-trash"></i></button></td></tr>`);
  }

  parts.push('</tbody></table>');
  wrap.innerHTML = parts.join('');

  // Single event listener via delegation (instead of one per cell)
  wrap.onclick = handleTableClick;
}

// ── Event delegation ────────────────────────────────

function handleTableClick(e) {
  const cell = e.target.closest('.editable-cell');
  if (cell) { startEditing(cell); return; }

  const delBtn = e.target.closest('.btn-delete-row');
  if (delBtn) {
    e.stopPropagation();
    deleteRow(parseInt(delBtn.dataset.row, 10));
  }
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

// ── Badge & Toolbar ─────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
  return String(s).replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
