class MyInventory {
    constructor() {
        this.API_BASE = window.location.hostname === 'localhost' 
            ? 'http://localhost:5000/api' 
            : '/api';
        
        this.currentEditingId = null;
        
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        // Check if we're on dashboard page
        if (!document.getElementById('itemsTableBody')) {
            return;
        }

        // Check if Auth class is available
        if (typeof Auth === 'undefined') {
            console.error('Auth class not found. Make sure auth.js is loaded before script.js');
            this.showError('Authentication system not loaded. Please refresh the page.');
            return;
        }

        // Check authentication
        if (!Auth.requireAuth()) return;

        this.bindEvents();
        this.loadUserInfo();
        this.loadItems();
        this.loadCategories();
    }

    bindEvents() {
        // Add item button
        document.getElementById('addItemBtn').addEventListener('click', () => this.showModal());
        
        // Modal events
        document.querySelector('.close').addEventListener('click', () => this.hideModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.hideModal());
        
        // Form submission
        document.getElementById('itemForm').addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Click outside modal to close
        document.getElementById('itemModal').addEventListener('click', (e) => {
            if (e.target.id === 'itemModal') this.hideModal();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => Auth.logout());
    }

    loadUserInfo() {
        const user = Auth.getUser();
        if (user) {
            document.getElementById('userName').textContent = user.name;
            document.getElementById('userEmail').textContent = user.email;
        }
    }

    async makeAuthenticatedRequest(url, options = {}) {
        const token = Auth.getToken();
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (response.status === 401) {
                // Token expired or invalid
                Auth.logout();
                throw new Error('Session expired. Please login again.');
            }
            
            return response;
        } catch (error) {
            console.error('Request failed:', error);
            throw error;
        }
    }

    async loadItems() {
        this.showLoading();
        try {
            const response = await this.makeAuthenticatedRequest(`${this.API_BASE}/items`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const items = await response.json();
            this.renderItems(items);
            this.updateStats(items);
            this.checkLowStock(items);
        } catch (error) {
            this.showError('Failed to load items: ' + error.message);
            console.error('Load items error:', error);
        } finally {
            this.hideLoading();
        }
    }

    async loadCategories() {
        try {
            const response = await this.makeAuthenticatedRequest(`${this.API_BASE}/categories`);
            if (response.ok) {
                const categories = await response.json();
                this.renderCategories(categories);
            }
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    }

    renderItems(items) {
        const tbody = document.getElementById('itemsTableBody');
        tbody.innerHTML = '';

        if (!items || items.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: #666; font-style: italic; padding: 3rem;">
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
                <td>$${item.price.toFixed(2)}</td>
                <td>${item.min_stock}</td>
                <td>
                    <span class="status-badge ${status}">
                        ${status.replace('-', ' ')}
                    </span>
                </td>
                <td>
                    <button class="btn btn-edit" onclick="inventory.editItem('${item._id}')">
                        Edit
                    </button>
                    <button class="btn btn-delete" onclick="inventory.deleteItem('${item._id}')">
                        Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    renderCategories(categories) {
        const datalist = document.getElementById('categories');
        datalist.innerHTML = (categories || []).map(cat => 
            `<option value="${this.escapeHtml(cat)}">`
        ).join('');
    }

    updateStats(items) {
        document.getElementById('totalItems').textContent = items?.length || 0;
        
        const lowStockCount = items ? items.filter(item => 
            item.quantity <= item.min_stock
        ).length : 0;
        
        document.getElementById('lowStockCount').textContent = lowStockCount;
    }

    checkLowStock(items) {
        const lowStockItems = items ? items.filter(item => 
            item.quantity <= item.min_stock
        ) : [];

        const alertSection = document.getElementById('alertSection');
        const alertsContainer = document.getElementById('alertsContainer');

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
        
        // Fill form if editing
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
            
            const response = await this.makeAuthenticatedRequest(url, {
                method: method,
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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
            const response = await this.makeAuthenticatedRequest(`${this.API_BASE}/items/${id}`);
            const item = await response.json();
            this.showModal(item);
        } catch (error) {
            this.showError('Failed to load item: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async deleteItem(id) {
        if (!confirm('Are you sure you want to delete this item?')) {
            return;
        }

        this.showLoading();
        try {
            const response = await this.makeAuthenticatedRequest(`${this.API_BASE}/items/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
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

// Initialize the application only if on dashboard page
if (document.getElementById('itemsTableBody')) {
    const inventory = new MyInventory();
}