// --- PENANDA VERSI ---
console.log("!!! VERSI MAILBOX.JS DENGAN FITUR STATUS SUDAH DIMUAT !!!");

document.addEventListener('DOMContentLoaded', () => {
    // --- Referensi Elemen DOM ---
    const messageListBody = document.getElementById('message-list-body');
    const emptyListMessage = document.getElementById('empty-list-message');
    const listTitle = document.getElementById('list-title');
    const previewContent = document.getElementById('preview-content');
    const composeBtn = document.getElementById('compose-btn');
    const composeModal = document.getElementById('compose-modal');
    const composeForm = document.getElementById('compose-form');
    const recipientSelect = document.getElementById('recipient-select');

    let currentMailboxType = 'inbox';
    let allMessages = [];

    // --- Helper untuk Format Tanggal (HANYA TANGGAL) ---
    function formatDate(dateString) {
        const date = new Date(dateString);
        const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        const day = String(date.getDate()).padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
    }

    // --- Fungsi untuk Menyesuaikan Lebar Modal Compose ---
    function adjustComposeModalWidth() {
        const messageListContainer = document.querySelector('.mailbox-list');
        const composeModalContent = document.querySelector('#compose-modal .modal-content');
        if (messageListContainer && composeModalContent) {
            const listWidth = messageListContainer.offsetWidth;
            composeModalContent.style.width = `${listWidth}px`;
        }
    }

    // --- Fungsi Utama: Menampilkan Tipe Mailbox dan Memuat Data ---
    function showMailboxType(type) {
        currentMailboxType = type;
        document.querySelectorAll('.folder-item').forEach(item => item.classList.remove('active'));
        document.getElementById(`${type}-tab`).classList.add('active');
        listTitle.textContent = type === 'inbox' ? 'Inbox' : 'Sent Items';
        previewContent.innerHTML = `<p style="font-size: 1.2rem; color: var(--text-light);">Select an item to read</p><p style="font-size: 1rem; color: var(--text-light);">Nothing is selected</p>`;
        fetchAndRenderMessages(type);
    }
    window.showMailboxType = showMailboxType;

    // --- Fungsi untuk Mengambil Data dari Server dan Merender ---
    async function fetchAndRenderMessages(type) {
        messageListBody.innerHTML = '';
        emptyListMessage.classList.add('hidden');
        
        const deleteHeader = document.getElementById('delete-action-header');
        const senderRecipientHeader = document.getElementById('sender-recipient-header');
        if (type === 'sent') {
            deleteHeader.classList.remove('hidden');
            senderRecipientHeader.textContent = 'Penerima';
        } else {
            deleteHeader.classList.add('hidden');
            senderRecipientHeader.textContent = 'Pengirim';
        }
        
        try {
            const response = await fetch('/api/get_messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: type })
            });
            const messages = await response.json();
            allMessages = messages;

            if (messages.length === 0) {
                // --- MODIFIKASI: Ubah colspan karena ada kolom baru ---
                emptyListMessage.innerHTML = `<td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-light);">Tidak ada pesan di ${type === 'inbox' ? 'Inbox' : 'Sent Items'}.</td>`;
                emptyListMessage.classList.remove('hidden');
                return;
            }

            messages.forEach(msg => {
                const row = document.createElement('tr');
                // --- TAMBAHAN: Simpan ID di dataset untuk akses mudah ---
                row.dataset.messageId = msg.id;

                if (type === 'sent') {
                    const deleteCell = row.insertCell(0);
                    deleteCell.innerHTML = `<button class="comment-btn-small" style="background-color: var(--danger);" onclick="event.stopPropagation(); deleteMessage(${msg.id});">Hapus</button>`;
                }

                const userCell = row.insertCell();
                userCell.textContent = msg.other_user;

                const subjectCell = row.insertCell();
                subjectCell.textContent = msg.subject;

                const dateCell = row.insertCell();
                dateCell.textContent = formatDate(msg.timestamp);

                // --- TAMBAHAN: Kolom Status ---
                const statusCell = row.insertCell();
                if (type === 'inbox') {
                    const statusSpan = document.createElement('span');
                    statusSpan.textContent = msg.is_read ? 'Read' : 'Not Read';
                    // --- TAMBAHAN: Gunakan class CSS untuk styling ---
                    statusSpan.className = msg.is_read ? 'status-read' : 'status-unread';
                    statusCell.appendChild(statusSpan);
                } else {
                    statusCell.textContent = '-'; // Placeholder untuk sent items
                }

                row.addEventListener('click', (event) => {
                    if (event.target.tagName !== 'BUTTON') {
                        viewMessage(msg.id);
                    }
                });
                
                messageListBody.appendChild(row);
            });

        } catch (error) {
            console.error("Gagal memuat pesan:", error);
            showCustomMessage("Gagal memuat pesan.", 'error');
        }
    }

    // --- MODIFIKASI: Fungsi untuk Melihat Detail Pesan (jadi async) ---
    async function viewMessage(messageId) {
        const message = allMessages.find(msg => msg.id === messageId);
        if (!message) return;

        // --- TAMBAHAN: Logika untuk menandai sebagai dibaca ---
        if (currentMailboxType === 'inbox' && !message.is_read) {
            try {
                const response = await fetch(`/api/mark_message_read/${messageId}`, { method: 'POST' });
                if (response.ok) {
                    // Update status di UI
                    const messageRow = messageListBody.querySelector(`tr[data-message-id="${messageId}"]`);
                    if (messageRow) {
                        const statusSpan = messageRow.querySelector('.status-unread');
                        if (statusSpan) {
                            statusSpan.textContent = 'Read';
                            statusSpan.classList.remove('status-unread');
                            statusSpan.classList.add('status-read');
                        }
                    }
                    // Update status di data lokal
                    message.is_read = true;

                    // --- TAMBAHAN: Update badge notifikasi global ---
                    if (typeof updateMailboxBadge === 'function') {
                        updateMailboxBadge();
                    }
                }
            } catch (error) {
                console.error("Gagal menandai pesan sebagai dibaca:", error);
            }
        }

        let attachmentLink = '';
        if (message.has_attachment) {
            attachmentLink = `<a href="/api/download_message_attachment/${message.id}" class="attachment-link">📎 Unduh Lampiran</a>`;
        }
        
        const deleteButton = (currentMailboxType === 'sent') ? 
            `<button id="delete-message-btn" class="comment-btn-small" style="background-color: var(--danger); margin-top: 1rem;">Hapus Pesan</button>` : '';

        previewContent.innerHTML = `
            <h4>${message.subject}</h4>
            <p><strong>Dari:</strong> ${message.other_user}</p>
            <p><strong>Tanggal:</strong> ${formatDate(message.timestamp)}</p>
            <hr style="margin: 1rem 0;">
            <p>${message.body || '(Tidak ada isi pesan)'}</p>
            ${attachmentLink}
            ${deleteButton}
        `;

        if (deleteButton) {
            document.getElementById('delete-message-btn').addEventListener('click', () => {
                deleteMessage(messageId);
            });
        }
    }

    // --- Fungsi untuk Menghapus Pesan ---
    async function deleteMessage(messageId) {
        showCustomConfirm('Apakah Anda yakin ingin menghapus pesan ini? Tindakan tidak dapat dibatalkan.', async (isConfirmed) => {
            if (!isConfirmed) return;

            try {
                const response = await fetch(`/api/delete_message/${messageId}`, {
                    method: 'DELETE'
                });
                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Gagal menghapus pesan.');
                }

                showCustomMessage(result.message, 'success');
                document.getElementById('preview-content').innerHTML = `<p style="font-size: 1.2rem; color: var(--text-light);">Pesan telah dihapus.</p>`;
                await fetchAndRenderMessages(currentMailboxType);

            } catch (error) {
                showCustomMessage(error.message, 'error');
            }
        }, 'Hapus Pesan');
    }
    window.deleteMessage = deleteMessage;

    // --- Event Listeners ---
    composeBtn.addEventListener('click', () => {
        composeModal.classList.remove('hidden');
        loadUsersForRecipientSelect();
        adjustComposeModalWidth();
    });

    document.getElementById('compose-modal-close-btn').addEventListener('click', () => {
        composeModal.classList.add('hidden');
    });

    window.addEventListener('click', (event) => {
        if (event.target === composeModal) {
            composeModal.classList.add('hidden');
        }
    });

    composeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = composeForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Mengirim...';

        const formData = new FormData(composeForm);
        
        try {
            const response = await fetch('/api/send_message', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Gagal mengirim pesan.');
            }

            showCustomMessage(result.message, 'success');
            composeModal.classList.add('hidden');
            composeForm.reset();
            await fetchAndRenderMessages(currentMailboxType);

        } catch (error) {
            showCustomMessage(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });

    window.addEventListener('resize', () => {
        if (!composeModal.classList.contains('hidden')) {
            adjustComposeModalWidth();
        }
    });

    // --- Helper Functions ---
    async function loadUsersForRecipientSelect() {
        if (recipientSelect.options.length > 1) return;

        try {
            const response = await fetch('/api/get_all_users');
            const users = await response.json();
            users.forEach(user => {
                if (user.id != document.body.dataset.userId) {
                    const option = document.createElement('option');
                    option.value = user.id;
                    option.textContent = `${user.username} (${user.label})`;
                    recipientSelect.appendChild(option);
                }
            });
        } catch (error) {
            console.error("Gagal memuat daftar user:", error);
        }
    }

    // --- Inisialisasi ---
    showMailboxType('inbox');
});