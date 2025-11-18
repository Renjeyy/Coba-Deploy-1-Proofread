document.addEventListener('DOMContentLoaded', () => {
    const logTableBody = document.getElementById('log-table-body');
    const addTaskBtn = document.getElementById('add-task-btn');
    const taskModal = document.getElementById('task-modal');
    const taskForm = document.getElementById('task-form');
    const taskModalTitle = document.getElementById('task-modal-title');
    const taskModalSubmitBtn = taskForm.querySelector('button[type="submit"]');
    const logLoading = document.getElementById('log-loading');
    const logError = document.getElementById('log-error');

    async function fetchAndRenderLogs() {
        const logTableBody = document.getElementById('log-table-body');
        const logLoading = document.getElementById('log-loading');
        const logError = document.getElementById('log-error');

        logLoading.classList.remove('hidden');
        logError.classList.add('hidden');
        logTableBody.innerHTML = '';

        try {
            const response = await fetch('/api/get_analysis_logs');
            if (!response.ok) throw new Error('Gagal mengambil data log.');
            
            const logs = await response.json();
            
            if (logs.length === 0) {
                logTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem;">Belum ada log atau tugas.</td></tr>';
                return;
            }

            logs.forEach((log, index) => {
                const row = document.createElement('tr');
                
                // Format tanggal untuk ditampilkan
                const startDate = new Date(log.start_time).toLocaleDateString('id-ID', { 
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                const deadline = log.deadline ? new Date(log.deadline).toLocaleDateString('id-ID', { 
                    year: 'numeric', month: 'long', day: 'numeric'
                }) : '-';
                const endDate = log.end_time ? new Date(log.end_time).toLocaleDateString('id-ID', { 
                    year: 'numeric', month: 'long', day: 'numeric'
                }) : '-';
                    
                // --- SEDERHANAKAN: Ambil status langsung dari backend ---
                let statusBadge = '';
                if (log.status === 'done') {
                    statusBadge = '<span class="status-badge status-done">Done</span>';
                } else if (log.status === 'overdue') {
                    statusBadge = '<span class="status-badge" style="background-color: #ff4d4d; color: white;">Overdue</span>';
                } else if (log.status === 'manual') { // Pertahankan jika ada tugas lama dengan status ini
                    statusBadge = '<span class="status-badge" style="background-color: var(--secondary); color: var(--text);">Manual</span>';
                } else { // Akan menangkap 'on_progress'
                    statusBadge = '<span class="status-badge status-unfinished">On Progress</span>';
                }

                // Tampilkan tombol aksi untuk semua status yang relevan
                let actionButtons = '';
                if (log.status === 'done' || log.status === 'overdue' || log.status === 'on_progress' || log.status === 'manual') {
                    actionButtons = `
                        <button class="comment-btn-small" onclick="openEditModal(${log.id})">Edit</button>
                        <button class="comment-btn-small" style="background-color: var(--danger);" onclick="deleteTask(${log.id})">Hapus</button>
                    `;
                }

                // Susun baris tabel
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${log.filename}</td>
                    <td>${log.feature_type.charAt(0).toUpperCase() + log.feature_type.slice(1)}</td>
                    <td>${startDate}</td>
                    <td>${deadline}</td>
                    <td>${endDate}</td>
                    <td>${statusBadge}</td>
                    <td>${actionButtons}</td>
                `;
                logTableBody.appendChild(row);
            });

        } catch (error) {
            console.error(error);
            logError.textContent = error.message;
            logError.classList.remove('hidden');
        } finally {
            logLoading.classList.add('hidden');
        }
    }

    // --- Fungsi untuk Membuka Modal Edit ---
    window.openEditModal = async (logId) => {
        const response = await fetch('/api/get_analysis_logs');
        const logs = await response.json();
        const logToEdit = logs.find(log => log.id === logId);

        if (!logToEdit) {
            showCustomMessage('Tugas tidak ditemukan.', 'error');
            return;
        }

        // Isi form dengan data yang ada
        document.getElementById('task-log-id').value = logToEdit.id;
        document.getElementById('task-filename-input').value = logToEdit.filename;
        document.getElementById('task-feature-select').value = logToEdit.feature_type;
        
        const startDateTime = new Date(logToEdit.start_time);
        document.getElementById('task-start-time-input').value = startDateTime.toISOString().slice(0, 16);

        // --- PERBAIKAN: Isi field deadline ---
        if (logToEdit.deadline) {
            const deadlineDateTime = new Date(logToEdit.deadline);
            document.getElementById('task-deadline-input').value = deadlineDateTime.toISOString().slice(0, 16);
        } else {
            document.getElementById('task-deadline-input').value = '';
        }

        if (logToEdit.end_time) {
            const endDateTime = new Date(logToEdit.end_time);
            document.getElementById('task-end-time-input').value = endDateTime.toISOString().slice(0, 16);
        } else {
            document.getElementById('task-end-time-input').value = '';
        }

        // Ubah tampilan modal untuk Edit
        taskModalTitle.textContent = 'Edit Tugas';
        taskModalSubmitBtn.textContent = 'Update Tugas';
        taskModal.classList.remove('hidden');
    };

    // --- Fungsi untuk Menghapus Tugas ---
    window.deleteTask = (logId) => {
        showCustomConfirm('Apakah Anda yakin ingin menghapus tugas ini?', async (isConfirmed) => {
            if (!isConfirmed) return;

            try {
                const response = await fetch(`/api/delete_task/${logId}`, { method: 'DELETE' });
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Gagal menghapus tugas.');
                }

                showCustomMessage(result.message, 'success');
                fetchAndRenderLogs();
            } catch (error) {
                showCustomMessage(error.message, 'error');
            }
        }, 'Hapus Tugas');
    };

    // --- Event Listener untuk Modal (Buka/Tutup) ---
    addTaskBtn.addEventListener('click', () => {
        taskForm.reset();
        document.getElementById('task-log-id').value = '';
        taskModalSubmitBtn.textContent = 'Tambah Tugas';
        taskModal.classList.remove('hidden');
    });

    document.getElementById('task-modal-close-btn').addEventListener('click', () => {
        taskModal.classList.add('hidden');
    });

    window.addEventListener('click', (event) => {
        if (event.target === taskModal) {
            taskModal.classList.add('hidden');
        }
    });

    // --- Event Listener untuk Submit Form (Tambah/Edit) ---
    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const logId = document.getElementById('task-log-id').value;
        const isEditing = !!logId;

        const taskData = {
            filename: document.getElementById('task-filename-input').value,
            feature_type: document.getElementById('task-feature-select').value,
            start_time: document.getElementById('task-start-time-input').value,
            deadline: document.getElementById('task-deadline-input').value,
            end_time: document.getElementById('task-end-time-input').value
        };

        const url = isEditing ? `/api/edit_task/${logId}` : '/api/add_manual_task';
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Gagal memproses tugas.');
            }

            // Jika berhasil, tampilkan pesan dan tutup modal
            showCustomMessage(result.message, 'success');
            taskModal.classList.add('hidden');
            taskForm.reset();
            fetchAndRenderLogs();

        } catch (error) {
            // Jika terjadi error, tampilkan pesan error
            showCustomMessage(error.message, 'error');
            // Modal tidak ditutup agar pengguna bisa mencoba lagi
        }
    });

    // --- Panggil Fungsi Awal Saat Halaman Dimuat ---
    fetchAndRenderLogs();
});