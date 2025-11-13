class CustomerApp {
    constructor() {
        this.API_BASE = '/api';
        this.cart = JSON.parse(localStorage.getItem('cart')) || [];
        this.products = [];
        
        this.init();
    }

    init() {
        // Check if we're on customer page
        if (!document.getElementById('productsGrid')) {
            return;
        }

        // Check authentication and role
        if (!Auth.requireAuth()) return;
        
        const user = Auth.getUser();
        if (user.role !== 'customer') {
            window.location.href = 'dashboard.html';
            return;
        }

        this.bindEvents();
        this.loadUserInfo();
        this.loadProducts();
        this.loadCategories();
        this.updateCartDisplay();
    }

    bindEvents() {
        // Navigation
        document.getElementById('viewOrdersBtn').addEventListener('click', () => this.showOrders());
        document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());
        
        // Cart
        document.getElementById('viewCartBtn').addEventListener('click', () => this.showCart());
        document.getElementById('clearCartBtn').addEventListener('click', () => this.clearCart());
        document.getElementById('placeOrderBtn').addEventListener('click', () => this.placeOrder());
        
        // Search and filter
        document.getElementById('searchInput').addEventListener('input', () => this.filterProducts());
        document.getElementById('categoryFilter').addEventListener('change', () => this.filterProducts());
        
        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });
        
        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.classList.add('hidden');
            });
        });
    }

    loadUserInfo() {
        const user = Auth.getUser();
        if (user) {
            document.getElementById('userName').textContent = user.name;
            document.getElementById('userEmail').textContent = user.email;
        }
    }

    async loadProducts() {
        this.showLoading();
        try {
            const response = await Auth.makeAuthenticatedRequest(`${this.API_BASE}/items`);
            
            if (!response.ok) {
                throw new Error(`Failed to load products: ${response.status}`);
            }
            
            this.products = await response.json();
            this.renderProducts(this.products);
        } catch (error) {
            this.showError('Failed to load products: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async loadCategories() {
        try {
            const response = await Auth.makeAuthenticatedRequest(`${this.API_BASE}/categories`);
            if (response.ok) {
                const categories = await response.json();
                this.renderCategories(categories);
            }
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }

    renderProducts(products) {
        const grid = document.getElementById('productsGrid');
        grid.innerHTML = '';

        if (!products || products.length === 0) {
            grid.innerHTML = `
                <div class="no-products">
                    <p>No products available at the moment.</p>
                </div>
            `;
            return;
        }

        products.forEach(product => {
            const productCard = document.createElement('div');
            productCard.className = 'product-card';
            productCard.innerHTML = `
                <div class="product-image">📦</div>
                <div class="product-info">
                    <h3>${this.escapeHtml(product.name)}</h3>
                    <p class="product-desc">${this.escapeHtml(product.description || 'No description')}</p>
                    <p class="product-category">${this.escapeHtml(product.category)}</p>
                    <p class="product-price">₹${product.price.toFixed(2)}</p>
                    <p class="product-stock">In stock: ${product.quantity}</p>
                    <p class="product-seller">Sold by: ${product.user?.name || 'Admin'}</p>
                    <button class="btn btn-primary btn-full view-product" data-id="${product._id}">
                        View Details
                    </button>
                </div>
            `;
            grid.appendChild(productCard);
        });

        // Add event listeners to view buttons
        document.querySelectorAll('.view-product').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const productId = e.target.getAttribute('data-id');
                this.showProductDetails(productId);
            });
        });
    }

    renderCategories(categories) {
        const filter = document.getElementById('categoryFilter');
        filter.innerHTML = '<option value="">All Categories</option>';
        
        categories.forEach(category => {
            filter.innerHTML += `<option value="${this.escapeHtml(category)}">${this.escapeHtml(category)}</option>`;
        });
    }

    filterProducts() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const category = document.getElementById('categoryFilter').value;

        const filteredProducts = this.products.filter(product => {
            const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                                product.description.toLowerCase().includes(searchTerm);
            const matchesCategory = !category || product.category === category;
            return matchesSearch && matchesCategory;
        });

        this.renderProducts(filteredProducts);
    }

    async showProductDetails(productId) {
        try {
            const response = await Auth.makeAuthenticatedRequest(`${this.API_BASE}/items/${productId}`);
            const product = await response.json();

            document.getElementById('productName').textContent = product.name;
            document.getElementById('productDescription').textContent = product.description || 'No description available';
            document.getElementById('productCategory').textContent = product.category;
            document.getElementById('productPrice').textContent = product.price.toFixed(2);
            document.getElementById('productQuantity').textContent = product.quantity;
            document.getElementById('productSeller').textContent = product.user?.name || 'Admin';

            // Set max quantity for order
            document.getElementById('orderQuantity').max = product.quantity;
            document.getElementById('orderQuantity').value = 1;

            // Update add to cart button
            const addToCartBtn = document.getElementById('addToCartBtn');
            addToCartBtn.onclick = () => this.addToCart(product);

            document.getElementById('productModal').classList.remove('hidden');
        } catch (error) {
            this.showError('Failed to load product details: ' + error.message);
        }
    }

    addToCart(product) {
        const quantity = parseInt(document.getElementById('orderQuantity').value);
        
        if (quantity < 1 || quantity > product.quantity) {
            this.showError('Invalid quantity');
            return;
        }

        const existingItemIndex = this.cart.findIndex(item => item._id === product._id);
        
        if (existingItemIndex > -1) {
            // Update existing item quantity
            const newQuantity = this.cart[existingItemIndex].cartQuantity + quantity;
            if (newQuantity > product.quantity) {
                this.showError('Cannot add more than available quantity');
                return;
            }
            this.cart[existingItemIndex].cartQuantity = newQuantity;
        } else {
            // Add new item to cart
            this.cart.push({
                ...product,
                cartQuantity: quantity
            });
        }

        this.saveCart();
        this.updateCartDisplay();
        document.getElementById('productModal').classList.add('hidden');
        this.showSuccess('Product added to cart!');
    }

    showCart() {
        this.renderCartItems();
        document.getElementById('cartModal').classList.remove('hidden');
    }

    renderCartItems() {
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');

        if (this.cart.length === 0) {
            cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
            cartTotal.textContent = '0';
            return;
        }

        let total = 0;
        cartItems.innerHTML = '';

        this.cart.forEach((item, index) => {
            const itemTotal = item.price * item.cartQuantity;
            total += itemTotal;

            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <div class="cart-item-info">
                    <h4>${this.escapeHtml(item.name)}</h4>
                    <p>₹${item.price.toFixed(2)} × ${item.cartQuantity} = ₹${itemTotal.toFixed(2)}</p>
                </div>
                <div class="cart-item-actions">
                    <button class="btn btn-edit update-quantity" data-index="${index}" data-change="-1">-</button>
                    <span>${item.cartQuantity}</span>
                    <button class="btn btn-edit update-quantity" data-index="${index}" data-change="1">+</button>
                    <button class="btn btn-delete remove-item" data-index="${index}">Remove</button>
                </div>
            `;
            cartItems.appendChild(cartItem);
        });

        cartTotal.textContent = total.toFixed(2);

        // Add event listeners
        document.querySelectorAll('.update-quantity').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                const change = parseInt(e.target.getAttribute('data-change'));
                this.updateCartQuantity(index, change);
            });
        });

        document.querySelectorAll('.remove-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                this.removeFromCart(index);
            });
        });
    }

    updateCartQuantity(index, change) {
        const item = this.cart[index];
        const newQuantity = item.cartQuantity + change;

        if (newQuantity < 1) {
            this.removeFromCart(index);
            return;
        }

        if (newQuantity > item.quantity) {
            this.showError('Cannot order more than available quantity');
            return;
        }

        this.cart[index].cartQuantity = newQuantity;
        this.saveCart();
        this.updateCartDisplay();
        this.renderCartItems();
    }

    removeFromCart(index) {
        this.cart.splice(index, 1);
        this.saveCart();
        this.updateCartDisplay();
        this.renderCartItems();
    }

    clearCart() {
        this.cart = [];
        this.saveCart();
        this.updateCartDisplay();
        this.renderCartItems();
        this.showSuccess('Cart cleared!');
    }

    async placeOrder() {
        const shippingForm = document.getElementById('shippingForm');
        const shippingInfo = {
            name: document.getElementById('shippingName').value,
            address: document.getElementById('shippingAddress').value,
            city: document.getElementById('shippingCity').value,
            state: document.getElementById('shippingState').value,
            pincode: document.getElementById('shippingPincode').value,
            phone: document.getElementById('shippingPhone').value
        };

        // Validation
        if (!shippingInfo.name || !shippingInfo.address || !shippingInfo.city || 
            !shippingInfo.state || !shippingInfo.pincode || !shippingInfo.phone) {
            this.showError('Please fill all shipping information fields');
            return;
        }

        if (this.cart.length === 0) {
            this.showError('Your cart is empty');
            return;
        }

        const orderData = {
            items: this.cart.map(item => ({
                item: item._id,
                quantity: item.cartQuantity
            })),
            shipping_address: shippingInfo
        };

        this.showLoading();
        try {
            const response = await Auth.makeAuthenticatedRequest(`${this.API_BASE}/orders`, {
                method: 'POST',
                body: JSON.stringify(orderData)
            });

            if (!response.ok) {
                throw new Error(`Failed to place order: ${response.status}`);
            }

            const result = await response.json();
            this.showSuccess('Order placed successfully! Order #: ' + result.order.order_number);
            
            this.clearCart();
            document.getElementById('cartModal').classList.add('hidden');
            document.getElementById('shippingForm').reset();

        } catch (error) {
            this.showError('Failed to place order: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async showOrders() {
        try {
            const response = await Auth.makeAuthenticatedRequest(`${this.API_BASE}/orders/my-orders`);
            const orders = await response.json();
            this.renderOrders(orders);
            document.getElementById('ordersModal').classList.remove('hidden');
        } catch (error) {
            this.showError('Failed to load orders: ' + error.message);
        }
    }

    renderOrders(orders) {
        const ordersList = document.getElementById('ordersList');

        if (!orders || orders.length === 0) {
            ordersList.innerHTML = '<p class="no-orders">You have no orders yet.</p>';
            return;
        }

        ordersList.innerHTML = orders.map(order => `
            <div class="order-card ${order.status}">
                <div class="order-header">
                    <h4>Order #${order.order_number}</h4>
                    <span class="order-status ${order.status}">${order.status}</span>
                </div>
                <div class="order-details">
                    <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                    <p><strong>Total:</strong> ₹${order.total_amount.toFixed(2)}</p>
                    <p><strong>Items:</strong></p>
                    <ul class="order-items">
                        ${order.items.map(item => `
                            <li>${item.item.name} - ${item.quantity} × ₹${item.price.toFixed(2)}</li>
                        `).join('')}
                    </ul>
                    <p><strong>Shipping Address:</strong></p>
                    <p>${order.shipping_address.name}<br>
                       ${order.shipping_address.address}<br>
                       ${order.shipping_address.city}, ${order.shipping_address.state} - ${order.shipping_address.pincode}<br>
                       Phone: ${order.shipping_address.phone}</p>
                </div>
            </div>
        `).join('');
    }

    updateCartDisplay() {
        document.getElementById('cartCount').textContent = this.cart.reduce((total, item) => total + item.cartQuantity, 0);
    }

    saveCart() {
        localStorage.setItem('cart', JSON.stringify(this.cart));
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message) {
        alert('Error: ' + message);
    }

    showSuccess(message) {
        alert('Success: ' + message);
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize customer app
if (document.getElementById('productsGrid')) {
    const customerApp = new CustomerApp();
}