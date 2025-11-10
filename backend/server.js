const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB Atlas!'))
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;

// User Schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Item Schema
const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        required: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    min_stock: {
        type: Number,
        default: 0,
        min: 0
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

const Item = mongoose.model('Item', itemSchema);

// Authentication Middleware
const auth = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token provided, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};

// Auth Routes

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }

        // Create user
        const user = new User({ name, email, password });
        await user.save();

        // Generate token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid email or password' });
        }

        // Generate token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Get current user
app.get('/api/auth/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        res.json({ user });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Item Routes (Protected)

// Get all items for user
app.get('/api/items', auth, async (req, res) => {
    try {
        const items = await Item.find({ user: req.userId }).sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get categories for user
app.get('/api/categories', auth, async (req, res) => {
    try {
        const categories = await Item.distinct('category', { user: req.userId });
        res.json(categories.sort());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single item
app.get('/api/items/:id', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }

        const item = await Item.findOne({ _id: req.params.id, user: req.userId });
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new item
app.post('/api/items', auth, async (req, res) => {
    try {
        const { name, description, category, quantity, price, min_stock } = req.body;

        // Validation
        if (!name || !category || quantity === undefined || price === undefined) {
            return res.status(400).json({ error: 'Missing required fields: name, category, quantity, price' });
        }

        const item = new Item({
            name: name.trim(),
            description: description?.trim() || '',
            category: category.trim(),
            quantity: parseInt(quantity),
            price: parseFloat(price),
            min_stock: parseInt(min_stock) || 0,
            user: req.userId
        });

        await item.save();
        res.status(201).json({ 
            message: 'Item created successfully',
            item: item
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Update item
app.put('/api/items/:id', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }

        const { name, description, category, quantity, price, min_stock } = req.body;

        // Validation
        if (!name || !category || quantity === undefined || price === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const item = await Item.findOneAndUpdate(
            { _id: req.params.id, user: req.userId },
            {
                name: name.trim(),
                description: description?.trim() || '',
                category: category.trim(),
                quantity: parseInt(quantity),
                price: parseFloat(price),
                min_stock: parseInt(min_stock) || 0
            },
            { new: true, runValidators: true }
        );

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ 
            message: 'Item updated successfully',
            item: item
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// Delete item
app.delete('/api/items/:id', auth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }

        const item = await Item.findOneAndDelete({ _id: req.params.id, user: req.userId });
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ message: 'Item deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        timestamp: new Date().toISOString()
    });
});

// Serve frontend for all routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🎉 MyInventory Server Started!`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Authentication: Enabled`);
    console.log(`🚀 Frontend: http://localhost:${PORT}`);
    console.log(`\n✅ Server is ready!`);
});