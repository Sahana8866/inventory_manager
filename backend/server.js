// const express = require('express');
// const cors = require('cors');
// const sqlite3 = require('sqlite3').verbose();
// const path = require('path');

// const app = express();
// const PORT = 5000;

// // ✅ FIXED CORS - Allow everything
// app.use(cors());
// app.use(express.json());

// // ✅ Request logging
// app.use((req, res, next) => {
//   console.log(`📍 ${new Date().toLocaleTimeString()} - ${req.method} ${req.path}`);
//   if (Object.keys(req.body).length > 0) {
//     console.log('📦 Body:', req.body);
//   }
//   next();
// });

// // Database setup - PERSISTENT FILE
// const db = new sqlite3.Database('./inventory.db', (err) => {
//   if (err) {
//     console.error('❌ Error opening database:', err);
//   } else {
//     console.log('✅ Connected to SQLite database: inventory.db');
//   }
// });

// // Initialize database - FIXED VERSION
// db.serialize(() => {
//   // Create table if it doesn't exist
//   db.run(`CREATE TABLE IF NOT EXISTS items (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     name TEXT NOT NULL,
//     description TEXT,
//     category TEXT NOT NULL,
//     quantity INTEGER NOT NULL,
//     price REAL NOT NULL,
//     min_stock INTEGER DEFAULT 0,
//     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
//   )`, function(err) {
//     if (err) {
//       console.error('❌ Error creating table:', err);
//     } else {
//       console.log('✅ Items table ready');
      
//       // Check if we need to insert sample data
//       db.get("SELECT COUNT(*) as count FROM items", (err, row) => {
//         if (err) {
//           console.error('Error checking items count:', err);
//           return;
//         }
        
//         if (row.count === 0) {
//           console.log('📝 Inserting sample data...');
//           const sampleItems = [
//             ['Laptop', 'Gaming Laptop 16GB RAM', 'Electronics', 15, 999.99, 5],
//             ['Mouse', 'Wireless Optical Mouse', 'Electronics', 45, 25.50, 10],
//             ['Notebook', 'A4 Size 100 pages', 'Stationery', 8, 4.99, 15]
//           ];

//           const stmt = db.prepare(`INSERT INTO items (name, description, category, quantity, price, min_stock) VALUES (?, ?, ?, ?, ?, ?)`);
//           sampleItems.forEach(item => {
//             stmt.run(item, function(err) {
//               if (err) {
//                 console.error('Error inserting sample item:', err);
//               }
//             });
//           });
//           stmt.finalize();
//           console.log('✅ Sample data inserted');
//         } else {
//           console.log(`📊 Database has ${row.count} existing items`);
//         }
//       });
//     }
//   });
// });

// // ✅ GET ALL ITEMS
// app.get('/api/items', (req, res) => {
//   console.log('📋 Fetching all items');
//   db.all('SELECT * FROM items ORDER BY created_at DESC', (err, rows) => {
//     if (err) {
//       console.error('❌ Database error:', err);
//       res.status(500).json({ error: err.message });
//       return;
//     }
//     console.log(`✅ Returning ${rows.length} items`);
//     res.json(rows);
//   });
// });

// // ✅ GET LOW STOCK ITEMS
// app.get('/api/items/low-stock', (req, res) => {
//   db.all('SELECT * FROM items WHERE quantity <= min_stock ORDER BY quantity ASC', (err, rows) => {
//     if (err) {
//       res.status(500).json({ error: err.message });
//       return;
//     }
//     res.json(rows);
//   });
// });

// // ✅ CREATE NEW ITEM - FIXED
// app.post('/api/items', (req, res) => {
//   console.log('🎯 CREATE ITEM REQUEST:', req.body);
  
//   const { name, description, category, quantity, price, min_stock } = req.body;
  
//   // Validation
//   if (!name || !category || quantity === undefined || price === undefined) {
//     console.log('❌ Missing fields');
//     return res.status(400).json({ 
//       error: 'Missing required fields',
//       received: req.body
//     });
//   }

//   const stmt = db.prepare(`INSERT INTO items (name, description, category, quantity, price, min_stock) VALUES (?, ?, ?, ?, ?, ?)`);
  
//   stmt.run([name, description || '', category, quantity, price, min_stock || 0], function(err) {
//     if (err) {
//       console.error('❌ Database insert error:', err);
//       return res.status(500).json({ error: 'Database error: ' + err.message });
//     }
    
//     console.log('✅ Item created successfully, ID:', this.lastID);
//     res.json({ 
//       id: this.lastID, 
//       message: 'Item created successfully',
//       item: { id: this.lastID, name, description, category, quantity, price, min_stock }
//     });
//   });
  
//   stmt.finalize();
// });

// // ✅ UPDATE ITEM
// app.put('/api/items/:id', (req, res) => {
//   const id = req.params.id;
//   const { name, description, category, quantity, price, min_stock } = req.body;

//   const stmt = db.prepare(`UPDATE items SET name=?, description=?, category=?, quantity=?, price=?, min_stock=? WHERE id=?`);
  
//   stmt.run([name, description, category, quantity, price, min_stock, id], function(err) {
//     if (err) {
//       res.status(500).json({ error: err.message });
//       return;
//     }
//     res.json({ message: 'Item updated successfully' });
//   });
//   stmt.finalize();
// });

