// Advanced Bookstore Management System
class BookstoreApp {
    constructor() {
        this.API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api';
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.searchQuery = '';
        this.sortBy = 'date_added';
        this.sortOrder = 'DESC';
        this.genreFilter = '';
        this.currentEditId = null;
        
        this.initializeApp();
    }

    async initializeApp() {
        this.initializeEventListeners();
        this.initializeMobileNavigation();
        this.initializeSectionNavigation();
        
        // Load initial data
        await this.loadDashboard();
        this.showSection('dashboard');
    }

    initializeEventListeners() {
        // Form submissions
        document.getElementById('bookForm')?.addEventListener('submit', (e) => this.handleAddBook(e));
        document.getElementById('editBookForm')?.addEventListener('submit', (e) => this.handleEditBook(e));
        
        // Search and filters
        document.getElementById('searchBtn')?.addEventListener('click', () => this.performSearch());
        document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });
        
        // Filter changes
        document.getElementById('genreFilter')?.addEventListener('change', (e) => {
            this.genreFilter = e.target.value;
            this.loadBooks();
        });
        document.getElementById('sortBy')?.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.loadBooks();
        });
        document.getElementById('sortOrder')?.addEventListener('change', (e) => {
            this.sortOrder = e.target.value;
            this.loadBooks();
        });

        // Header actions
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshData());
        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportData());

        // Modal controls
        document.getElementById('closeModal')?.addEventListener('click', () => this.closeModal());
        document.getElementById('cancelEdit')?.addEventListener('click', () => this.closeModal());
        
        // Close modal on backdrop click
        document.getElementById('editModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'editModal') this.closeModal();
        });

        // Real-time search
        let searchTimeout;
        document.getElementById('searchInput')?.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchQuery = e.target.value;
                this.currentPage = 1;
                this.loadBooks();
            }, 500);
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    initializeMobileNavigation() {
        const menuToggle = document.getElementById('menuToggle');
        const navMenu = document.getElementById('navMenu');

        menuToggle?.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.mobile-nav')) {
                menuToggle?.classList.remove('active');
                navMenu?.classList.remove('active');
            }
        });
    }

    initializeSectionNavigation() {
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);
                
                // Update active nav link
                document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                // Close mobile menu
                document.getElementById('menuToggle')?.classList.remove('active');
                document.getElementById('navMenu')?.classList.remove('active');
            });
        });
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show target section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Load section-specific data
        switch (sectionId) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'books':
                this.loadBooks();
                this.loadGenreFilter();
                break;
            case 'add-book':
                // Form is already ready
                break;
            case 'stats':
                this.loadDetailedStats();
                break;
        }

        // Update page title
        const sectionTitles = {
            dashboard: '📊 Dashboard',
            books: '📚 Books',
            'add-book': '➕ Add Book',
            stats: '📈 Statistics'
        };
        document.title = `${sectionTitles[sectionId]} - Bookstore Management`;
    }

    async loadDashboard() {
        try {
            const [statsResponse, booksResponse] = await Promise.all([
                fetch(`${this.API_BASE}/stats`),
                fetch(`${this.API_BASE}/books?limit=5&sortBy=date_added&sortOrder=DESC`)
            ]);

            if (!statsResponse.ok || !booksResponse.ok) {
                throw new Error('Failed to load dashboard data');
            }

            const stats = await statsResponse.json();
            const booksData = await booksResponse.json();

            this.updateDashboardStats(stats);
            this.updateRecentBooks(booksData.books);
            this.updateGenreChart(stats.genres);
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showToast('Failed to load dashboard data', 'error');
        }
    }

    updateDashboardStats(stats) {
        document.getElementById('totalBooks').textContent = stats.totalBooks?.total || 0;
        document.getElementById('totalValue').textContent = `$${(stats.totalValue?.total || 0).toFixed(2)}`;
        document.getElementById('genreCount').textContent = stats.genres?.length || 0;
        
        const avgPrice = stats.totalBooks?.total > 0 ? 
            (stats.totalValue?.total || 0) / stats.totalBooks.total : 0;
        document.getElementById('avgPrice').textContent = `$${avgPrice.toFixed(2)}`;
    }

    updateRecentBooks(books) {
        const container = document.getElementById('recentBooksList');
        if (!container) return;

        if (!books || books.length === 0) {
            container.innerHTML = '<p class="empty-state">No books available</p>';
            return;
        }

        container.innerHTML = books.map(book => `
            <div class="book-card">
                <h4>${this.escapeHtml(book.title)}</h4>
                <p><strong>Author:</strong> ${this.escapeHtml(book.author)}</p>
                <p><strong>Genre:</strong> ${this.escapeHtml(book.genre || 'N/A')}</p>
                <p class="price">$${parseFloat(book.price).toFixed(2)}</p>
                <p><strong>Quantity:</strong> ${book.quantity}</p>
            </div>
        `).join('');
    }

    updateGenreChart(genres) {
        const container = document.getElementById('genreChart');
        if (!container || !genres) return;

        if (genres.length === 0) {
            container.innerHTML = '<p class="empty-state">No genre data available</p>';
            return;
        }

        const maxCount = Math.max(...genres.map(g => g.count));
        
        container.innerHTML = genres.slice(0, 8).map(genre => {
            const percentage = (genre.count / maxCount) * 100;
            return `
                <div class="genre-bar" style="margin-bottom: 1rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                        <span style="font-weight: 500;">${this.escapeHtml(genre.genre)}</span>
                        <span style="color: var(--gray-600);">${genre.count}</span>
                    </div>
                    <div style="background: var(--gray-200); border-radius: 0.5rem; height: 8px; overflow: hidden;">
                        <div style="background: linear-gradient(135deg, var(--primary-color), var(--secondary-color)); height: 100%; width: ${percentage}%; transition: width 0.5s ease;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async loadBooks() {
        const loading = document.getElementById('loading');
        const tableBody = document.getElementById('bookTableBody');
        const mobileList = document.getElementById('mobileBooksList');
        
        try {
            if (loading) loading.classList.remove('hidden');

            const params = new URLSearchParams({
                page: this.currentPage,
                limit: this.itemsPerPage,
                search: this.searchQuery,
                sortBy: this.sortBy,
                sortOrder: this.sortOrder,
                genre: this.genreFilter
            });

            const response = await fetch(`${this.API_BASE}/books?${params}`);
            if (!response.ok) {
                throw new Error('Failed to load books');
            }

            const data = await response.json();
            
            // Update desktop table
            if (tableBody) {
                this.updateBooksTable(data.books);
            }
            
            // Update mobile cards
            if (mobileList) {
                this.updateMobileBooks(data.books);
            }
            
            // Update pagination
            this.updatePagination(data.pagination);
            
        } catch (error) {
            console.error('Error loading books:', error);
            this.showToast('Failed to load books', 'error');
            
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="6">Failed to load books</td></tr>';
            if (mobileList) mobileList.innerHTML = '<p class="empty-state">Failed to load books</p>';
        } finally {
            if (loading) loading.classList.add('hidden');
        }
    }

    updateBooksTable(books) {
        const tableBody = document.getElementById('bookTableBody');
        if (!tableBody) return;

        if (!books || books.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" class="empty-state">No books found</td></tr>';
            return;
        }

        tableBody.innerHTML = books.map(book => `
            <tr>
                <td><strong>${this.escapeHtml(book.title)}</strong></td>
                <td>${this.escapeHtml(book.author)}</td>
                <td>${this.escapeHtml(book.genre || 'N/A')}</td>
                <td class="price">$${parseFloat(book.price).toFixed(2)}</td>
                <td>${book.quantity}</td>
                <td>
                    <button class="btn btn-secondary" style="font-size: 0.75rem; padding: 0.5rem 0.75rem; margin-right: 0.5rem;" onclick="bookstoreApp.editBook(${book.id})">
                        ✏️ Edit
                    </button>
                    <button class="btn btn-danger" style="font-size: 0.75rem; padding: 0.5rem 0.75rem;" onclick="bookstoreApp.deleteBook(${book.id})">
                        🗑️ Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    updateMobileBooks(books) {
        const mobileList = document.getElementById('mobileBooksList');
        if (!mobileList) return;

        if (!books || books.length === 0) {
            mobileList.innerHTML = '<p class="empty-state">No books found</p>';
            return;
        }

        mobileList.innerHTML = books.map(book => `
            <div class="mobile-book-card">
                <h3>${this.escapeHtml(book.title)}</h3>
                <div class="book-meta">
                    <span><strong>Author:</strong> ${this.escapeHtml(book.author)}</span>
                    <span><strong>Genre:</strong> ${this.escapeHtml(book.genre || 'N/A')}</span>
                    <span><strong>Price:</strong> <span class="price">$${parseFloat(book.price).toFixed(2)}</span></span>
                    <span><strong>Quantity:</strong> ${book.quantity}</span>
                </div>
                ${book.description ? `<p style="color: var(--gray-600); font-size: var(--font-size-sm); margin-bottom: var(--space-3);">${this.escapeHtml(book.description)}</p>` : ''}
                <div class="book-actions">
                    <button class="btn btn-secondary" onclick="bookstoreApp.editBook(${book.id})">✏️ Edit</button>
                    <button class="btn btn-danger" onclick="bookstoreApp.deleteBook(${book.id})">🗑️ Delete</button>
                </div>
            </div>
        `).join('');
    }

    updatePagination(pagination) {
        const container = document.getElementById('pagination');
        if (!container || !pagination) return;

        const { page, totalPages } = pagination;
        let paginationHTML = '';

        // Previous button
        paginationHTML += `
            <button ${page <= 1 ? 'disabled' : ''} onclick="bookstoreApp.goToPage(${page - 1})">
                ← Previous
            </button>
        `;

        // Page numbers
        const startPage = Math.max(1, page - 2);
        const endPage = Math.min(totalPages, page + 2);

        if (startPage > 1) {
            paginationHTML += `<button onclick="bookstoreApp.goToPage(1)">1</button>`;
            if (startPage > 2) paginationHTML += `<span>...</span>`;
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="${i === page ? 'active' : ''}" onclick="bookstoreApp.goToPage(${i})">
                    ${i}
                </button>
            `;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) paginationHTML += `<span>...</span>`;
            paginationHTML += `<button onclick="bookstoreApp.goToPage(${totalPages})">${totalPages}</button>`;
        }

        // Next button
        paginationHTML += `
            <button ${page >= totalPages ? 'disabled' : ''} onclick="bookstoreApp.goToPage(${page + 1})">
                Next →
            </button>
        `;

        container.innerHTML = paginationHTML;
    }

    goToPage(page) {
        this.currentPage = page;
        this.loadBooks();
    }

    async loadGenreFilter() {
        try {
            const response = await fetch(`${this.API_BASE}/stats`);
            if (!response.ok) return;

            const stats = await response.json();
            const genreFilter = document.getElementById('genreFilter');
            
            if (genreFilter && stats.genres) {
                const currentValue = genreFilter.value;
                genreFilter.innerHTML = '<option value="">All Genres</option>' +
                    stats.genres.map(genre => 
                        `<option value="${this.escapeHtml(genre.genre)}" ${genre.genre === currentValue ? 'selected' : ''}>
                            ${this.escapeHtml(genre.genre)} (${genre.count})
                        </option>`
                    ).join('');
            }
        } catch (error) {
            console.error('Error loading genres:', error);
        }
    }

    performSearch() {
        const searchInput = document.getElementById('searchInput');
        this.searchQuery = searchInput ? searchInput.value : '';
        this.currentPage = 1;
        this.loadBooks();
    }

    async handleAddBook(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const bookData = {
            title: formData.get('title'),
            author: formData.get('author'),
            price: parseFloat(formData.get('price')),
            quantity: parseInt(formData.get('quantity')) || 1,
            isbn: formData.get('isbn') || null,
            genre: formData.get('genre') || null,
            description: formData.get('description') || null
        };

        try {
            const response = await fetch(`${this.API_BASE}/books`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bookData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to add book');
            }

            this.showToast('Book added successfully!', 'success');
            event.target.reset();
            
            // Switch to books section and refresh
            this.showSection('books');
            this.loadBooks();
            this.loadDashboard(); // Refresh stats
            
        } catch (error) {
            console.error('Error adding book:', error);
            this.showToast(error.message, 'error');
        }
    }

    async editBook(bookId) {
        try {
            const response = await fetch(`${this.API_BASE}/books/${bookId}`);
            if (!response.ok) {
                throw new Error('Failed to load book details');
            }

            const book = await response.json();
            this.currentEditId = bookId;

            // Populate edit form
            document.getElementById('editTitle').value = book.title || '';
            document.getElementById('editAuthor').value = book.author || '';
            document.getElementById('editPrice').value = book.price || '';
            document.getElementById('editQuantity').value = book.quantity || 1;
            document.getElementById('editIsbn').value = book.isbn || '';
            document.getElementById('editGenre').value = book.genre || '';
            document.getElementById('editDescription').value = book.description || '';

            // Show modal
            this.showModal();

        } catch (error) {
            console.error('Error loading book for edit:', error);
            this.showToast('Failed to load book details', 'error');
        }
    }

    async handleEditBook(event) {
        event.preventDefault();
        
        if (!this.currentEditId) return;

        const formData = new FormData(event.target);
        const bookData = {
            title: formData.get('title'),
            author: formData.get('author'),
            price: parseFloat(formData.get('price')),
            quantity: parseInt(formData.get('quantity')) || 1,
            isbn: formData.get('isbn') || null,
            genre: formData.get('genre') || null,
            description: formData.get('description') || null
        };

        try {
            const response = await fetch(`${this.API_BASE}/books/${this.currentEditId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bookData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to update book');
            }

            this.showToast('Book updated successfully!', 'success');
            this.closeModal();
            this.loadBooks();
            this.loadDashboard(); // Refresh stats
            
        } catch (error) {
            console.error('Error updating book:', error);
            this.showToast(error.message, 'error');
        }
    }

    async deleteBook(bookId) {
        try {
            // Get book details for confirmation
            const response = await fetch(`${this.API_BASE}/books/${bookId}`);
            if (!response.ok) {
                throw new Error('Failed to load book details');
            }

            const book = await response.json();
            
            if (!confirm(`Are you sure you want to delete "${book.title}" by ${book.author}?`)) {
                return;
            }

            const deleteResponse = await fetch(`${this.API_BASE}/books/${bookId}`, {
                method: 'DELETE'
            });

            if (!deleteResponse.ok) {
                const error = await deleteResponse.json();
                throw new Error(error.error || 'Failed to delete book');
            }

            this.showToast('Book deleted successfully!', 'success');
            this.loadBooks();
            this.loadDashboard(); // Refresh stats
            
        } catch (error) {
            console.error('Error deleting book:', error);
            this.showToast(error.message, 'error');
        }
    }

    showModal() {
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal() {
        const modal = document.getElementById('editModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
            this.currentEditId = null;
        }
    }

    async refreshData() {
        this.showToast('Refreshing data...', 'info');
        
        const currentSection = document.querySelector('.section.active')?.id;
        
        switch (currentSection) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'books':
                await this.loadBooks();
                await this.loadGenreFilter();
                break;
            case 'stats':
                await this.loadDetailedStats();
                break;
        }
        
        this.showToast('Data refreshed successfully!', 'success');
    }

    async exportData() {
        try {
            const response = await fetch(`${this.API_BASE}/export`);
            if (!response.ok) {
                throw new Error('Failed to export data');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bookstore-export-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            this.showToast('Data exported successfully!', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            this.showToast('Failed to export data', 'error');
        }
    }

    async loadDetailedStats() {
        try {
            const response = await fetch(`${this.API_BASE}/stats`);
            if (!response.ok) {
                throw new Error('Failed to load statistics');
            }

            const stats = await response.json();
            
            this.updateDetailedStats(stats);
            this.updateGenreBreakdown(stats.genres);
            
        } catch (error) {
            console.error('Error loading detailed stats:', error);
            this.showToast('Failed to load statistics', 'error');
        }
    }

    updateDetailedStats(stats) {
        const container = document.getElementById('detailedStats');
        if (!container) return;

        const totalBooks = stats.totalBooks?.total || 0;
        const totalValue = stats.totalValue?.total || 0;
        const avgPrice = totalBooks > 0 ? totalValue / totalBooks : 0;

        container.innerHTML = `
            <div class="stats-row" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
                <div class="stat-item" style="background: var(--gray-50); padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--gray-200);">
                    <h4 style="color: var(--gray-700); margin-bottom: 0.5rem;">Total Books</h4>
                    <p style="font-size: 1.5rem; font-weight: 700; color: var(--primary-color);">${totalBooks}</p>
                </div>
                <div class="stat-item" style="background: var(--gray-50); padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--gray-200);">
                    <h4 style="color: var(--gray-700); margin-bottom: 0.5rem;">Total Inventory Value</h4>
                    <p style="font-size: 1.5rem; font-weight: 700; color: var(--success-color);">$${totalValue.toFixed(2)}</p>
                </div>
                <div class="stat-item" style="background: var(--gray-50); padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--gray-200);">
                    <h4 style="color: var(--gray-700); margin-bottom: 0.5rem;">Average Book Price</h4>
                    <p style="font-size: 1.5rem; font-weight: 700; color: var(--info-color);">$${avgPrice.toFixed(2)}</p>
                </div>
                <div class="stat-item" style="background: var(--gray-50); padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--gray-200);">
                    <h4 style="color: var(--gray-700); margin-bottom: 0.5rem;">Unique Genres</h4>
                    <p style="font-size: 1.5rem; font-weight: 700; color: var(--warning-color);">${stats.genres?.length || 0}</p>
                </div>
            </div>
            
            <div class="recent-additions" style="background: var(--gray-50); padding: 1rem; border-radius: 0.5rem; border: 1px solid var(--gray-200);">
                <h4 style="color: var(--gray-700); margin-bottom: 1rem;">Recent Additions</h4>
                <div class="recent-books-list">
                    ${stats.recentBooks?.map(book => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--gray-200);">
                            <div>
                                <strong>${this.escapeHtml(book.title)}</strong>
                                <span style="color: var(--gray-600);"> by ${this.escapeHtml(book.author)}</span>
                            </div>
                            <span style="color: var(--success-color); font-weight: 600;">$${parseFloat(book.price).toFixed(2)}</span>
                        </div>
                    `).join('') || '<p style="color: var(--gray-600);">No recent books</p>'}
                </div>
            </div>
        `;
    }

    updateGenreBreakdown(genres) {
        const container = document.getElementById('genreBreakdown');
        if (!container || !genres) return;

        if (genres.length === 0) {
            container.innerHTML = '<p class="empty-state">No genre data available</p>';
            return;
        }

        const totalBooks = genres.reduce((sum, genre) => sum + genre.count, 0);

        container.innerHTML = genres.map(genre => {
            const percentage = ((genre.count / totalBooks) * 100).toFixed(1);
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--gray-50); border-radius: 0.5rem; margin-bottom: 0.5rem; border: 1px solid var(--gray-200);">
                    <div>
                        <strong style="color: var(--gray-800);">${this.escapeHtml(genre.genre)}</strong>
                        <span style="color: var(--gray-600); font-size: 0.875rem;"> (${percentage}%)</span>
                    </div>
                    <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.875rem;">
                        ${genre.count} books
                    </span>
                </div>
            `;
        }).join('');
    }

    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + K for search
        if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
            event.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
                this.showSection('books');
            }
        }

        // Escape to close modal
        if (event.key === 'Escape') {
            this.closeModal();
        }

        // Ctrl/Cmd + Enter to submit forms
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            const activeElement = document.activeElement;
            const form = activeElement?.closest('form');
            if (form) {
                event.preventDefault();
                form.requestSubmit();
            }
        }
    }

    showToast(message, type = 'info', title = '') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toastId = 'toast-' + Date.now();
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${this.escapeHtml(title)}</div>` : ''}
                <div class="toast-message">${this.escapeHtml(message)}</div>
            </div>
            <button class="toast-close" onclick="document.getElementById('${toastId}').remove()">×</button>
        `;

        container.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            const toastElement = document.getElementById(toastId);
            if (toastElement) {
                toastElement.style.animation = 'slideInToast 0.3s ease-out reverse';
                setTimeout(() => toastElement.remove(), 300);
            }
        }, 5000);
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.bookstoreApp = new BookstoreApp();
});

// Service Worker for PWA functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    });
}
