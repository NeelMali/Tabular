/**
 * File upload component with drag-and-drop.
 */
export function initFileUpload(onFileSelected) {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileBadge = document.getElementById('fileBadge');

  // Drag & drop events
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) selectFile(e.target.files[0]);
  });

  function selectFile(file) {
    // Validate extension
    const ext = file.name.split('.').pop().toLowerCase();
    const allowed = ['pdf', 'xlsx', 'xls', 'docx', 'csv', 'jpg', 'jpeg', 'png', 'webp'];
    if (!allowed.includes(ext)) {
      onFileSelected(null, `Unsupported file type: .${ext}`);
      return;
    }

    // Show file badge
    const typeIcons = {
      pdf: 'ti-file-type-pdf',
      xlsx: 'ti-file-spreadsheet',
      xls: 'ti-file-spreadsheet',
      docx: 'ti-file-type-doc',
      csv: 'ti-file-type-csv',
      jpg: 'ti-photo',
      jpeg: 'ti-photo',
      png: 'ti-photo',
      webp: 'ti-photo'
    };

    const sizeStr = formatFileSize(file.size);
    const icon = typeIcons[ext] || 'ti-file';

    fileBadge.innerHTML = `
      <div class="file-badge">
        <i class="ti ${icon}"></i>
        <span>${file.name}</span>
        <span style="opacity:0.6">(${sizeStr})</span>
        <i class="ti ti-x remove-file" title="Remove file"></i>
      </div>
    `;

    // Remove file button
    fileBadge.querySelector('.remove-file')?.addEventListener('click', (e) => {
      e.stopPropagation();
      fileBadge.innerHTML = '';
      fileInput.value = '';
      onFileSelected(null);
    });

    onFileSelected(file);
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