// // ✅ DELETE ITEM
// app.delete('/api/items/:id', (req, res) => {
//   const id = req.params.id;
  
//   db.run('DELETE FROM items WHERE id = ?', [id], function(err) {
//     if (err) {
//       res.status(500).json({ error: err.message });
//       return;
//     }
//     res.json({ message: 'Item deleted successfully' });
//   });
// });

// // ✅ GET CATEGORIES
// app.get('/api/categories', (req, res) => {
//   db.all('SELECT DISTINCT category FROM items ORDER BY category', (err, rows) => {
//     if (err) {
//       res.status(500).json({ error: err.message });
//       return;
//     }
//     res.json(rows.map(row => row.category));
//   });
// });

// // ✅ HEALTH CHECK
// app.get('/api/health', (req, res) => {
//   res.json({ 
//     status: 'OK', 
//     timestamp: new Date().toISOString(),
//     message: 'Backend is running perfectly!'
//   });
// });

// // ✅ START SERVER
// app.listen(PORT, () => {
//   console.log(`\n🎉 BACKEND SERVER STARTED SUCCESSFULLY!`);
//   console.log(`📍 Server running on http://localhost:${PORT}`);
//   console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
//   console.log(`📋 Get items: http://localhost:${PORT}/api/items`);
//   console.log(`\n⚠️  KEEP THIS TERMINAL OPEN AND RUNNING!\n`);
// });

const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS - Smart configuration
if (process.env.NODE_ENV === 'production') {
  app.use(cors());
} else {
  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
  }));
}

app.use(express.json());

// ✅ Request logging
app.use((req, res, next) => {
  console.log(`📍 ${new Date().toLocaleTimeString()} - ${req.method} ${req.path}`);
  next();
});

// ✅ Database setup - Use file in production, memory in development for testing
const dbPath = process.env.NODE_ENV === 'production' ? './inventory.db' : ':memory:';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Database error:', err);
  } else {
    console.log(`✅ Connected to SQLite database: ${dbPath}`);
  }
});

// ✅ Initialize database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    min_stock INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, function(err) {
    if (err) {
      console.error('❌ Table creation error:', err);
    } else {
      console.log('✅ Items table ready');
      
      // Insert sample data if empty
      db.get("SELECT COUNT(*) as count FROM items", (err, row) => {
        if (!err && row.count === 0) {
          console.log('📝 Inserting sample data...');
          const sampleItems = [
            ['Laptop', 'Gaming Laptop 16GB RAM', 'Electronics', 15, 999.99, 5],
            ['Mouse', 'Wireless Optical Mouse', 'Electronics', 45, 25.50, 10],
            ['Notebook', 'A4 Size 100 pages', 'Stationery', 8, 4.99, 15]
          ];

          const stmt = db.prepare(`INSERT INTO items (name, description, category, quantity, price, min_stock) VALUES (?, ?, ?, ?, ?, ?)`);
          sampleItems.forEach(item => stmt.run(item));
          stmt.finalize();
          console.log('✅ Sample data inserted');
        } else {
          console.log(`📊 Database has ${row?.count || 0} items`);
        }
      });
    }
  });
});

// ✅ Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
  console.log('✅ Serving React build files');
}

// ✅ API Routes
app.get('/api/items', (req, res) => {
  db.all('SELECT * FROM items ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/items/low-stock', (req, res) => {
  db.all('SELECT * FROM items WHERE quantity <= min_stock ORDER BY quantity ASC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/items', (req, res) => {
  const { name, description, category, quantity, price, min_stock } = req.body;
  
  if (!name || !category || quantity === undefined || price === undefined) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const stmt = db.prepare(`INSERT INTO items (name, description, category, quantity, price, min_stock) VALUES (?, ?, ?, ?, ?, ?)`);
  
  stmt.run([name, description || '', category, quantity, price, min_stock || 0], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, message: 'Item created successfully' });
  });
  stmt.finalize();
});

app.put('/api/items/:id', (req, res) => {
  const id = req.params.id;
  const { name, description, category, quantity, price, min_stock } = req.body;

  const stmt = db.prepare(`UPDATE items SET name=?, description=?, category=?, quantity=?, price=?, min_stock=? WHERE id=?`);
  
  stmt.run([name, description, category, quantity, price, min_stock, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Item updated successfully' });
  });
  stmt.finalize();
});

app.delete('/api/items/:id', (req, res) => {
  const id = req.params.id;
  
  db.run('DELETE FROM items WHERE id = ?', [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Item deleted successfully' });
  });
});

app.get('/api/categories', (req, res) => {
  db.all('SELECT DISTINCT category FROM items ORDER BY category', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows.map(row => row.category));
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString() 
  });
});

// ✅ Catch all handler - MUST BE LAST
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

// ✅ Start server
app.listen(PORT, () => {
  console.log(`\n🎉 INVENTORY MANAGER SERVER STARTED!`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
  console.log(`📊 API: http://localhost:${PORT}/api/items`);
  if (process.env.NODE_ENV === 'production') {
    console.log(`🚀 Frontend: Serving from React build`);
  }
  console.log(`\n⚠️  Server is ready!`);
});