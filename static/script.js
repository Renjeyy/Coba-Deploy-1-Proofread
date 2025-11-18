// =============================================
// ---         FUNGSI-FUNGSI HELPER (GLOBAL) ---
// =============================================

// REVISI: Variabel global
let currentAnalysisResults = null;
let currentAnalysisFeature = null;
let currentAnalysisFilename = null;
let currentUserId = null; // Akan diisi saat DOM load
let allUsersForDropdown = []; // TAMBAHKAN INI: Untuk menyimpan daftar user
let currentLogId = null;
let allTasks = []; // Untuk menyimpan data tugas
let currentCalendarYear = new Date().getFullYear();
let currentCalendarMonth = new Date().getMonth();

// FIX: Deklarasi global untuk elemen modal/kontainer (HANYA SATU KALI)
const folderGrid = document.getElementById("folder-grid");
const folderModal = document.getElementById("folder-modal");
const saveModal = document.getElementById("save-modal");
const shareModal = document.getElementById("share-modal");
const folderSelectDropdown = document.getElementById("folder-select-dropdown");
const folderHistoryDetail = document.getElementById("folder-history-detail");

/**
 * >>>>>> TAMBAHAN BARU: Fungsi untuk mengambil daftar user untuk dropdown <<<<<<
 */
async function loadUsersForDropdown() {
    try {
        const response = await fetch("/api/get_all_users");
        if (!response.ok) {
            throw new Error("Gagal memuat daftar user untuk dropdown.");
        }
        allUsersForDropdown = await response.json();
    } catch (error) {
        console.error("loadUsersForDropdown error:", error);
        // Tampilkan error global agar user tahu
        showError("Gagal memuat daftar pengguna untuk dropdown PIC.");
    }
}

async function toggleLogDropdown() {
    const dropdown = document.getElementById('log-dropdown-content');
    const isVisible = !dropdown.classList.contains('hidden');

    if (isVisible) {
        dropdown.classList.add('hidden');
    } else {
        dropdown.classList.remove('hidden');
        dropdown.innerHTML = '<div class="loading-spinner"></div>'; // Tampilkan loading
        try {
            const response = await fetch('/api/get_analysis_logs');
            if (!response.ok) throw new Error('Gagal mengambil log.');
            const logs = await response.json();
            renderLogTable(logs);
        } catch (error) {
            console.error(error);
            dropdown.innerHTML = `<p style="color: red; padding: 1rem;">Gagal memuat log.</p>`;
        }
    }
}

async function logAnalysisStart(filename, featureType) {
    try {
        const response = await fetch('/api/log_analysis_start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: filename, feature_type: featureType })
        });
        if (!response.ok) {
            // Jika error, kita tidak hentikan proses analisis, hanya cetak di console
            console.error("Gagal mencatat start log:", await response.json());
            return null;
        }
        const result = await response.json();
        return result.log_id; // Kembalikan ID log
    } catch (error) {
        console.error("Gagal menghubungi server untuk start log:", error);
        return null;
    }
}

async function logAnalysisEnd(logId, status) {
    if (!logId) return; // Jika tidak ada logId, tidak perlu kirim apa-apa
    try {
        await fetch('/api/log_analysis_end', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log_id: logId, status: status })
        });
    } catch (error) {
        console.error("Gagal mencatat end log:", error);
    }
}

function collectRowActionsFromTable() {
    // 1. Coba ambil dulu dari sessionStorage (untuk analisis baru)
    let tempActions = JSON.parse(sessionStorage.getItem('tempRowActions') || '{}');
    if (Object.keys(tempActions).length > 0) {
        // Jika ada data sementara, gunakan itu dan hapus agar tidak dipakai lagi
        sessionStorage.removeItem('tempRowActions');
        return tempActions;
    }

    // 2. Jika tidak ada data sementara, ambil dari tabel (untuk file yang sudah disimpan)
    const actions = {};
    const table = document.querySelector('.results-table-wrapper table');
    if (!table) return actions;

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach((row, index) => {
        const rowId = index + 1;
        const checkbox = row.querySelector('.action-checkbox');
        const dropdown = row.querySelector('.action-dropdown');

        if (checkbox && dropdown) {
            actions[rowId] = {
                is_ganti: checkbox.checked,
                pic_user_id: dropdown.value ? parseInt(dropdown.value) : null
            };
        }
    });
    return actions;
}

function renderLogTable(logs) {
    const dropdown = document.getElementById('log-dropdown-content');
    if (logs.length === 0) {
        dropdown.innerHTML = '<p style="padding: 1rem;">Belum ada riwayat analisis.</p>';
        return;
    }

    let tableHTML = `
        <table class="log-table">
            <thead>
                <tr>
                    <th>Nama File</th>
                    <th>Fitur</th>
                    <th>Mulai</th>
                    <th>Selesai</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    logs.forEach(log => {
        const statusClass = log.status === 'done' ? 'status-done' : log.status === 'error' ? 'status-error' : 'status-unfinished';
        tableHTML += `
            <tr>
                <td>${log.filename}</td>
                <td>${log.feature_type}</td>
                <td>${log.start_time}</td>
                <td>${log.end_time || '-'}</td>
                <td><span class="status-badge ${statusClass}">${log.status}</span></td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    dropdown.innerHTML = tableHTML;
}

// >>>>>> REVISION START: Fungsi Baru untuk Merender Thread Komentar <<<<<<
/**
 * Merender thread komentar (komentar beserta balasannya) menjadi HTML.
 * Fungsi ini bersifat rekursif untuk menangani komentar bersarang.
 * @param {Array} comments - Array dari objek komentar.
 * @param {number} level - Tingkat kedalaman komentar (untuk indentasi).
 * @returns {string} - String HTML dari thread komentar.
 */
function renderCommentThread(comments, level = 0) {
    if (!comments || comments.length === 0) {
        return '';
    }
    let html = '';
    comments.forEach(comment => {
        // Tambahkan class 'comment-reply' untuk indentasi visual
        const indentClass = level > 0 ? 'comment-reply' : '';
        html += `
            <div class="comment-item ${indentClass}">
                <div class="existing-comment">
                    <p><strong>${comment.username}</strong> <span class="comment-time">(${new Date(comment.timestamp).toLocaleString()})</span>:</p>
                    <p>${comment.text}</p>
                </div>
                <button class="comment-reply-btn" onclick="openCommentModal('${window.location.hash.replace('#', '')}', ${comment.row_id || 'null'}, event, ${comment.id})">
                    Reply
                </button>
                ${renderCommentThread(comment.replies, level + 1)}
            </div>
        `;
    });
    return html;
}
// >>>>>> REVISION END <<<<<<

/**
 * Menampilkan pesan kustom dalam modal, menggantikan alert() bawaan browser.
 */
function showCustomMessage(data, type = 'success') {
    const modal = document.getElementById("custom-message-modal");
    if (!modal) {
        console.error("Modal Pesan Kustom tidak ditemukan. Menggunakan alert() sebagai fallback.");
        const message = typeof data === 'string' ? data : data.message || 'Terjadi kesalahan.';
        alert(message);
        return;
    }

    const titleElem = document.getElementById("custom-message-title");
    const textElem = document.getElementById("custom-message-text");
    const detailsElem = document.getElementById("custom-message-details");
    const okBtn = document.getElementById("custom-message-ok-btn");

    // --- Siapkan data title, message, dan details ---
    let title, message, details;

    if (typeof data === 'object' && data !== null) {
        title = data.title || 'Pemberitahuan';
        message = data.message;
        details = data.details;
    } else {
        // Kompatibilitas untuk pemanggilan lama (yang menggunakan string)
        title = 'Pemberitahuan';
        message = data;
        details = null;
    }

    // --- Set judul modal ---
    titleElem.textContent = title;

    // --- Tampilkan detail atau pesan sederhana ---
    if (details && typeof details === 'object') {
        let detailsHTML = '';
        for (const key in details) {
            detailsHTML += `
                <p style="margin: 0.5rem 0; font-size: 1rem;">
                    <strong>${key}:</strong> ${details[key]}
                </p>
            `;
        }
        detailsElem.innerHTML = detailsHTML;
        detailsElem.style.display = 'block'; // Tampilkan detail
        textElem.style.display = 'none';     // Sembunyikan pesan sederhana
    } else {
        detailsElem.style.display = 'none';     // Sembunyikan detail
        textElem.textContent = message || '';    // Tampilkan pesan sederhana
        textElem.style.display = 'block';        // Tampilkan elemen pesan
    }

    // --- Atur warna tombol berdasarkan tipe ---
    if (type === 'success') {
        okBtn.style.backgroundColor = 'var(--success)';
    } else if (type === 'error') {
        okBtn.style.backgroundColor = 'var(--danger)';
    } else {
        okBtn.style.backgroundColor = 'var(--info)';
    }

    // --- Event listener untuk menutup modal ---
    okBtn.onclick = () => {
        modal.classList.add("hidden");
    };

    modal.classList.remove("hidden");
}

/**
 * Fungsi baru untuk menampilkan modal konfirmasi kustom.
 */
