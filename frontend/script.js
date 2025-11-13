class MyInventory {
    constructor() {
        this.API_BASE = '/api';
        this.currentEditingId = null;
        
        this.init();
    }

    init() {
        // Check if we're on dashboard page
        if (!document.getElementById('itemsTableBody')) {
            return;
        }

        // Check authentication and role
        if (!Auth.requireAuth()) return;
        
        const user = Auth.getUser();
        if (user.role !== 'admin') {
            window.location.href = 'customer.html';
            return;
        }

        this.bindEvents();
        this.loadUserInfo();
        this.loadItems();
        this.loadCategories();
        this.loadOrders();
    }

    bindEvents() {
        // Add item button
        document.getElementById('addItemBtn').addEventListener('click', () => this.showModal());
        
        // Modal events
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.add('hidden');
            });
        });
        
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideModal());
        
        // Form submission
        document.getElementById('itemForm').addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Click outside modal to close
        document.getElementById('itemModal').addEventListener('click', (e) => {
            if (e.target.id === 'itemModal') this.hideModal();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());

        // Tabs
        document.getElementById('inventoryTab').addEventListener('click', () => this.showInventory());
        document.getElementById('ordersTab').addEventListener('click', () => this.showOrders());
    }

    loadUserInfo() {
        const user = Auth.getUser();
        if (user) {
            document.getElementById('userName').textContent = user.name;
            document.getElementById('userEmail').textContent = user.email;
            
            // Show admin badge
            const userEmail = document.getElementById('userEmail');
            userEmail.innerHTML += ' <span class="admin-badge">Admin</span>';
        }
    }

    async loadItems() {
        this.showLoading();
        try {
            const response = await Auth.makeAuthenticatedRequest(`${this.API_BASE}/items`);
            
            if (!response.ok) {
                throw new Error(`Failed to load items: ${response.status}`);
            }
            
            const items = await response.json();
            this.renderItems(items);
            this.updateStats(items);
            this.checkLowStock(items);
        } catch (error) {
            this.showError('Failed to load items: ' + error.message);
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

    async loadOrders() {
        try {
            const response = await Auth.makeAuthenticatedRequest(`${this.API_BASE}/orders`);
            if (response.ok) {
                const orders = await response.json();
                this.renderOrders(orders);
            }
        } catch (error) {
            console.error('Failed to load orders:', error);
        }
    }

    renderItems(items) {
        const tbody = document.getElementById('itemsTableBody');
        tbody.innerHTML = '';

        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: #666; font-style: italic; padding: 3rem;">
                        No items in inventory. Add your first item!
                    </td>
                </tr>
            `;
            return;
        }

        items.forEach(item => {
            const status = this.getStockStatus(item.quantity, item.min_stock);
            const row = document.createElement('tr');
            row.className = status;
            
            row.innerHTML = `
                <td>
                    <strong>${this.escapeHtml(item.name)}</strong>
                    ${item.description ? `<div class="item-desc">${this.escapeHtml(item.description)}</div>` : ''}
                </td>
                <td>${this.escapeHtml(item.category)}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price.toFixed(2)}</td>
                <td>${item.min_stock}</td>
                <td>
                    <span class="status-badge ${status}">
                        ${status.replace('-', ' ')}
                    </span>
                </td>
                <td>
                    <input type="checkbox" class="availability-toggle" ${item.is_available ? 'checked' : ''} 
                           data-id="${item._id}">
                    <label>Available</label>
                </td>
                <td>
                    <button class="btn btn-edit" data-id="${item._id}">
                        Edit
                    </button>
                    <button class="btn btn-delete" data-id="${item._id}">
                        Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Add event listeners to ALL buttons after rendering
        this.bindItemButtons();
    }

    bindItemButtons() {
        // Edit buttons
        document.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-id');
                this.editItem(itemId);
            });
        });

        // Delete buttons
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const itemId = e.target.getAttribute('data-id');
                this.deleteItem(itemId);
            });
        });

        // Availability toggles
        document.querySelectorAll('.availability-toggle').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const itemId = e.target.getAttribute('data-id');
                const isAvailable = e.target.checked;
                this.toggleAvailability(itemId, isAvailable);
            });
        });
    }

    renderCategories(categories) {
        const datalist = document.getElementById('categories');
        datalist.innerHTML = (categories || []).map(cat => 
            `<option value="${this.escapeHtml(cat)}">`
        ).join('');
    }

    renderOrders(orders) {
        const ordersContainer = document.getElementById('ordersContainer');
        const totalOrders = document.getElementById('totalOrders');

        if (!orders || orders.length === 0) {
            ordersContainer.innerHTML = `
                <div class="no-orders">
                    <p>No orders received yet.</p>
                </div>
            `;
            totalOrders.textContent = '0';
            return;
        }

        totalOrders.textContent = orders.length;
        ordersContainer.innerHTML = orders.map(order => `
            <div class="order-card ${order.status}">
                <div class="order-header">
                    <div>
                        <h4>Order #${order.order_number}</h4>
                        <p class="order-customer">Customer: ${order.customer.name} (${order.customer.email})</p>
                        <p class="order-date">Date: ${new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <div class="order-status-section">
                        <span class="order-status ${order.status}">${order.status}</span>
                        <select class="status-select" data-order-id="${order._id}">
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                            <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </div>
                </div>
                <div class="order-details">
                    <div class="order-items">
                        <h5>Order Items:</h5>
                        <ul>
                            ${order.items.map(item => `
                                <li>
                                    ${item.item.name} - 
                                    ${item.quantity} × ₹${item.price.toFixed(2)} = 
                                    ₹${(item.quantity * item.price).toFixed(2)}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                    <div class="order-total">
                        <strong>Total Amount: ₹${order.total_amount.toFixed(2)}</strong>
                    </div>
                    <div class="shipping-info">
                        <h5>Shipping Address:</h5>
                        <p>${order.shipping_address.name}<br>
                           ${order.shipping_address.address}<br>
                           ${order.shipping_address.city}, ${order.shipping_address.state} - ${order.shipping_address.pincode}<br>
                           Phone: ${order.shipping_address.phone}</p>
                    </div>
                </div>
            </div>
        `).join('');

        // Bind order status change events
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const orderId = e.target.getAttribute('data-order-id');
                const status = e.target.value;
                this.updateOrderStatus(orderId, status);
            });
        });
    }

    updateStats(items) {
        const totalItemsEl = document.getElementById('totalItems');
        const lowStockCountEl = document.getElementById('lowStockCount');
        
        totalItemsEl.textContent = items?.length || 0;
        
        const lowStockCount = items ? items.filter(item => 
            item.quantity <= item.min_stock
        ).length : 0;
        
        lowStockCountEl.textContent = lowStockCount;
    }

    checkLowStock(items) {
        const alertSection = document.getElementById('alertSection');
        const alertsContainer = document.getElementById('alertsContainer');

        const lowStockItems = items ? items.filter(item => 
            item.quantity <= item.min_stock
        ) : [];

        if (lowStockItems.length > 0) {
            alertSection.classList.remove('hidden');
            alertsContainer.innerHTML = lowStockItems.map(item => `
                <div class="alert-item">
                    <strong>${this.escapeHtml(item.name)}</strong> - 
                    Only ${item.quantity} left (min: ${item.min_stock})
                </div>
            `).join('');
        } else {
            alertSection.classList.add('hidden');
        }
    }

    getStockStatus(quantity, minStock) {
        if (quantity === 0) return 'out-of-stock';
        if (quantity <= minStock) return 'low-stock';
        return 'in-stock';
    }

    showModal(item = null) {
        this.currentEditingId = item ? item._id : null;
        
        document.getElementById('modalTitle').textContent = 
            item ? 'Edit Item' : 'Add New Item';
        
        if (item) {
            document.getElementById('itemName').value = item.name || '';
            document.getElementById('itemDescription').value = item.description || '';
            document.getElementById('itemCategory').value = item.category || '';
            document.getElementById('itemQuantity').value = item.quantity || 0;
            document.getElementById('itemPrice').value = item.price || 0;
            document.getElementById('itemMinStock').value = item.min_stock || 0;
        } else {
            document.getElementById('itemForm').reset();
        }
        
        document.getElementById('itemModal').classList.remove('hidden');
    }

    hideModal() {
        document.getElementById('itemModal').classList.add('hidden');
        this.currentEditingId = null;
        document.getElementById('itemForm').reset();
    }

    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('itemName').value.trim(),
            description: document.getElementById('itemDescription').value.trim(),
            category: document.getElementById('itemCategory').value.trim(),
            quantity: parseInt(document.getElementById('itemQuantity').value) || 0,
            price: parseFloat(document.getElementById('itemPrice').value) || 0,
            min_stock: parseInt(document.getElementById('itemMinStock').value) || 0
        };

        // Validation
        if (!formData.name || !formData.category || 
            isNaN(formData.quantity) || isNaN(formData.price)) {
            this.showError('Please fill in all required fields');
            return;
        }

        this.showLoading();
        try {
            const url = this.currentEditingId 
                ? `${this.API_BASE}/items/${this.currentEditingId}`
                : `${this.API_BASE}/items`;
            
            const method = this.currentEditingId ? 'PUT' : 'POST';
            
            const response = await Auth.makeAuthenticatedRequest(url, {
                method: method,
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error(`Failed to save item: ${response.status}`);
            }

            const result = await response.json();
            this.showSuccess(result.message || 'Item saved successfully!');
            this.hideModal();
            this.loadItems();
            this.loadCategories();

        } catch (error) {
            this.showError('Failed to save item: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async editItem(id) {
        this.showLoading();
        try {
            const response = await Auth.makeAuthenticatedRequest(`${this.API_BASE}/items/${id}`);
            if (!response.ok) {
                throw new Error(`Failed to load item: ${response.status}`);
            }
            const item = await response.json();
            this.showModal(item);
        } catch (error) {
            this.showError('Failed to load item: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async deleteItem(id) {
        if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            return;
        }

        this.showLoading();
        try {
            const response = await Auth.makeAuthenticatedRequest(`${this.API_BASE}/items/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`Failed to delete item: ${response.status}`);
            }

            const result = await response.json();
            this.showSuccess(result.message || 'Item deleted successfully!');
            this.loadItems();
            this.loadCategories();

        } catch (error) {
            this.showError('Failed to delete item: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async toggleAvailability(itemId, isAvailable) {
        try {
            // First get the current item
            const itemResponse = await Auth.makeAuthenticatedRequest(`${this.API_BASE}/items/${itemId}`);
            if (!itemResponse.ok) {
                throw new Error('Failed to load item for update');
            }
            const currentItem = await itemResponse.json();

            const response = await Auth.makeAuthenticatedRequest(`${this.API_BASE}/items/${itemId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: currentItem.name,
                    description: currentItem.description,
                    category: currentItem.category,
                    quantity: currentItem.quantity,
                    price: currentItem.price,
                    min_stock: currentItem.min_stock,
                    is_available: isAvailable
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to update availability: ${response.status}`);
            }

            this.showSuccess(`Item ${isAvailable ? 'made available' : 'made unavailable'}!`);

        } catch (error) {
            this.showError('Failed to update item availability: ' + error.message);
            this.loadItems(); // Reload to reset toggle state
        }
    }

    async updateOrderStatus(orderId, status) {
        try {
            const response = await Auth.makeAuthenticatedRequest(`${this.API_BASE}/orders/${orderId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });

            if (!response.ok) {
                throw new Error(`Failed to update order status: ${response.status}`);
            }

            const result = await response.json();
            this.showSuccess('Order status updated successfully!');
            this.loadOrders();

        } catch (error) {
            this.showError('Failed to update order status: ' + error.message);
        }
    }

    showInventory() {
        document.getElementById('inventorySection').classList.remove('hidden');
        document.getElementById('ordersSection').classList.add('hidden');
        document.getElementById('inventoryTab').classList.add('active');
        document.getElementById('ordersTab').classList.remove('active');
    }

    showOrders() {
        document.getElementById('inventorySection').classList.add('hidden');
        document.getElementById('ordersSection').classList.remove('hidden');
        document.getElementById('inventoryTab').classList.remove('active');
        document.getElementById('ordersTab').classList.add('active');
        this.loadOrders();
    }

    showLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.remove('hidden');
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.add('hidden');
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

// Initialize the application only if on dashboard page
if (document.getElementById('itemsTableBody')) {
    const inventory = new MyInventory();
}