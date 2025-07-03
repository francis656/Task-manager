const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8000', 'http://127.0.0.1:5500'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite database
const db = new sqlite3.Database('./bookstore.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initializeDatabase();
  }
});

// Initialize database schema
function initializeDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      price REAL NOT NULL,
      isbn TEXT UNIQUE,
      genre TEXT,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      date_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.run(createTableQuery, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    } else {
      console.log('Books table ready.');
      insertSampleData();
    }
  });
}

// Insert sample data if table is empty
function insertSampleData() {
  db.get("SELECT COUNT(*) as count FROM books", (err, row) => {
    if (!err && row.count === 0) {
      const sampleBooks = [
        ["To Kill a Mockingbird", "Harper Lee", 14.99, "978-0-06-112008-4", "Fiction", "A gripping tale of racial injustice and childhood innocence.", 5],
        ["1984", "George Orwell", 13.99, "978-0-452-28423-4", "Dystopian Fiction", "A dystopian social science fiction novel and cautionary tale.", 3],
        ["Pride and Prejudice", "Jane Austen", 12.99, "978-0-14-143951-8", "Romance", "A romantic novel of manners set in Georgian England.", 4],
        ["The Great Gatsby", "F. Scott Fitzgerald", 15.99, "978-0-7432-7356-5", "Fiction", "A classic American novel set in the Jazz Age.", 2],
        ["Harry Potter and the Sorcerer's Stone", "J.K. Rowling", 16.99, "978-0-439-70818-8", "Fantasy", "The first book in the beloved Harry Potter series.", 10]
      ];

      const insertQuery = `INSERT INTO books (title, author, price, isbn, genre, description, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      
      sampleBooks.forEach(book => {
        db.run(insertQuery, book, (err) => {
          if (err) console.error('Error inserting sample data:', err.message);
        });
      });
      
      console.log('Sample data inserted.');
    }
  });
}

// Input validation middleware
function validateBook(req, res, next) {
  const { title, author, price } = req.body;
  
  if (!title || !author || !price) {
    return res.status(400).json({ 
      error: 'Title, author, and price are required fields.' 
    });
  }
  
  if (typeof price !== 'number' || price <= 0) {
    return res.status(400).json({ 
      error: 'Price must be a positive number.' 
    });
  }
  
  if (title.length > 255 || author.length > 255) {
    return res.status(400).json({ 
      error: 'Title and author must be less than 255 characters.' 
    });
  }
  
  next();
}

// API Routes

// Get all books with pagination, search, and sorting
app.get('/api/books', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const sortBy = req.query.sortBy || 'date_added';
  const sortOrder = req.query.sortOrder || 'DESC';
  const genre = req.query.genre || '';
  
  const offset = (page - 1) * limit;
  
  let whereClause = 'WHERE 1=1';
  let params = [];
  
  if (search) {
    whereClause += ` AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  
  if (genre) {
    whereClause += ` AND genre LIKE ?`;
    params.push(`%${genre}%`);
  }
  
  // Validate sort parameters
  const validSortFields = ['title', 'author', 'price', 'date_added', 'genre', 'quantity'];
  const validSortOrders = ['ASC', 'DESC'];
  
  if (!validSortFields.includes(sortBy) || !validSortOrders.includes(sortOrder.toUpperCase())) {
    return res.status(400).json({ error: 'Invalid sort parameters.' });
  }
  
  const query = `
    SELECT * FROM books 
    ${whereClause} 
    ORDER BY ${sortBy} ${sortOrder.toUpperCase()} 
    LIMIT ? OFFSET ?
  `;
  
  const countQuery = `SELECT COUNT(*) as total FROM books ${whereClause}`;
  
  // Get total count
  db.get(countQuery, params, (err, countRow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Get books
    db.all(query, [...params, limit, offset], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.json({
        books: rows,
        pagination: {
          page,
          limit,
          total: countRow.total,
          totalPages: Math.ceil(countRow.total / limit)
        }
      });
    });
  });
});

// Get single book by ID
app.get('/api/books/:id', (req, res) => {
  const id = req.params.id;
  
  db.get('SELECT * FROM books WHERE id = ?', [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Book not found.' });
    }
    
    res.json(row);
  });
});

// Add new book
app.post('/api/books', validateBook, (req, res) => {
  const { title, author, price, isbn, genre, description, quantity } = req.body;
  
  // Check for duplicate ISBN if provided
  if (isbn) {
    db.get('SELECT id FROM books WHERE isbn = ?', [isbn], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      if (row) {
        return res.status(409).json({ error: 'Book with this ISBN already exists.' });
      }
      
      insertBook();
    });
  } else {
    insertBook();
  }
  
  function insertBook() {
    const query = `
      INSERT INTO books (title, author, price, isbn, genre, description, quantity) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [title, author, price, isbn, genre, description, quantity || 1], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Return the created book
      db.get('SELECT * FROM books WHERE id = ?', [this.lastID], (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        res.status(201).json({
          message: 'Book added successfully.',
          book: row
        });
      });
    });
  }
});

// Update book
app.put('/api/books/:id', validateBook, (req, res) => {
  const id = req.params.id;
  const { title, author, price, isbn, genre, description, quantity } = req.body;
  
  const query = `
    UPDATE books 
    SET title = ?, author = ?, price = ?, isbn = ?, genre = ?, description = ?, quantity = ?, date_updated = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  db.run(query, [title, author, price, isbn, genre, description, quantity || 1, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Book not found.' });
    }
    
    // Return updated book
    db.get('SELECT * FROM books WHERE id = ?', [id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      res.json({
        message: 'Book updated successfully.',
        book: row
      });
    });
  });
});

// Delete book
app.delete('/api/books/:id', (req, res) => {
  const id = req.params.id;
  
  db.run('DELETE FROM books WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Book not found.' });
    }
    
    res.json({ message: 'Book deleted successfully.' });
  });
});

// Get book statistics
app.get('/api/stats', (req, res) => {
  const queries = {
    totalBooks: 'SELECT COUNT(*) as total FROM books',
    totalValue: 'SELECT SUM(price * quantity) as total FROM books',
    genres: 'SELECT genre, COUNT(*) as count FROM books WHERE genre IS NOT NULL GROUP BY genre ORDER BY count DESC',
    recentBooks: 'SELECT * FROM books ORDER BY date_added DESC LIMIT 5'
  };
  
  const stats = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;
  
  Object.entries(queries).forEach(([key, query]) => {
    if (key === 'genres' || key === 'recentBooks') {
      db.all(query, (err, rows) => {
        if (!err) stats[key] = rows;
        completed++;
        if (completed === totalQueries) res.json(stats);
      });
    } else {
      db.get(query, (err, row) => {
        if (!err) stats[key] = row;
        completed++;
        if (completed === totalQueries) res.json(stats);
      });
    }
  });
});

// Export books to JSON
app.get('/api/export', (req, res) => {
  db.all('SELECT * FROM books ORDER BY title', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=bookstore-export.json');
    res.json({
      exported_at: new Date().toISOString(),
      total_books: rows.length,
      books: rows
    });
  });
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Bookstore Management System running on http://localhost:${PORT}`);
  console.log(`📚 API available at http://localhost:${PORT}/api/books`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
});