function showCustomConfirm(message, callback, title = 'Konfirmasi') {
    const modal = document.getElementById("custom-confirm-modal");
    const titleElem = document.getElementById("custom-confirm-title");
    const textElem = document.getElementById("custom-confirm-text");
    const okBtn = document.getElementById("custom-confirm-ok-btn");
    const cancelBtn = document.getElementById("custom-confirm-cancel-btn");

    if (!modal) {
        console.error("Modal Konfirmasi Kustom tidak ditemukan. Menggunakan confirm() sebagai fallback.");
        if (confirm(message)) {
            callback(true);
        }
        return;
    }

    titleElem.textContent = title;
    textElem.textContent = message;
 
    okBtn.style.backgroundColor = 'var(--danger)';
 
    const closeModal = () => {
        modal.classList.add("hidden");
        okBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    okBtn.onclick = () => {
        closeModal();
        if (typeof callback === 'function') {
            callback(true); // Kirim true jika OK
        }
    };

    cancelBtn.onclick = () => {
        closeModal();
        if (typeof callback === 'function') {
            callback(false); // Kirim false jika Batal
        }
    };

    modal.classList.remove("hidden");
}


/** Menampilkan pesan error global */
function showError(message) {
  const globalErrorDiv = document.getElementById("global-error");
  if (globalErrorDiv) {
    globalErrorDiv.textContent = `Terjadi Kesalahan: ${message}`;
    globalErrorDiv.classList.remove("hidden");
  }
}

/** Menghilangkan pesan error global */
function clearError() {
  const globalErrorDiv = document.getElementById("global-error");
  if (globalErrorDiv) {
    globalErrorDiv.textContent = "";
    globalErrorDiv.classList.add("hidden");
  }
}

/**
 * >>>>>> REVISION START: Fungsi createTable yang dimodifikasi <<<<<<
 */
function createTable(data, headers, existingComments = [], actions = {}) {
  if (!data || data.length === 0) {
    return "<p>Tidak ada data untuk ditampilkan.</p>";
  }

  let a = 1
  let head = "<tr>";
  head += `<th>No.</th>`
  let customHeaders = {
      "Kata/Frasa Salah": "Salah",
      "Perbaikan Sesuai KBBI": "Perbaikan",
      "Pada Kalimat": "Konteks Kalimat",
      "Ditemukan di Halaman": "Halaman",
      "Kalimat Awal": "Kalimat Asli",
      "Kalimat Revisi": "Kalimat Revisi",
      "Kata yang Direvisi": "Perubahan",
      "topik": "Topik Utama",
      "asli": "Teks Asli",
      "saran": "Saran Revisi",
      "catatan": "Catatan", 
      "apakah_ganti": "Apakah perlu diganti?", // TAMBAHAN BARU
      "pic_proofread": "Telah diganti oleh", // TAMBAHAN BARU
      "finalize": "Finalize" // TAMBAHAN BARU
  };

  headers.forEach(header => {
    head += `<th>${customHeaders[header] || header}</th>`;
  });
  head += "</tr>";

  let body = "";
  data.forEach((row, index) => { 
    const rowId = index + 1; // ID baris saat ini (1-based index)
    const savedAction = actions[rowId] || {}; // >>>>>> AMBIL DATA TERSIMPAN <<<<<<
    
    body += "<tr>";
    body += `<td>${a++}</td>`
    
    headers.forEach(header => {
      let cellData = row[header] || "";
      let cellContent = '';
      
      const featureId = window.location.hash.replace('#', ''); 

      if ((header === "Kalimat Revisi" || header === "saran") && Array.isArray(cellData)) {
        // Logika untuk menampilkan kata yang berubah warna merah
        cellContent = cellData.map(part => {
            if (part.changed) {
                return `<span class="diff-changed">${part.text}</span>`;
            } else {
                return part.text;
            }
        }).join('');
      } 
      // >>>>>> MODIFIKASI: LOGIKA UNTUK KOLOM CHECKBOX <<<<<<
      else if (header === "apakah_ganti") {
        const isChecked = savedAction.is_ganti ? 'checked' : '';
        cellContent = `<input type="checkbox" class="action-checkbox" title="Centang jika perlu diganti" ${isChecked}>`;
      }
      // >>>>>> MODIFIKASI: LOGIKA UNTUK KOLOM DROPDOWN <<<<<<
      else if (header === "pic_proofread") {
        cellContent = `<select class="action-dropdown"><option value="">-- Pilih PIC --</option>`;
        // Gunakan daftar user yang sudah dimuat
        allUsersForDropdown.forEach(user => {
            const isSelected = (savedAction.pic_user_id == user.id) ? 'selected' : '';
            cellContent += `<option value="${user.id}" ${isSelected}>${user.username}</option>`;
        });
        cellContent += `</select>`;
      }
      // >>>>>> MODIFIKASI: LOGIKA UNTUK KOLOM FINALIZE <<<<<<
      else if (header === "finalize") {
        // >>>>>> TOMBOL SAVE DIENABLE SAAT PERTAMA KALI DIMUAT <<<<<<
        cellContent = `<button class="finalize-save-btn" onclick="saveRowState(${rowId}, event)">Save</button>`;
      }
      // >>>>>> REVISION START: LOGIKA UNTUK KOLOM "Pada Kalimat" <<<<<<
      else if (header === "Pada Kalimat") {
        const salahWord = row["Kata/Frasa Salah"]; // Ambil kata salah dari data baris
        if (salahWord && cellData.toLowerCase().includes(salahWord.toLowerCase())) {
          // Buat regular expression untuk mencari kata, case-insensitive
          const regex = new RegExp(`(${salahWord})`, 'gi');
          // Ganti kata tersebut dengan versi yang di-highlight
          cellContent = cellData.replace(regex, '<span class="highlight-error">$1</span>');
        } else {
          cellContent = cellData; // Tampilkan apa adanya jika tidak cocok
        }
      }
      
      else if (header === "Alasan") {
        cellContent = cellData.replace(/\n/g, '<br>');
      }

      else {
        // Untuk semua kolom lain
        cellContent = cellData;
      }
      
      body += `<td class="table-cell-${header}">${cellContent}</td>`;

    });
    body += "</tr>";
  });

  return `
    <div class="results-table-wrapper">
      <table>
        <thead>${head}</thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}
// >>>>>> REVISION END <<<<<<

/**
 * Menangani proses download file dari API. (Fungsi Anda dipertahankan)
 */
async function handleDownload(url, formData, defaultFilename = "download.dat") {
  clearError();
  try {
    const response = await fetch(url, { method: "POST", body: formData });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Gagal mengunduh file");
    }
    const blob = await response.blob();
    const contentDisposition = response.headers.get('content-disposition');
    let filename = defaultFilename;
    if (contentDisposition) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
    }
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(link.href);
  } catch (error) {
    showError(error.message);
  }
}

function renderCalendar(tasks, year, month) {
    const calendarEl = document.getElementById('task-calendar');
    if (!calendarEl) return;
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    
    let html = `
        <div class="calendar-header">
            <button id="calendar-prev-btn" class="calendar-nav-btn">&lt;</button>
            <span>${monthNames[month]} ${year}</span>
            <button id="calendar-next-btn" class="calendar-nav-btn">&gt;</button>
        </div>
        <div class="calendar-grid">
    `;

    // Hari-hari dalam seminggu
    const weekDays = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    weekDays.forEach(day => {
        html += `<div class="calendar-weekday">${day}</div>`;
    });

    // Hari-hari kosong sebelum tanggal 1
    for (let i = 0; i < firstDayOfMonth; i++) {
        html += `<div class="calendar-day other-month"></div>`;
    }

    // Hari-hari dalam bulan
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDay = new Date(year, month, day);
        const today = new Date();
        let classes = ['calendar-day'];
        
        if (currentDay.toDateString() === today.toDateString()) {
            classes.push('today');
        }

        const hasTask = tasks.some(task => {
            const taskDate = new Date(task.start_time);
            return taskDate.toDateString() === currentDay.toDateString();
        });

        if (hasTask) {
            classes.push('has-task');
        }
        
        html += `<div class="${classes.join(' ')}">${day}</div>`;
    }

    html += `</div>`;
    calendarEl.innerHTML = html;

    // --- TAMBAHKAN EVENT LISTENER UNTUK NAVIGASI ---
    document.getElementById('calendar-prev-btn').addEventListener('click', goToPreviousMonth);
    document.getElementById('calendar-next-btn').addEventListener('click', goToNextMonth);
}

function renderReminders(onProgressTasks, overdueTasks) {
    const onProgressListEl = document.getElementById('on-progress-list');
    const overdueListEl = document.getElementById('overdue-list');

    if (!onProgressListEl || !overdueListEl) return;

    if (onProgressTasks.length === 0) {
        onProgressListEl.innerHTML = '<li class="no-reminder">Tidak ada tugas yang sedang dikerjakan.</li>';
    } else {
        onProgressListEl.innerHTML = onProgressTasks.map(task => {
            const deadline = task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID') : 'Tidak ada deadline';
            return `<li><strong>${task.filename}</strong> (Deadline: ${deadline})</li>`;
        }).join('');
    }

    if (overdueTasks.length === 0) {
        overdueListEl.innerHTML = '<li class="no-reminder">Tidak ada tugas yang terlambat.</li>';
    } else {
        overdueListEl.innerHTML = overdueTasks.map(task => {
            const deadline = task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID') : 'Tidak ada deadline';
            return `<li><strong>${task.filename}</strong> (Terlewat sejak: ${deadline})</li>`;
        }).join('');
    }
}

function goToPreviousMonth() {
    currentCalendarMonth--;
    if (currentCalendarMonth < 0) {
        currentCalendarMonth = 11;
        currentCalendarYear--;
    }
    // Render ulang dengan data yang sudah ada
    const activeTasks = allTasks.filter(log => log.status !== 'done');
    renderCalendar(activeTasks, currentCalendarYear, currentCalendarMonth);
}

function goToNextMonth() {
    currentCalendarMonth++;
    if (currentCalendarMonth > 11) {
        currentCalendarMonth = 0;
        currentCalendarYear++;
    }

    const activeTasks = allTasks.filter(log => log.status !== 'done');
    renderCalendar(activeTasks, currentCalendarYear, currentCalendarMonth);
}

function renderReminders(onProgressTasks, overdueTasks) {
    const onProgressListEl = document.getElementById('on-progress-list');
    const overdueListEl = document.getElementById('overdue-list');

    if (!onProgressListEl || !overdueListEl) return;

    // Render On Progress
    if (onProgressTasks.length === 0) {
        onProgressListEl.innerHTML = '<li class="no-reminder">Tidak ada tugas yang sedang dikerjakan.</li>';
    } else {
        onProgressListEl.innerHTML = onProgressTasks.map(task => {
            const deadline = task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID') : 'Tidak ada deadline';
            return `<li><strong>${task.filename}</strong> (Deadline: ${deadline})</li>`;
        }).join('');
    }

    // Render Overdue
    if (overdueTasks.length === 0) {
        overdueListEl.innerHTML = '<li class="no-reminder">Tidak ada tugas yang terlambat.</li>';
    } else {
        overdueListEl.innerHTML = overdueTasks.map(task => {
            const deadline = task.deadline ? new Date(task.deadline).toLocaleDateString('id-ID') : 'Tidak ada deadline';
            return `<li><strong>${task.filename}</strong> (Terlewat sejak: ${deadline})</li>`;
        }).join('');
    }
}

async function fetchAndRenderDashboardWidgets() {
    try {
        const response = await fetch('/api/get_analysis_logs');
        if (!response.ok) throw new Error('Gagal mengambil data log untuk widget.');
        
        // SIMPAN DATA KE VARIABEL GLOBAL
        allTasks = await response.json();
        
        // Filter tugas yang tidak 'done'
        const activeTasks = allTasks.filter(log => log.status !== 'done');
        const onProgressTasks = allTasks.filter(log => log.status === 'on_progress');
        const overdueTasks = allTasks.filter(log => log.status === 'overdue');

        renderCalendar(activeTasks, currentCalendarYear, currentCalendarMonth);
        renderReminders(onProgressTasks, overdueTasks);

    } catch (error) {
        console.error("Gagal memuat widget dashboard:", error);
        document.getElementById('on-progress-list').innerHTML = '<li class="no-reminder">Gagal memuat data.</li>';
        document.getElementById('overdue-list').innerHTML = '';
    }
}
function openCommentModal(featureId, rowId, event, parentId = null) { 
    const button = event.target;
    const parent = button.parentElement;

    // FIX: Ambil folderName, fileName, dan ownerId dari container terdekat (#history-result-view)
    const resultViewContainer = button.closest('#history-result-view');
 
    let folderName, fileName, ownerId;

    if (resultViewContainer && resultViewContainer.dataset.folderName) {
        // KASUS 1: Komentar dari 'Lihat Isi Folder' (History View)
        folderName = resultViewContainer.dataset.folderName;
        fileName = resultViewContainer.dataset.fileName;
        ownerId = resultViewContainer.dataset.ownerId;
    } else {
        // KASUS 2: Komentar dari Analisis Langsung (Halaman Fitur)
        // Ini hanya berfungsi jika user baru saja menganalisis
        folderName = currentAnalysisFeature; 
        fileName = currentAnalysisFilename;   
        ownerId = currentUserId;             
    }


    if (!folderName || !fileName) {
        showCustomMessage("Error: Tidak dapat menentukan folder atau nama file untuk menyimpan komentar. Silakan simpan hasil ke folder terlebih dahulu.", 'error', 'Error Data');
        return;
    }
 
    if (!ownerId) {
        showCustomMessage("Error: User ID (ownerId) tidak terdeteksi untuk menyimpan komentar.", 'error', 'Error Data');
        return;
    }


    if (parent.querySelector(".inline-comment-box")) return;

    // Buat container box
    const box = document.createElement("div");
    box.className = "inline-comment-box";
    box.innerHTML = `
        <textarea class="comment-input" placeholder="Tulis komentar kamu..."></textarea>
        <div class="comment-actions">
            <button class="comment-send-btn">Kirim</button>
            <button class="comment-cancel-btn">Batal</button>
        </div>
    `;

    button.style.display = "none";
    parent.appendChild(box);

    // Event tombol batal
    box.querySelector(".comment-cancel-btn").onclick = () => {
        parent.removeChild(box);
        button.style.display = "inline-block";
    };

    // Event tombol kirim
    box.querySelector(".comment-send-btn").onclick = async () => {
        const text = box.querySelector(".comment-input").value.trim();
        if (!text) {
            showCustomMessage("Komentar tidak boleh kosong!", 'info', 'Peringatan'); 
            return;
        }

        try {
            const response = await fetch("/add_comment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    folderName: folderName, 
                    fileName: fileName,
                    rowId: rowId, 
                    text: text,
                    // >>>>>> KIRIM PARENT ID <<<<<<
                    parentId: parentId
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Kesalahan server.");
            }

            const result = await response.json();
            showCustomMessage(result.message, 'success', 'Komentar Terkirim'); 
            parent.removeChild(box);
            button.style.display = "inline-block";
 
            // FIX: Refresh tampilan hasil analisis untuk memuat komentar baru
            if (resultViewContainer) {
                // KASUS 1: Refresh tampilan history
                const currentOwnerId = resultViewContainer.dataset.ownerId;
                viewResultFile(folderName, fileName, currentOwnerId, featureId, { target: button });
            }


        } catch (err) {
            console.error(err);
            showCustomMessage(`Gagal mengirim komentar: ${err.message}`, 'error', 'Error Komentar'); 
        }
    };
}

async function loadUserFolders() {
    if (!folderGrid) return; 

    folderGrid.innerHTML = `
      <div class="loading folder-loading" style="grid-column: 1 / -1; width: 100%; text-align: center;">
        <div class="spinner"></div> Memuat folder...
      </div>`;
 
    if (folderHistoryDetail) {
        folderHistoryDetail.classList.add('hidden');
    }
    folderGrid.classList.remove('hidden');
    const folderHeader = document.querySelector('.folder-header');
    if (folderHeader) {
        folderHeader.classList.remove('hidden');
    }

    try {
        const response = await fetch("/api/list_folders");
        if (!response.ok) {
            let errText = "Gagal memuat daftar folder.";
            try {
                // Coba parse error sebagai JSON
                const err = await response.json();
                // Periksa apakah error karena redirect login
                if (response.status === 401 || (typeof err === 'string' && err.includes("<!doctype html>"))) {
                     errText = "Sesi Anda telah berakhir. Silakan login kembali.";
                } else {
                     errText = err.error || errText;
                }
            } catch (e) {
                // Jika gagal parse (karena ini HTML halaman login), berikan pesan sesi
                errText = "Gagal terhubung ke server atau sesi berakhir.";
            }
            throw new Error(errText);
        }
        
        const folders = await response.json(); // Ini adalah list of objects
 
        if (folders.length === 0) {
          folderGrid.innerHTML = `<p class="no-folder" style="grid-column: 1 / -1;">
            Belum ada folder. Silakan buat folder untuk mulai menyimpan hasil.
          </p>`;
          return;
        }
 
        folderGrid.innerHTML = ''; // Bersihkan loading
        folders.forEach(folder => { // REVISI: Ganti 'folderName' ke 'folder' (objek)
          const folderCard = document.createElement("div");
          folderCard.className = "feature-card folder-card";
          folderCard.setAttribute("data-name", folder.name); // Gunakan folder.name
 
          // Tentukan apakah tombol share/delete harus ditampilkan
          const ownerControls = `
            <button class="folder-share-btn-text" onclick="openShareModal('${folder.name}', event)">
                Share Folder
            </button>
            <button class="folder-delete-btn-text" onclick="deleteFolder('${folder.name}', event)">
                Delete Folder
            </button>
          `;
 
          // REVISI: Menggunakan HTML untuk tombol "Delete Folder" dan "Share"
          folderCard.innerHTML = `
            <div class="workspace-card-content">
              <div class="folder-card-header">
                <h3>${folder.name}</h3> <div class="folder-actions">
                    ${!folder.is_owner ? `<span class="folder-owner-label">(Di-share oleh: ${folder.owner_name})</span>` : ''}
                    
                    ${folder.is_owner ? ownerControls : ''}
                </div>
              </div>
              <p>Klik untuk melihat riwayat analisis.</p>
            </div>
            <button class="feature-btn history-btn" 
                onclick="viewFolderHistory('${folder.name}', ${folder.owner_id})"> Lihat Isi Folder
            </button>
          `;
          folderGrid.appendChild(folderCard);
        });
        
    } catch (error) {
        folderGrid.innerHTML = `<p class="error-flash" style="grid-column: 1 / -1;">
          Gagal memuat folder: ${error.message}
        </p>`;
        showError(error.message); // Tampilkan juga di error global
    }
}

/** REVISI: Fungsi ini sekarang mengambil data riwayat dari backend */
async function viewFolderHistory(folderName, ownerId) {
    if (folderGrid) folderGrid.classList.add('hidden');
    const folderHeader = document.querySelector('.folder-header');
    if (folderHeader) folderHeader.classList.add('hidden');
    if (folderHistoryDetail) folderHistoryDetail.classList.remove("hidden");
 
    if (folderHistoryDetail) {
        // Tampilkan loading dulu
        folderHistoryDetail.innerHTML = `
            <h3 style="text-align:center;">Riwayat Analisis di Folder: ${folderName}</h3>
            <button class="back-btn" onclick="navGoToFolder()">← Kembali ke Daftar Folder</button>
            <div class="loading folder-loading">
                <div class="spinner"></div> Memuat riwayat file...
            </div>
            <div id="history-table-container"></div>
            <div id="history-result-view" class="feature-section hidden" style="margin-top: 2rem; background-color: white; border: 1px solid var(--border-light); padding: 1.5rem; border-radius: 12px;"></div>
        `;
        folderHistoryDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });

        try {
            // Panggil API baru
            const response = await fetch(`/api/folder_history/${ownerId}/${folderName}`);
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Gagal memuat riwayat folder.");
            }
 
            const historyFiles = await response.json();
            const tableContainer = document.getElementById("history-table-container");
 
            // Hapus placeholder loading
            const loadingPlaceholder = folderHistoryDetail.querySelector('.loading-detail, .loading');
            if (loadingPlaceholder) loadingPlaceholder.remove();

            if (historyFiles.length === 0) {
                tableContainer.innerHTML = "<p style='text-align:center;'>Folder ini kosong. Belum ada hasil analisis yang disimpan.</p>";
                return;
            }

            // Dapatkan ID user saat ini dari data-user-id di body
            const currentUserId = document.body.dataset.userId;

            // Buat tabel dari data riwayat
            let tableHTML = `
                <div class="results-table-wrapper">
                <table class="history-table">
                    <thead>
                    <tr>
                        <th>Nama File Asli</th>
                        <th>Fitur</th>
                        <th>Waktu Simpan</th>
                        <th>Aksi</th>
                    </tr>
                    </thead>
                    <tbody>
            `;
 
            historyFiles.forEach(file => {
                // Hanya pemilik yang bisa menghapus
                const deleteButton = (String(ownerId) === String(currentUserId)) ? 
                    `<button class="delete-result-btn" onclick="deleteResultFile('${folderName}', '${file.filename}', ${ownerId}, event)">Hapus</button>` : '';
 
                // --- MODIFIKASI: Tambahkan Tombol View ---
                const viewButton = `<button class="view-result-btn" onclick="viewResultFile('${folderName}', '${file.filename}', ${ownerId}, '${file.feature_type}', event)">View</button>`;

                tableHTML += `
                    <tr>
                        <td>${file.original_name}</td>
                        <td>${file.feature_type}</td>
                        <td>${file.timestamp}</td>
                        <td class="action-cell">
                            ${viewButton} ${deleteButton}
                        </td>
                    </tr>
                `;
            });
            // --- AKHIR MODIFIKASI ---
 
            tableHTML += `</tbody></table></div>`;
            tableContainer.innerHTML = tableHTML;
 
        } catch (error) {
            folderHistoryDetail.innerHTML = `
                <h3 style="text-align:center;">Riwayat Analisis di Folder: ${folderName}</h3>
                <button class="back-btn" onclick="navGoToFolder()">← Kembali ke Daftar Folder</button>
                <p class="error-flash">${error.message}</p>
            `;
        }
    }
}

// --- TAMBAHAN BARU: Fungsi untuk melihat isi file JSON ---
async function viewResultFile(folderName, filename, ownerId, featureType, event) {
    const viewButton = event.target;
    viewButton.textContent = "...";
    viewButton.disabled = true;

    const resultViewContainer = document.getElementById("history-result-view");
    resultViewContainer.classList.remove("hidden");
    resultViewContainer.innerHTML = `<div class="loading"><div class="spinner"></div> Memuat hasil...</div>`;
    resultViewContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // FIX: Simpan data file dan ownerId ke container untuk diakses openCommentModal
    resultViewContainer.setAttribute('data-folder-name', folderName);
    resultViewContainer.setAttribute('data-file-name', filename);
    resultViewContainer.setAttribute('data-owner-id', ownerId); 

    try {
        // 1. Ambil Data Hasil (JSON) dan actions
        const resultResponse = await fetch("/api/get_result_file", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder_name: folderName, filename: filename, owner_id: ownerId })
        });
        if (!resultResponse.ok) {
            const err = await resultResponse.json();
            throw new Error(err.error || "Gagal memuat data hasil.");
        }
 
        const result = await resultResponse.json();
        const data = result.data; // Ini adalah data hasil analisis
        const actions = result.actions || {}; // >>>>>> AMBIL DATA ACTIONS <<<<<<
        
        // 2. Ambil Komentar Terkait (API BARU)
        const commentsResponse = await fetch("/api/get_comments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folder_name: folderName, filename: filename })
        });
        const existingComments = await commentsResponse.json(); // Array of comments

        // 3. Tentukan header tabel berdasarkan feature_type
        let headers;
        if (featureType === 'proofreading') {
            headers = ["Kata/Frasa Salah", "Perbaikan Sesuai KBBI", "Pada Kalimat", "Ditemukan di Halaman", "apakah_ganti", "pic_proofread", "finalize"];
        } else if (featureType === 'restructure') {
            headers = ["Paragraf yang Perlu Dipindah", "Lokasi Asli", "Saran Lokasi Baru", "apakah_ganti", "pic_proofread", "finalize"];
        } else if (featureType === 'compare') {
            headers = ["Sub-bab Asal", "Kalimat yang Menyimpang", "Alasan"];
        } else if (featureType === 'coherence') {
            headers = ["topik", "asli", "saran", "catatan", "apakah_ganti", "pic_proofread", "finalize"];
        } else {
            headers = Object.keys(data[0] || {});
        }

        resultViewContainer.innerHTML = `
            <h4>Detail Hasil: ${filename}</h4>
            <button class="back-btn" style="margin-bottom: 1rem;" onclick="document.getElementById('history-result-view').classList.add('hidden')">Tutup Tampilan</button>
            ${createTable(data, headers, existingComments, actions)} <!-- FIX: Kirim komentar dan actions di sini -->
        `;

        // >>>>>> TAMBAHAN BARU: Tambahkan event listener untuk perubahan <<<<<<
        const resultTable = resultViewContainer.querySelector('table');
        if (resultTable) {
            resultTable.addEventListener('change', (event) => {
                // Cek apakah perubahan terjadi di checkbox atau dropdown
                if (event.target.classList.contains('action-checkbox') || event.target.classList.contains('action-dropdown')) {
                    // Temukan baris dan tombol Save terkait
                    const row = event.target.closest('tr');
                    const saveButton = row.querySelector('.finalize-save-btn');
                    if (saveButton) {
                        saveButton.disabled = false; // Aktifkan tombol Save
                        saveButton.textContent = 'Save'; // Kembalikan teks ke 'Save'
                    }
                }
            });
        }
        // >>>>>> AKHIR TAMBAHAN BARU <<<<<<


    } catch (error) {
        resultViewContainer.innerHTML = `<p class="error-flash">${error.message}</p>`;
    } finally {
        viewButton.textContent = "View";
        viewButton.disabled = false;
    }
}
// --- AKHIR TAMBAHAN BARU ---

/** TAMBAHAN BARU: Fungsi untuk menghapus file hasil */
async function deleteResultFile(folderName, filename, ownerId, event) {
    const confirmationMessage = `Apakah Anda yakin ingin menghapus file hasil "${filename}"? Tindakan ini tidak dapat dibatalkan.`;

    // Mengganti confirm() bawaan browser
    showCustomConfirm(confirmationMessage, async (isConfirmed) => {
        if (!isConfirmed) {
            return;
        }
 
        const deleteButton = event.target;
        deleteButton.textContent = "...";
        deleteButton.disabled = true;

        try {
            const response = await fetch("/api/delete_result", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folder_name: folderName, filename: filename, owner_id: ownerId })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Gagal menghapus file.");
            }
 
            const result = await response.json();
            // Hapus baris dari tabel
            deleteButton.closest("tr").remove();
            showCustomMessage(result.message, 'success', 'Penghapusan Berhasil'); // Ganti alert

        } catch (error) {
            showError(error.message);
            deleteButton.textContent = "Hapus";
            deleteButton.disabled = false;
        }
    }, 'Hapus Riwayat File');
}


/** Menangani penghapusan folder */
async function deleteFolder(folderName, event) {
    // Hentikan event agar tidak mengklik kartu "Lihat Isi Folder"
    event.stopPropagation(); 

    const confirmationMessage = `Apakah Anda yakin ingin menghapus folder "${folderName}"? Semua hasil analisis di dalamnya akan hilang permanen.`;

    // Mengganti confirm() bawaan browser
    showCustomConfirm(confirmationMessage, async (isConfirmed) => {
        if (!isConfirmed) {
            return;
        }

        const deleteButton = event.target;
        deleteButton.innerHTML = "&hellip;"; 
        deleteButton.style.pointerEvents = "none";

        try {
            const response = await fetch("/api/delete_folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ folder_name: folderName })
            });

            if (!response.ok) {
                let errText = "Gagal menghapus folder.";
                try {
                    const err = await response.json();
                    if (response.status === 401 || (typeof err === 'string' && err.includes("<!doctype html>"))) {
                         errText = "Sesi Anda telah berakhir. Silakan login kembali.";
                    } else {
                         errText = err.error || errText;
                    }
                } catch (e) {
                     errText = "Server error. Periksa terminal `app.py`.";
                }
                throw new Error(errText);
            }
 
            const result = await response.json();
            showCustomMessage(result.message, 'success', 'Penghapusan Berhasil'); // Ganti alert
            loadUserFolders(); // Muat ulang daftar folder

        } catch (error) {
            showError(error.message);
            deleteButton.textContent = "Delete Folder";
            deleteButton.style.pointerEvents = "auto";
        }
    }, 'Hapus Folder');
}


/**
 * REVISI: Membuka modal Simpan ke Folder dan memuat dropdown folder
 * Versi ini lebih robust dengan pengecekan error yang lebih baik.
 */
async function openSaveModal(featureId, resultsData, filename) {
    // --- CEK 1: Pastikan data hasil analisis ada ---
    if (!resultsData || resultsData.length === 0) {
        showError("Tidak ada hasil analisis yang bisa disimpan. Mungkin data sudah tidak tersedia. Silakan coba analisis ulang.");
        return;
    }

    // --- CEK 2: Pastikan data pendukung lain ada ---
    if (!featureId || !filename) {
        showError("Informasi fitur atau nama file tidak lengkap. Silakan coba analisis ulang.");
        return;
    }

    // Update variabel global
    currentAnalysisResults = resultsData;
    currentAnalysisFeature = featureId;
    currentAnalysisFilename = filename;

    // --- CEK 3: Pastikan elemen modal ada di halaman ---
    if (!saveModal) {
        console.error("Elemen modal dengan ID 'save-modal' tidak ditemukan!");
        showError("Terjadi kesalahan pada halaman: Modal penyimpanan tidak ditemukan.");
        return;
    }
    
    // --- CEK 4: Pastikan elemen dropdown ada ---
    if (!folderSelectDropdown) {
        console.error("Elemen dropdown dengan ID 'folder-select-dropdown' tidak ditemukan!");
        showError("Terjadi kesalahan pada halaman: Dropdown folder tidak ditemukan.");
        return;
    }

    // Jika semua cek lulus, tampilkan modal
    document.getElementById("save-modal-feature-name").textContent = featureId.toUpperCase();
    saveModal.classList.remove("hidden");
 
    // Muat daftar folder ke dropdown
    folderSelectDropdown.innerHTML = '<option value="">-- Pilih Folder --</option>';
    document.getElementById("save-modal-loading").classList.remove("hidden");
    document.getElementById("save-modal-error").classList.add("hidden"); 
 
    try {
        const response = await fetch("/api/list_folders");
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Gagal memuat daftar folder.");
        }
 
        const folders = await response.json(); // Ini list of objects
 
        folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = `${folder.name}|${folder.owner_id}`;
            option.textContent = folder.name;
            if (!folder.is_owner) {
                option.textContent += ` (Di-share oleh: ${folder.owner_name})`;
            }
            folderSelectDropdown.appendChild(option);
        });
 
    } catch (error) {
        document.getElementById("save-modal-error").textContent = error.message;
        document.getElementById("save-modal-error").classList.remove("hidden");
    } finally {
        document.getElementById("save-modal-loading").classList.add("hidden");
    }
}

/** TAMBAHAN BARU: Membuka modal Share Folder (REVISI untuk Tabel) */
async function openShareModal(folderName, event) {
    event.stopPropagation(); // Hentikan klik
 
    // REVISI: Dapatkan body tabel, bukan dropdown
    const userTableBody = document.getElementById("share-user-table-body"); 
    const shareModalError = document.getElementById("share-modal-error");
    const shareModalLoading = document.getElementById("share-modal-loading");
 
    document.getElementById("share-modal-folder-name").textContent = folderName;
    shareModal.classList.remove("hidden");
 
    userTableBody.innerHTML = ''; // Kosongkan tabel
    shareModalError.classList.add("hidden");
    shareModalLoading.classList.remove("hidden");

    try {
        const response = await fetch("/api/get_all_users");
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Gagal memuat daftar pengguna.");
        }
 
        const users = await response.json();
 
        if (users.length === 0) {
             userTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">Tidak ada pengguna lain untuk di-share.</td></tr>';
        } else {
            let tableHTML = '';
            users.forEach(user => {
                tableHTML += `
                    <tr>
                        <td><input type="checkbox" class="share-user-checkbox" value="${user.id}"></td>
                        <td>${user.username}</td>
                        <td>${user.label}</td>
                    </tr>
                `;
            });
            userTableBody.innerHTML = tableHTML;
        }

    } catch (error) {
        shareModalError.textContent = error.message;
        shareModalError.classList.remove("hidden");
    } finally {
        shareModalLoading.classList.add("hidden");
    }
}


// ==============================================================
// ---         FUNGSI MEMERIKSA SESSION STORAGE (MODIFIKASI) ---
// ==============================================================

function checkSessionStorage(pageId) {
  let storageKey, tableDiv, containerDiv, headers;

  if (pageId === 'proofreading') {
    storageKey = 'proofreadResults';
    tableDiv = document.getElementById("proofread-results-table");
    containerDiv = document.getElementById("proofread-results-container");
    headers = ["Kata/Frasa Salah", "Perbaikan Sesuai KBBI", "Pada Kalimat", "Ditemukan di Halaman", "apakah_ganti", "pic_proofread", "finalize"];
 
  } else if (pageId === 'restructure') {
    storageKey = 'restructureResults';
    tableDiv = document.getElementById("restructure-results-table");
    containerDiv = document.getElementById("restructure-results-container");
    headers = ["Paragraf yang Perlu Dipindah", "Lokasi Asli", "Saran Lokasi Baru", "apakah_ganti", "pic_proofread", "finalize"];
 
  } else if (pageId === 'compare') {
    storageKey = 'compareResults';
    tableDiv = document.getElementById("compare-results-table");
    containerDiv = document.getElementById("compare-results-container");
    headers = ["Sub-bab Asal", "Kalimat yang Menyimpang di dokumen lainnya", "Alasan"];
 
  } else if (pageId === 'coherence') { // REVISI: Ditambahkan coherence// REVISI: Ditambahkan coherence
    storageKey = 'coherenceResults';
    tableDiv = document.getElementById("coherence-results-table");
    containerDiv = document.getElementById("coherence-results-container");
    headers = ["topik", "asli", "saran", "catatan", "apakah_ganti", "pic_proofread", "finalize"];
    
  } else {
    return; // Tidak ada session storage untuk halaman lain
  }

  // Pastikan elemen ada sebelum mencoba mengaksesnya
  if (!tableDiv || !containerDiv) return;

  const storedData = sessionStorage.getItem(storageKey);
  const savedFile = sessionStorage.getItem(`${pageId}Filename`);
  const saveBtn = document.getElementById(`${pageId}-save-btn`);

  if (storedData) {
    try {
      const data = JSON.parse(storedData);
      if (data && data.length > 0) {
        const tempActions = JSON.parse(sessionStorage.getItem('tempRowActions') || '{}');
        // Untuk analisis baru, actions akan kosong
        tableDiv.innerHTML = createTable(data, headers, [], tempActions);
        containerDiv.classList.remove("hidden");
 
        // Setup variabel global untuk Save Button
        currentAnalysisResults = data;
        currentAnalysisFeature = pageId;
        currentAnalysisFilename = savedFile;
        if (saveBtn) saveBtn.classList.remove("hidden");
      }
    } catch (e) {
      console.error("Gagal mem-parse data session storage:", e);
      sessionStorage.removeItem(storageKey); // Hapus data yang rusak
      if (saveBtn) saveBtn.classList.add("hidden");
    }
  }
}


// =============================================
// ---         EVENT LISTENERS (DIMUAT SETELAH DOM) ---
// =============================================

document.addEventListener("DOMContentLoaded", () => {

  // --- Ambil User ID dari body (diset oleh index.html) ---
  currentUserId = document.body.dataset.userId;

  const folderGrid = document.getElementById("folder-grid");
  const folderModal = document.getElementById("folder-modal");
  const saveModal = document.getElementById("save-modal");
  const shareModal = document.getElementById("share-modal");
  const folderSelectDropdown = document.getElementById("folder-select-dropdown");
  const folderHistoryDetail = document.getElementById("folder-history-detail");

  loadUsersForDropdown();

  // --- Referensi Elemen Fitur (Dipertahankan) ---
  const proofreadFileInput = document.getElementById("proofread-file");
  const proofreadAnalyzeBtn = document.getElementById("proofread-analyze-btn");
  const proofreadLoading = document.getElementById("proofread-loading");
  const proofreadResultsContainer = document.getElementById("proofread-results-container");
  const proofreadResultsTableDiv = document.getElementById("proofread-results-table");
  const proofreadSaveBtn = document.getElementById("proofread-save-btn");

  const compareFileInput1 = document.getElementById("compare-file1");
  const compareFileInput2 = document.getElementById("compare-file2");
  const compareAnalyzeBtn = document.getElementById("compare-analyze-btn");
  const compareLoading = document.getElementById("compare-loading");
  const compareResultsContainer = document.getElementById("compare-results-container");
  const compareResultsTableDiv = document.getElementById("compare-results-table");
  const compareSaveBtn = document.getElementById("compare-save-btn");

  const coherenceFileInput = document.getElementById("coherence-file");
  const coherenceAnalyzeBtn = document.getElementById("coherence-analyze-btn");
  const coherenceLoading = document.getElementById("coherence-loading");
  const coherenceResultsContainer = document.getElementById("coherence-results-container");
  const coherenceResultsTableDiv = document.getElementById("coherence-results-table");
  const coherenceSaveBtn = document.getElementById("coherence-save-btn");
 
  const restructureFileInput = document.getElementById("restructure-file");
  const restructureAnalyzeBtn = document.getElementById("restructure-analyze-btn");
  const restructureLoading = document.getElementById("restructure-loading");
  const restructureResultsContainer = document.getElementById("restructure-results-container");
  const restructureResultsTableDiv = document.getElementById("restructure-results-table");
  const restructureSaveBtn = document.getElementById("restructure-save-btn");
  const createFolderForm = document.getElementById("create-folder-form");
  const folderModalCloseBtn = document.getElementById("folder-modal-close-btn");
  const folderModalLoading = document.getElementById("folder-modal-loading");
  const folderModalError = document.getElementById("folder-modal-error");
  const confirmSaveBtn = document.getElementById("confirm-save-btn");
  const saveModalCloseBtn = document.getElementById("save-modal-close-btn");
  const saveModalLoading = document.getElementById("save-modal-loading");
  const saveModalError = document.getElementById("save-modal-error");
  const shareModalCloseBtn = document.getElementById("share-modal-close-btn");
  const confirmShareBtn = document.getElementById("confirm-share-btn");
  const shareModalLoading = document.getElementById("share-modal-loading");
  const shareModalError = document.getElementById("share-modal-error");

  // --- PERBAIKAN: Event Listener untuk Tombol "Buat Folder Baru" menggunakan Event Delegation ---
  document.body.addEventListener('click', function(event) {
      // Periksa apakah elemen yang diklik adalah tombol yang kita inginkan
      if (event.target.matches('#create-folder-btn')) {
          // Pastikan elemen modal dan form ada sebelum melanjutkan
          if (folderModal && createFolderForm) {
              createFolderForm.reset(); 
              folderModalError.classList.add("hidden");
              folderModalLoading.classList.add("hidden");
              folderModal.classList.remove("hidden");
          }
      }
  });

  // 2. Tutup Modal Buat Folder
  if (folderModalCloseBtn) {
    folderModalCloseBtn.addEventListener("click", () => { folderModal.classList.add("hidden"); });
  }
  window.addEventListener("click", (event) => { 
    if (event.target == folderModal) { 
        folderModal.classList.add("hidden"); 
    }
  });

  // 3. Kirim Form Buat Folder
  if (createFolderForm) {
    createFolderForm.addEventListener("submit", async (e) => {
      e.preventDefault(); 
 
      folderModalLoading.classList.remove("hidden");
      folderModalError.classList.add("hidden");
      document.getElementById("folder-modal-submit-btn").disabled = true;

      const formData = new FormData(createFolderForm);
      const data = { name: formData.get("name") };

      try {
        const response = await fetch("/api/create_folder", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          let errText = "Gagal membuat folder.";
          try {
            const errData = await response.json();
             // Cek jika errornya adalah HTML (redirect login)
            if (typeof errData === 'string' && errData.includes("<!doctype html>")) {
                errText = "Sesi Anda telah berakhir. Silakan login kembali.";
            } else {
                errText = errData.error || errText;
            }
          } catch(e) {
            errText = "Gagal terhubung ke server.";
          }
          throw new Error(errText);
        }

        const result = await response.json();
        showCustomMessage(`Folder '${result.folder_name}' berhasil dibuat!`, 'success', 'Folder Dibuat'); // FIX: Menggunakan Modal Kustom
        folderModal.classList.add("hidden"); 
        loadUserFolders(); // Muat ulang daftar folder

      } catch (error) {
        folderModalError.textContent = error.message;
        folderModalError.classList.remove("hidden");
      } finally {
        folderModalLoading.classList.add("hidden");
        document.getElementById("folder-modal-submit-btn").disabled = false;
      }
    });
  }
 
  // 4. Tutup Modal Simpan Hasil
  if (saveModalCloseBtn) {
    saveModalCloseBtn.addEventListener("click", () => { saveModal.classList.add("hidden"); });
  }
  window.addEventListener("click", (event) => { 
    if (event.target == saveModal) { 
        saveModal.classList.add("hidden"); 
    } 
  });


  // 5. Konfirmasi Simpan Hasil ke Folder (REVISI)
  if (confirmSaveBtn) {
    confirmSaveBtn.addEventListener("click", async () => {
      const selectedValue = folderSelectDropdown.value; // Ini sekarang "NamaFolder|OwnerID"
      if (!selectedValue) { 
        saveModalError.textContent = "Mohon pilih folder tujuan.";
        saveModalError.classList.remove("hidden");
        return; 
      }
 
      // REVISI: Parse value
      const [folderName, ownerId] = selectedValue.split('|');

      if (!currentAnalysisResults || !currentAnalysisFeature || !currentAnalysisFilename) {
        saveModalError.textContent = "Data analisis tidak lengkap. Coba ulangi analisis.";
        saveModalError.classList.remove("hidden");
        return; 
      }

      saveModalLoading.classList.remove("hidden");
      saveModalError.classList.add("hidden");
      confirmSaveBtn.disabled = true;

      const collectedActions = collectRowActionsFromTable();

      const dataToSave = {
        folder_name: folderName,     // REVISI
        owner_id: ownerId,           // REVISI
        feature_type: currentAnalysisFeature,
        results_data: currentAnalysisResults,
        original_filename: currentAnalysisFilename
      };
 
      try {
        const response = await fetch("/api/save_results", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataToSave),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Gagal menyimpan hasil");
        }
 
        const result = await response.json();
        showCustomMessage(result.message, 'success', 'Penyimpanan Berhasil'); // FIX: Menggunakan Modal Kustom
        saveModal.classList.add("hidden");

      } catch (error) {
        saveModalError.textContent = error.message;
        saveModalError.classList.remove("hidden");
      } finally {
        saveModalLoading.classList.add("hidden");
        confirmSaveBtn.disabled = false;
      }
    });
  }
 
  // --- TAMBAHAN BARU: Event Listener untuk Modal Share ---
 
  // 6. Tutup Modal Share
  if (shareModalCloseBtn) {
    shareModalCloseBtn.addEventListener("click", () => { shareModal.classList.add("hidden"); });
  }
  window.addEventListener("click", (event) => { 
    if (event.target == shareModal) { 
        shareModal.classList.add("hidden"); 
    } 
  });

  // 7. Konfirmasi Share Folder (REVISI: Menggunakan Checkbox)
  if (confirmShareBtn) {
        confirmShareBtn.addEventListener("click", async () => {
            const folderName = document.getElementById("share-modal-folder-name").textContent;
 
            const selectedUsers = [];
            document.querySelectorAll('#share-user-table-body input[type="checkbox"]:checked').forEach(checkbox => {
                selectedUsers.push(checkbox.value);
            });

            if (selectedUsers.length === 0) {
                shareModalError.textContent = "Mohon pilih minimal satu pengguna.";
                shareModalError.classList.remove("hidden");
                return;
            }

            shareModalLoading.classList.remove("hidden");
            shareModalError.classList.add("hidden");
            confirmShareBtn.disabled = true;

            try {
                const response = await fetch("/api/share_folder", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ folder_name: folderName, share_with_user_ids: selectedUsers }) 
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || "Gagal berbagi folder.");
                }
 
                const result = await response.json();

                // >>>>>> START MODIFIKASI PESAN SUKSES <<<<<<
                let successMessage = result.message; // Default message

                if (result.success_names && result.success_names.length > 0) {
                    const namesList = result.success_names.join(', ');
                    successMessage = `Berhasil di-share ke: ${namesList}.`;

                    if (result.skipped_count > 0) {
                        successMessage += ` (${result.skipped_count} user dilewati: sudah di-share)`;
                    }
                } else if (result.skipped_count > 0 && result.errors.length === 0) {
                     successMessage = `${result.skipped_count} user dilewati (semuanya sudah di-share).`;
                }

                if (result.errors && result.errors.length > 0) {
                    successMessage += ` Terdapat kegagalan: ${result.errors.join('; ')}`;
                    showCustomMessage(successMessage, 'error', 'Peringatan Share');
                } else {
                    showCustomMessage(successMessage, 'success', 'Berbagi Berhasil');
                }
                // >>>>>> END MODIFIKASI PESAN SUKSES <<<<<<

                shareModal.classList.add("hidden");

            } catch (error) {
                shareModalError.textContent = error.message;
                shareModalError.classList.remove("hidden");
            } finally {
                shareModalLoading.classList.add("hidden");
                confirmShareBtn.disabled = false;
                loadUserFolders(); // Muat ulang daftar folder agar folder yang baru di-share terlihat
            }
        });
    }
  // --- AKHIR TAMBAHAN BARU ---
 

  // --- Fungsi untuk menyimpan hasil ke variabel dan memicu modal save ---
  function setupSaveButton(saveBtnId, featureId, fileInputId1, fileInputId2 = null) {
    console.log(`[DEBUG] setupSaveButton called for: ${saveBtnId}`); // DEBUG 1
    const saveBtn = document.getElementById(saveBtnId);
    if (saveBtn) {
        console.log(`[DEBUG] Save button with ID ${saveBtnId} found. Attaching listener.`); // DEBUG 2
        saveBtn.addEventListener("click", () => {
            console.log(`[DEBUG] Save button ${saveBtnId} CLICKED!`); // DEBUG 3 - PALING PENTING
            // Ambil data dari variabel global (yang diisi saat analisis selesai)
            const resultsData = currentAnalysisResults;
            console.log(`[DEBUG] currentAnalysisResults is:`, resultsData); // DEBUG 4

            // Dapatkan nama file dari input yang relevan
            let filename = "untitled.docx";
            const fileInput1 = document.getElementById(fileInputId1);
            if (fileInput1 && fileInput1.files[0]) {
                filename = fileInput1.files[0].name;
            }

            if (fileInputId2) {
                const fileInput2Elem = document.getElementById(fileInputId2);
                if (fileInput2Elem && fileInput2Elem.files[0]) {
                    filename = "perbandingan_" + filename;
                }
            }
 
            currentAnalysisFilename = filename;
            console.log(`[DEBUG] Calling openSaveModal with:`, { featureId, resultsData, filename }); // DEBUG 5

            if (resultsData) {
                openSaveModal(featureId, resultsData, filename);
            } else {
                showError("Tidak ada hasil analisis yang siap disimpan. Silakan jalankan analisis terlebih dahulu.");
            }
        });
    } else {
        console.error(`[DEBUG] ERROR: Save button with ID ${saveBtnId} NOT FOUND!`); // DEBUG 6
    }
}

  // Setup Save Button untuk semua fitur
  setupSaveButton("proofread-save-btn", "proofreading", "proofread-file");
  setupSaveButton("compare-save-btn", "compare", "compare-file1", "compare-file2");
  setupSaveButton("coherence-save-btn", "coherence", "coherence-file");
  setupSaveButton("restructure-save-btn", "restructure", "restructure-file");


  // ===============================================================
  // ===           LOGIKA ANALISIS FITUR (MODIFIKASI)           ===
  // ===============================================================
  // Logika ini menyimpan data hasil analisis ke variabel global dan sessionStorage 
  // agar tombol Save berfungsi.

  // --- Event Listener untuk Fitur 1: Proofreading ---
  if (proofreadAnalyzeBtn) {
    proofreadAnalyzeBtn.addEventListener("click", async () => {
      const file = proofreadFileInput.files[0];
      if (!file) { showError("Silakan pilih file terlebih dahulu."); return; }
 
      clearError();
      proofreadLoading.classList.remove("hidden");
      proofreadAnalyzeBtn.disabled = true;
      let logId = await logAnalysisStart(file.name, 'proofreading');
      proofreadResultsContainer.classList.add("hidden");
      if(proofreadSaveBtn) proofreadSaveBtn.classList.add("hidden");
      sessionStorage.removeItem('proofreadResults');
      sessionStorage.removeItem('proofreadingFilename'); // REVISI

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/proofread/analyze", { method: "POST", body: formData });
        if (!response.ok) {
          const err = await response.json(); throw new Error(err.error || "Respon server tidak valid");
        }
        const data = await response.json();

        if (data.length === 0) {
          proofreadResultsTableDiv.innerHTML = "<p>Tidak ada kesalahan yang ditemukan.</p>";
        } else {
          const headers = ["Kata/Frasa Salah", "Perbaikan Sesuai KBBI", "Pada Kalimat", "Ditemukan di Halaman", "apakah_ganti", "pic_proofread", "finalize"];
          // Untuk analisis baru, actions akan kosong
          proofreadResultsTableDiv.innerHTML = createTable(data, headers, [], {});
 
          // REVISI: Simpan hasil ke Session Storage dan variabel global
          sessionStorage.setItem('proofreadResults', JSON.stringify(data));
          sessionStorage.setItem('proofreadingFilename', file.name);
          currentAnalysisResults = data;
          currentAnalysisFeature = 'proofreading';
          currentAnalysisFilename = file.name;
          if(proofreadSaveBtn) proofreadSaveBtn.classList.remove("hidden");
        }
        proofreadResultsContainer.classList.remove("hidden");
        await logAnalysisEnd(logId, 'done');

      } catch (error) {
        // MODIFIKASI: Pengecekan error 429
        await logAnalysisEnd(logId, 'error');
        if (error.message.includes("429") || error.message.includes("quota")) {
            showError("Anda telah melebihi batas penggunaan API. Silakan tunggu beberapa saat dan coba lagi, atau periksa kuota Anda di Google Cloud Console.");
        } else {
            showError(error.message);
        }
      } finally {
        proofreadLoading.classList.add("hidden");
        proofreadAnalyzeBtn.disabled = false;
      }
    });
 
    // Listeners untuk tombol download Proofreading (Dipertahankan)
    const proofreadDownloadRevisedBtn = document.getElementById("proofread-download-revised-btn");
    const proofreadDownloadHighlightedBtn = document.getElementById("proofread-download-highlighted-btn");
    const proofreadDownloadZipBtn = document.getElementById("proofread-download-zip-btn");
    if (proofreadDownloadRevisedBtn) {
      proofreadDownloadRevisedBtn.addEventListener("click", () => {
        const file = proofreadFileInput.files[0];
        if (!file) { showError("File asli tidak ditemukan. Muat ulang dan pilih file lagi."); return; }
        const formData = new FormData(); formData.append("file", file);
        handleDownload("/api/proofread/download/revised", formData, `revisi_${file.name}`);
      });
    }
    if (proofreadDownloadHighlightedBtn) {
      proofreadDownloadHighlightedBtn.addEventListener("click", () => {
        const file = proofreadFileInput.files[0];
        if (!file) { showError("File asli tidak ditemukan. Muat ulang dan pilih file lagi."); return; }
        const formData = new FormData(); formData.append("file", file);
        handleDownload("/api/proofread/download/highlighted", formData, `highlight_${file.name}`);
      });
    }
    if (proofreadDownloadZipBtn) {
      proofreadDownloadZipBtn.addEventListener("click", () => {
        const file = proofreadFileInput.files[0];
        if (!file) { showError("File asli tidak ditemukan. Muat ulang dan pilih file lagi."); return; }
        const formData = new FormData(); formData.append("file", file);
        handleDownload("/api/proofread/download/zip", formData, `hasil_proofread_${file.name}.zip`);
      });
    }
  }
 
  // Ganti bagian ini di script.js
  // Ganti event listener ini di script.js
    if (compareAnalyzeBtn) {
        compareAnalyzeBtn.addEventListener("click", async () => {
        const file1 = compareFileInput1.files[0];
        const file2 = compareFileInput2.files[0];
        if (!file1 || !file2) { showError("Silakan unggah KEDUA file untuk perbandingan."); return; }
    
        clearError();
        compareLoading.classList.remove("hidden");
        compareAnalyzeBtn.disabled = true;
        compareResultsContainer.classList.add("hidden");
        if(compareSaveBtn) compareSaveBtn.classList.add("hidden");
        sessionStorage.removeItem('compareResults');
        sessionStorage.removeItem('compareFilename');

        // Kita selalu menggunakan mode lanjutan sekarang
        const apiEndpoint = '/api/compare/analyze_advanced';

        const formData = new FormData();
        formData.append("file1", file1);
        formData.append("file2", file2);

        try {
            const response = await fetch(apiEndpoint, { method: "POST", body: formData });
            if (!response.ok) {
            const err = await response.json(); throw new Error(err.error || "Respon server tidak valid");
            }
            const data = await response.json();

            if (data.length === 0) {
            compareResultsTableDiv.innerHTML = "<p>Tidak ada perbedaan makna yang signifikan ditemukan antara dokumen asli dan revisi.</p>";
            } else {
            // Header baru yang sesuai dengan output dari AI
            const headers = ["Sub-bab Asal", "Kalimat yang Menyimpang di dokumen lainnya", "Alasan"];
            
            // Data dari API sudah sesuai, tidak perlu dipetakan ulang
            const resultsData = data;
            
            // Untuk analisis baru, actions akan kosong
            compareResultsTableDiv.innerHTML = createTable(resultsData, headers, [], {});
            
            // Simpan hasil ke variabel global dan session storage
            const filename = "perbandingan_" + file1.name;
            sessionStorage.setItem('compareResults', JSON.stringify(resultsData));
            sessionStorage.setItem('compareFilename', filename);
            currentAnalysisResults = resultsData;
            currentAnalysisFeature = 'compare';
            currentAnalysisFilename = filename;
            if(compareSaveBtn) compareSaveBtn.classList.remove("hidden");
            }
            compareResultsContainer.classList.remove("hidden");

        } catch (error) {
            if (error.message.includes("429") || error.message.includes("quota")) {
                showError("Anda telah melebihi batas penggunaan API. Silakan tunggu beberapa saat dan coba lagi, atau periksa kuota Anda di Google Cloud Console.");
            } else {
                showError(error.message);
            }
        } finally {
            compareLoading.classList.add("hidden");
            compareAnalyzeBtn.disabled = false;
        }
        });

        // Listener untuk tombol download tetap sama
        const compareDownloadBtn = document.getElementById("compare-download-btn");
        if (compareDownloadBtn) {
        compareDownloadBtn.addEventListener("click", () => {
            const file1 = compareFileInput1.files[0];
            const file2 = compareFileInput2.files[0];
            if (!file1 || !file2) { showError("File asli tidak ditemukan. Muat ulang dan pilih file lagi."); return; }
            const formData = new FormData();
            formData.append("file1", file1);
            formData.append("file2", file2);
            handleDownload("/api/compare/download", formData, `perbandingan_${file1.name}`);
        });
        }
    }
  

  // --- Event Listener untuk Fitur 3: Coherence ---
  if (coherenceAnalyzeBtn) {
    coherenceAnalyzeBtn.addEventListener("click", async () => {
      const file = coherenceFileInput.files[0];
      if (!file) { showError("Silakan pilih file terlebih dahulu."); return; }
 
      clearError();
      coherenceLoading.classList.remove("hidden");
      coherenceAnalyzeBtn.disabled = true;
      coherenceResultsContainer.classList.add("hidden");
      if(coherenceSaveBtn) coherenceSaveBtn.classList.add("hidden");
      sessionStorage.removeItem('coherenceResults');
      sessionStorage.removeItem('coherenceFilename'); // REVISI

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/coherence/analyze", { method: "POST", body: formData });
        if (!response.ok) {
          const err = await response.json(); throw new Error(err.error || "Respon server tidak valid");
        }
        const data = await response.json();

        if (data.length === 0) {
          coherenceResultsTableDiv.innerHTML = "<p>Tidak ada masalah koherensi yang ditemukan.</p>";
        } else {
          const headers = ["topik", "asli", "saran", "catatan", "apakah_ganti", "pic_proofread", "finalize"];
          // Untuk analisis baru, actions akan kosong
          coherenceResultsTableDiv.innerHTML = createTable(data, headers, [], {});
          // REVISI: Simpan hasil ke variabel global
          sessionStorage.setItem('coherenceResults', JSON.stringify(data));
          sessionStorage.setItem('coherenceFilename', file.name);
          currentAnalysisResults = data;
          currentAnalysisFeature = 'coherence';
          currentAnalysisFilename = file.name;
          if(coherenceSaveBtn) coherenceSaveBtn.classList.remove("hidden");
        }
        coherenceResultsContainer.classList.remove("hidden");

      } catch (error) {
        // MODIFIKASI: Pengecekan error 429
        if (error.message.includes("429") || error.message.includes("quota")) {
            showError("Anda telah melebihi batas penggunaan API. Silakan tunggu beberapa saat dan coba lagi, atau periksa kuota Anda di Google Cloud Console.");
        } else {
            showError(error.message);
        }
      } finally {
        coherenceLoading.classList.add("hidden");
        coherenceAnalyzeBtn.disabled = false;
      }
    });
  }
 
  // --- Event Listener untuk Fitur 4: Restructure ---
  if (restructureAnalyzeBtn) {
      restructureAnalyzeBtn.addEventListener("click", async () => {
      const file = restructureFileInput.files[0];
      if (!file) { showError("Silakan pilih file terlebih dahulu."); return; }

      clearError();
      restructureLoading.classList.remove("hidden");
      restructureAnalyzeBtn.disabled = true;
      restructureResultsContainer.classList.add("hidden");
      if(restructureSaveBtn) restructureSaveBtn.classList.add("hidden");
      sessionStorage.removeItem('restructureResults');
      sessionStorage.removeItem('restructureFilename'); // REVISI

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/restructure/analyze", { method: "POST", body: formData });
        if (!response.ok) {
          const err = await response.json(); throw new Error(err.error || "Respon server tidak valid");
        }
        const data = await response.json();

        if (data.length === 0) {
          restructureResultsTableDiv.innerHTML = "<p>Tidak ada saran restrukturisasi.</p>";
        } else {
          const headers = ["Paragraf yang Perlu Dipindah", "Lokasi Asli", "Saran Lokasi Baru", "apakah_ganti", "pic_proofread", "finalize"];
          // Untuk analisis baru, actions akan kosong
          restructureResultsTableDiv.innerHTML = createTable(data, headers, [], {});
          // REVISI: Simpan hasil ke variabel global
          sessionStorage.setItem('restructureResults', JSON.stringify(data));
          sessionStorage.setItem('restructureFilename', file.name);
          currentAnalysisResults = data;
          currentAnalysisFeature = 'restructure';
          currentAnalysisFilename = file.name;
          if(restructureSaveBtn) restructureSaveBtn.classList.remove("hidden");
        }
        restructureResultsContainer.classList.remove("hidden");

        } catch (error) {
        // MODIFIKASI: Pengecekan error 429
        if (error.message.includes("429") || error.message.includes("quota")) {
            showError("Anda telah melebihi batas penggunaan API. Silakan tunggu beberapa saat dan coba lagi, atau periksa kuota Anda di Google Cloud Console.");
        } else {
            showError(error.message);
        }
      } finally {
        restructureLoading.classList.add("hidden");
        restructureAnalyzeBtn.disabled = false;
      }
    });

    const restructureDownloadBtn = document.getElementById("restructure-download-btn");
    if (restructureDownloadBtn) {
      restructureDownloadBtn.addEventListener("click", () => {
        const file = restructureFileInput.files[0];
        if (!file) { showError("File asli tidak ditemukan. Muat ulang dan pilih file lagi."); return; }
        const formData = new FormData();
        formData.append("file", file);
        handleDownload("/api/restructure/download", formData, `highlight_rekomendasi_${file.name}`);
      });
    }
  }

}); // Akhir dari DOMContentLoaded

    async function saveRowState(rowId, event) {
        const saveButton = event.target;
        const originalText = saveButton.textContent;
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';

        // Ambil konteks file (reuse logic dari openCommentModal)
        const resultViewContainer = saveButton.closest('#history-result-view');
        let folderName, fileName, ownerId;

        if (resultViewContainer && resultViewContainer.dataset.folderName) {
            folderName = resultViewContainer.dataset.folderName;
            fileName = resultViewContainer.dataset.fileName;
            ownerId = resultViewContainer.dataset.ownerId;
        } else {
            showCustomMessage("Error: Tidak dapat menentukan lokasi penyimpanan. Silakan buka file dari folder.", 'error', 'Error Data');
            saveButton.textContent = originalText;
            saveButton.disabled = false;
            return;
        }

        // Temukan elemen checkbox dan dropdown di baris yang sama
        const row = saveButton.closest('tr');
        const checkbox = row.querySelector('.action-checkbox');
        const dropdown = row.querySelector('.action-dropdown');

        const isGanti = checkbox.checked;
        const picUserId = dropdown.value;

        const payload = {
            folder_name: folderName,
            filename: fileName,
            owner_id: ownerId,
            row_id: rowId,
            is_ganti: isGanti,
            pic_user_id: picUserId ? parseInt(picUserId) : null
        };

        let previousUnreadCount = 0;

    async function updateMailboxBadge() {
        try {
            const response = await fetch('/api/get_unread_count');
            
            if (!response.ok) {
                return;
            }
            const data = await response.json();
            const count = data.count;
            
            const badge = document.getElementById('mailbox-unread-count');
            // console.log("[DEBUG] Elemen badge ditemukan:", badge); // Bisa dihilangkan

            if (!badge) return; // Keluar jika elemen badge tidak ada

            if (count > 0) {
                badge.textContent = count;
                badge.classList.remove('hidden');
                // console.log(`[DEBUG] Badge diperbarui dengan count: ${count}`); // Bisa dihilangkan

                // Tambahkan animasi jika jumlah notifikasi bertambah
                if (count > previousUnreadCount) {
                    badge.classList.add('new-notification');
                    // Hapus kelas animasi setelah selesai agar bisa dipicu lagi
                    setTimeout(() => {
                        badge.classList.remove('new-notification');
                    }, 900); // Durasi animasi
                }
            } else {
                badge.classList.add('hidden');
                // console.log("[DEBUG] Badge disembunyikan karena count = 0"); // Bisa dihilangkan
            }
            previousUnreadCount = count;

        } catch (error) {
            console.error("Gagal memperbarui badge mailbox:", error);
        }
    }

    function markMessageAsRead(messageId) {
        fetch(`/api/mark_message_read/${messageId}`, { method: 'POST' })
            .then(response => {
                if (response.ok) {
                    updateMailboxBadge(); // Perbarui badge setelah pesan dibaca
                }
            })
            .catch(error => console.error("Gagal menandai pesan sebagai dibaca:", error));
    }

    document.addEventListener('DOMContentLoaded', () => {
        // Panggil sekali saat halaman dimuat
        updateMailboxBadge();

        // --- PERBAIKAN 1: Percepat polling dari 30 detik menjadi 10 detik ---
        setInterval(updateMailboxBadge, 10000); // 10 detik
        
        // --- PERBAIKAN 2: Cek instan saat user kembali ke tab ini ---
        window.addEventListener('focus', () => {
            updateMailboxBadge();
        });
    });

  function markMessageAsRead(messageId) {
      fetch(`/api/mark_message_read/${messageId}`, { method: 'POST' })
          .then(response => {
              if (response.ok) {
                  updateMailboxBadge();
              }
          })
          .catch(error => console.error("Gagal menandai pesan sebagai dibaca:", error));
  }

  document.addEventListener('DOMContentLoaded', () => {
      updateMailboxBadge();
      setInterval(updateMailboxBadge, 30000);
  });

    try {
        const response = await fetch('/api/save_row_action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Coba parsing ke JSON
        let result;
        const responseText = await response.text(); // Ambil sebagai teks dulu
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            console.error("Gagal parsing JSON dari respons server. Respons mungkin bukan JSON.");
            // Tampilkan error mentah ke user
            showCustomMessage(`Server Error: Respons bukan JSON. Lihat console untuk detail.`, 'error');
            saveButton.textContent = originalText;
            saveButton.disabled = false;
            return; // Hentikan eksekusi
        }

        if (!response.ok) {
            throw new Error(result.error || 'Failed to save state.');
        }
        
        showCustomMessage(result.message, 'success', 'Status Tersimpan');
        saveButton.textContent = 'Saved!';
        setTimeout(() => {
            saveButton.textContent = originalText;
            saveButton.disabled = false;
        }, 1500);

    } catch (error) {
        console.error("Error di JavaScript:", error);
        showCustomMessage(`Gagal menyimpan: ${error.message}`, 'error');
        saveButton.textContent = originalText;
        saveButton.disabled = false;
    }
}