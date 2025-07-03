// Book Management System
class BookStore {
    constructor() {
        this.books = this.loadBooksFromStorage();
        this.bookForm = document.getElementById('bookForm');
        this.bookTableBody = document.getElementById('bookTableBody');
        
        this.initializeEventListeners();
        this.displayBooks();
    }

    // Initialize event listeners
    initializeEventListeners() {
        this.bookForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.addBook();
        });
    }

    // Load books from localStorage
    loadBooksFromStorage() {
        const stored = localStorage.getItem('bookstore_books');
        return stored ? JSON.parse(stored) : [];
    }

    // Save books to localStorage
    saveBooksToStorage() {
        localStorage.setItem('bookstore_books', JSON.stringify(this.books));
    }

    // Add a new book
    addBook() {
        const title = document.getElementById('title').value.trim();
        const author = document.getElementById('author').value.trim();
        const price = parseFloat(document.getElementById('price').value);

        // Validation
        if (!title || !author || !price || price <= 0) {
            this.showNotification('Please fill in all fields correctly!', 'error');
            return;
        }

        // Check if book already exists
        const existingBook = this.books.find(book => 
            book.title.toLowerCase() === title.toLowerCase() && 
            book.author.toLowerCase() === author.toLowerCase()
        );

        if (existingBook) {
            this.showNotification('This book already exists in the system!', 'warning');
            return;
        }

        // Create new book object
        const newBook = {
            id: Date.now(), // Simple ID generation
            title: title,
            author: author,
            price: price,
            dateAdded: new Date().toLocaleDateString()
        };

        // Add to books array
        this.books.unshift(newBook); // Add to beginning for recent-first display
        
        // Save to storage
        this.saveBooksToStorage();
        
        // Update display
        this.displayBooks();
        
        // Clear form
        this.bookForm.reset();
        
        // Show success message
        this.showNotification('Book added successfully!', 'success');
    }

    // Display all books in table
    displayBooks() {
        if (this.books.length === 0) {
            this.bookTableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="empty-state">
                        No books in the system yet. Add your first book above!
                    </td>
                </tr>
            `;
            return;
        }

        this.bookTableBody.innerHTML = this.books.map(book => `
            <tr data-book-id="${book.id}">
                <td><strong>${this.escapeHtml(book.title)}</strong></td>
                <td>${this.escapeHtml(book.author)}</td>
                <td class="price">$${book.price.toFixed(2)}</td>
                <td>
                    <button class="delete-btn" onclick="bookStore.deleteBook(${book.id})">
                        Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }

    // Delete a book
    deleteBook(bookId) {
        // Find book for confirmation
        const book = this.books.find(b => b.id === bookId);
        if (!book) return;

        // Confirm deletion
        if (!confirm(`Are you sure you want to delete "${book.title}" by ${book.author}?`)) {
            return;
        }

        // Remove from array
        this.books = this.books.filter(b => b.id !== bookId);
        
        // Save to storage
        this.saveBooksToStorage();
        
        // Update display
        this.displayBooks();
        
        // Show success message
        this.showNotification('Book deleted successfully!', 'success');
    }

    // Show notification to user
    showNotification(message, type = 'info') {
        // Remove any existing notifications
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        // Add notification styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 10px;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        `;

        // Set background color based on type
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        // Style the close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            margin-left: 10px;
        `;

        // Add animation keyframes to document if not exists
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }

        // Add to document
        document.body.appendChild(notification);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => notification.remove(), 300);
            }
        }, 4000);
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Get book statistics
    getStats() {
        return {
            totalBooks: this.books.length,
            totalValue: this.books.reduce((sum, book) => sum + book.price, 0),
            averagePrice: this.books.length > 0 ? 
                this.books.reduce((sum, book) => sum + book.price, 0) / this.books.length : 0
        };
    }

    // Search books (can be extended later)
    searchBooks(query) {
        query = query.toLowerCase();
        return this.books.filter(book => 
            book.title.toLowerCase().includes(query) ||
            book.author.toLowerCase().includes(query)
        );
    }

    // Export books data (can be extended later)
    exportBooks() {
        const dataStr = JSON.stringify(this.books, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'bookstore_data.json';
        link.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Books data exported successfully!', 'success');
    }
}

// Initialize the bookstore when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global instance
    window.bookStore = new BookStore();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to submit form when in input fields
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const activeElement = document.activeElement;
            if (activeElement && activeElement.closest('#bookForm')) {
                e.preventDefault();
                bookStore.bookForm.requestSubmit();
            }
        }
    });

    // Add some sample data for demo purposes (only if no data exists)
    if (window.bookStore.books.length === 0) {
        const sampleBooks = [
            { id: 1, title: "To Kill a Mockingbird", author: "Harper Lee", price: 14.99, dateAdded: "12/1/2023" },
            { id: 2, title: "1984", author: "George Orwell", price: 13.99, dateAdded: "12/1/2023" },
            { id: 3, title: "Pride and Prejudice", author: "Jane Austen", price: 12.99, dateAdded: "12/1/2023" }
        ];
        
        // Only add if user wants sample data (you can remove this in production)
        console.log('Sample books available. Call bookStore.loadSampleData() to add them.');
        
        // Add method to load sample data
        window.bookStore.loadSampleData = () => {
            window.bookStore.books = sampleBooks;
            window.bookStore.saveBooksToStorage();
            window.bookStore.displayBooks();
            window.bookStore.showNotification('Sample books loaded!', 'success');
        };
    }
});
