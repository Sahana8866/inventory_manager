const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

console.log('🔗 Attempting MongoDB connection...');

mongoose.connect(MONGODB_URI)
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
    },
    role: {
        type: String,
        enum: ['admin', 'customer'],
        default: 'customer'
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
    },
    is_available: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

const Item = mongoose.model('Item', itemSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
    order_number: {
        type: String,
        unique: true,
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        item: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Item',
            required: true
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
        }
    }],
    total_amount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },
    shipping_address: {
        name: String,
        address: String,
        city: String,
        state: String,
        pincode: String,
        phone: String
    }
}, {
    timestamps: true
});

const Order = mongoose.model('Order', orderSchema);

// Generate unique order number
function generateOrderNumber() {
    return 'ORD' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
}

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

// Admin Middleware - FIXED VERSION
const adminAuth = async (req, res, next) => {
    try {
        // First verify the token
        const token = req.header('Authorization')?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
        }
        
        req.userId = decoded.userId;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token is not valid' });
    }
};

// Auth Routes

// Register (with role selection)
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, role = 'customer' } = req.body;

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
        const user = new User({ name, email, password, role });
        await user.save();

        // Generate token
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
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
                email: user.email,
                role: user.role
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

// Get all items for user (admin sees their items, customer sees available items)
app.get('/api/items', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (user.role === 'admin') {
            // Admin sees their own items
            const items = await Item.find({ user: req.userId }).sort({ createdAt: -1 });
            res.json(items);
        } else {
            // Customer sees all available items from all admins
            const items = await Item.find({ 
                is_available: true,
                quantity: { $gt: 0 }
            }).populate('user', 'name email').sort({ createdAt: -1 });
            res.json(items);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get categories
app.get('/api/categories', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (user.role === 'admin') {
            const categories = await Item.distinct('category', { user: req.userId });
            res.json(categories.sort());
        } else {
            const categories = await Item.distinct('category', { 
                is_available: true,
                quantity: { $gt: 0 }
            });
            res.json(categories.sort());
        }
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

        const user = await User.findById(req.userId);
        let item;

        if (user.role === 'admin') {
            item = await Item.findOne({ _id: req.params.id, user: req.userId });
        } else {
            item = await Item.findOne({ 
                _id: req.params.id, 
                is_available: true,
                quantity: { $gt: 0 }
            }).populate('user', 'name email');
        }

        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new item (Admin only)
app.post('/api/items', adminAuth, async (req, res) => {
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

// Update item (Admin only)
app.put('/api/items/:id', adminAuth, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid item ID' });
        }

        const { name, description, category, quantity, price, min_stock, is_available } = req.body;

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
                min_stock: parseInt(min_stock) || 0,
                is_available: is_available !== undefined ? is_available : true
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

// Delete item (Admin only)
app.delete('/api/items/:id', adminAuth, async (req, res) => {
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

// Order Routes

// Create new order (Customer only)
app.post('/api/orders', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (user.role !== 'customer') {
            return res.status(403).json({ error: 'Only customers can place orders' });
        }

        const { items, shipping_address } = req.body;

        // Validation
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Order must contain at least one item' });
        }

        if (!shipping_address || !shipping_address.name || !shipping_address.address) {
            return res.status(400).json({ error: 'Shipping address is required' });
        }

        let total_amount = 0;
        const orderItems = [];

        // Validate each item and calculate total
        for (const orderItem of items) {
            if (!mongoose.Types.ObjectId.isValid(orderItem.item)) {
                return res.status(400).json({ error: 'Invalid item ID' });
            }

            const item = await Item.findOne({ 
                _id: orderItem.item, 
                is_available: true,
                quantity: { $gte: orderItem.quantity }
            });

            if (!item) {
                return res.status(400).json({ 
                    error: `Item "${orderItem.item}" is not available or insufficient quantity` 
                });
            }

            const itemTotal = item.price * orderItem.quantity;
            total_amount += itemTotal;

            orderItems.push({
                item: item._id,
                quantity: orderItem.quantity,
                price: item.price
            });

            // Reduce item quantity
            item.quantity -= orderItem.quantity;
            if (item.quantity === 0) {
                item.is_available = false;
            }
            await item.save();
        }

        // Create order
        const order = new Order({
            order_number: generateOrderNumber(),
            customer: req.userId,
            items: orderItems,
            total_amount: total_amount,
            shipping_address: shipping_address
        });

        await order.save();
        
        // Populate order with item details
        const populatedOrder = await Order.findById(order._id)
            .populate('customer', 'name email')
            .populate('items.item', 'name category');

        res.status(201).json({
            message: 'Order placed successfully',
            order: populatedOrder
        });

    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ error: 'Server error during order creation' });
    }
});

// Get customer's orders
app.get('/api/orders/my-orders', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (user.role !== 'customer') {
            return res.status(403).json({ error: 'Only customers can view their orders' });
        }

        const orders = await Order.find({ customer: req.userId })
            .populate('items.item', 'name category')
            .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all orders (Admin only - for order management)
app.get('/api/orders', adminAuth, async (req, res) => {
    try {
        // Get orders for items belonging to this admin
        const adminItems = await Item.find({ user: req.userId }).select('_id');
        const itemIds = adminItems.map(item => item._id);

        const orders = await Order.find({
            'items.item': { $in: itemIds }
        })
        .populate('customer', 'name email')
        .populate('items.item', 'name category price')
        .sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update order status (Admin only)
app.put('/api/orders/:id/status', adminAuth, async (req, res) => {
    try {
        const { status } = req.body;

        if (!['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        )
        .populate('customer', 'name email')
        .populate('items.item', 'name category');

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({
            message: 'Order status updated successfully',
            order: order
        });
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

// Serve specific pages - FIXED ROUTING
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
});

app.get('/customer.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/customer.html'));
});

// Catch-all handler - must be LAST
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`\n🎉 MyInventory Server Started!`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔐 Authentication: Enabled`);
    console.log(`👥 Multi-role: Admin & Customer`);
    console.log(`🚀 Frontend: http://localhost:${PORT}`);
    console.log(`\n✅ Server is ready!`);
});