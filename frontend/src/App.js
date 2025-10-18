import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// ✅ FIXED API URL - Always use localhost
// const API_BASE = 'http://localhost:5000/api';

// Smart API URL detection
const getApiBase = () => {
  // In production, API is on same domain
  if (process.env.NODE_ENV === 'production') {
    return '/api';
  }
  // In development, use localhost
  return 'http://localhost:5000/api';
};

const API_BASE = getApiBase();

function App() {
  const [items, setItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    quantity: 0,
    price: 0,
    min_stock: 0
  });

  useEffect(() => {
    console.log('🔄 App loaded, fetching data from:', API_BASE);
    fetchItems();
    fetchLowStockItems();
    fetchCategories();
  }, []);

  const fetchItems = async () => {
    try {
      console.log('📋 Fetching items...');
      const response = await axios.get(`${API_BASE}/items`);
      console.log('✅ Items fetched:', response.data.length);
      setItems(response.data);
    } catch (error) {
      console.error('❌ Error fetching items:', error);
      alert('Cannot connect to backend. Make sure backend is running on port 5000!');
    }
  };

  const fetchLowStockItems = async () => {
    try {
      const response = await axios.get(`${API_BASE}/items/low-stock`);
      setLowStockItems(response.data);
    } catch (error) {
      console.error('Error fetching low stock items:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_BASE}/categories`);
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // ✅ FIXED SUBMIT FUNCTION
  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('🔄 Submitting form:', formData);
    
    try {
      if (editingItem) {
        console.log('📝 Updating item:', editingItem.id);
        await axios.put(`${API_BASE}/items/${editingItem.id}`, formData);
        alert('✅ Item updated successfully!');
      } else {
        console.log('🆕 Creating new item');
        const response = await axios.post(`${API_BASE}/items`, formData);
        console.log('✅ Create response:', response.data);
        alert('✅ Item added successfully!');
      }
      
      resetForm();
      fetchItems();
      fetchLowStockItems();
      fetchCategories();
      
    } catch (error) {
      console.error('❌ Error saving item:', error);
      console.error('🔍 Error details:', error.response?.data);
      
      if (error.response?.data?.error) {
        alert(`Error: ${error.response.data.error}`);
      } else if (error.code === 'NETWORK_ERROR') {
        alert('Cannot connect to server. Make sure backend is running!');
      } else {
        alert('Error saving item. Check console for details.');
      }
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category,
      quantity: item.quantity,
      price: item.price,
      min_stock: item.min_stock
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await axios.delete(`${API_BASE}/items/${id}`);
        alert('✅ Item deleted successfully!');
        fetchItems();
        fetchLowStockItems();
      } catch (error) {
        console.error('Error deleting item:', error);
        alert('Error deleting item.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      quantity: 0,
      price: 0,
      min_stock: 0
    });
    setEditingItem(null);
    setShowForm(false);
  };

  const getStockStatus = (quantity, minStock) => {
    if (quantity === 0) return 'out-of-stock';
    if (quantity <= minStock) return 'low-stock';
    return 'in-stock';
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📦 Mini Inventory Manager</h1>
        <p>Lightweight inventory management system</p>
        <small>API: {API_BASE}</small>
      </header>

      <div className="container">
        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <div className="alert-section">
            <h2>⚠️ Low Stock Alerts</h2>
            <div className="alert-grid">
              {lowStockItems.map(item => (
                <div key={item.id} className="alert-item">
                  <strong>{item.name}</strong> - Only {item.quantity} left (min: {item.min_stock})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="controls">
          <button 
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
          >
            + Add New Item
          </button>
          <div className="stats">
            Total Items: {items.length} | 
            Low Stock: {lowStockItems.length}
          </div>
        </div>

        {/* Item Form */}
        {showForm && (
          <div className="form-overlay">
            <div className="form-container">
              <h2>{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
              
              {/* DEBUG INFO */}
              <div style={{background: '#f0f8ff', padding: '10px', marginBottom: '15px', borderRadius: '5px', fontSize: '12px'}}>
                <strong>Debug Info:</strong><br/>
                API: {API_BASE}<br/>
                Form Data: {JSON.stringify(formData)}
              </div>
              
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    placeholder="Enter item name"
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Enter description (optional)"
                  />
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    required
                    placeholder="Enter category"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Quantity *</label>
                    <input
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
                      required
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label>Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                      required
                      min="0"
                    />
                  </div>

                  <div className="form-group">
                    <label>Min Stock</label>
                    <input
                      type="number"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({...formData, min_stock: parseInt(e.target.value) || 0})}
                      min="0"
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    {editingItem ? 'Update' : 'Create'} Item
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={resetForm}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Items Table */}
        <div className="items-section">
          <h2>Inventory Items ({items.length})</h2>
          {items.length === 0 ? (
            <p className="no-items">No items in inventory. Add your first item!</p>
          ) : (
            <div className="table-container">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Min Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className={getStockStatus(item.quantity, item.min_stock)}>
                      <td>
                        <strong>{item.name}</strong>
                        {item.description && <div className="item-desc">{item.description}</div>}
                      </td>
                      <td>{item.category}</td>
                      <td>{item.quantity}</td>
                      <td>${item.price.toFixed(2)}</td>
                      <td>{item.min_stock}</td>
                      <td>
                        <span className={`status-badge ${getStockStatus(item.quantity, item.min_stock)}`}>
                          {getStockStatus(item.quantity, item.min_stock).replace('-', ' ')}
                        </span>
                      </td>
                      <td>
                        <button 
                          className="btn btn-sm btn-edit"
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-sm btn-delete"
                          onClick={() => handleDelete(item.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;