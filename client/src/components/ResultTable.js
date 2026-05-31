/**
 * Render extracted data as a table.
 */
export function renderTable(columns, data) {
  const resultSection = document.getElementById('resultSection');
  const tableWrap = document.getElementById('tableWrap');
  const rowBadge = document.getElementById('rowBadge');

  resultSection.style.display = 'block';

  if (!data || data.length === 0) {
    tableWrap.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--text-tertiary); font-size: var(--text-sm);">
        <i class="ti ti-table-off" style="font-size: 24px; display: block; margin-bottom: 8px;"></i>
        No records found for the given columns.
      </div>
    `;
    rowBadge.textContent = '0 rows';
    return;
  }

  let html = '<table><thead><tr>';
  columns.forEach((c) => {
    html += `<th>${escapeHtml(c)}</th>`;
  });
  html += '</tr></thead><tbody>';

  data.forEach((row) => {
    html += '<tr>';
    columns.forEach((c) => {
      const val = row[c];
      if (val === null || val === undefined || val === '') {
        html += '<td class="null-cell">—</td>';
      } else {
        const safe = escapeHtml(String(val));
        html += `<td title="${safe}">${safe}</td>`;
      }
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  tableWrap.innerHTML = html;

  const count = data.length;
  rowBadge.textContent = `${count} row${count === 1 ? '' : 's'}`;

  // Scroll to results
  resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Clear the result table.
 */
export function clearTable() {
  const resultSection = document.getElementById('resultSection');
  resultSection.style.display = 'none';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
