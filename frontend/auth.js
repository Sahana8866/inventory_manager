class AuthManager {
    constructor() {
        this.API_BASE = '/api';
        this.init();
    }

    init() {
        this.bindEvents();
        // Don't auto-check auth status on login page
        if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
            this.checkAuthStatus();
        }
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Form submissions
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
    }

    switchTab(tab) {
        // Update active tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        // Show active form
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.toggle('active', form.id === `${tab}Form`);
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        const messageDiv = document.getElementById('loginMessage');
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch(`${this.API_BASE}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error);
            }

            this.showMessage(messageDiv, 'Login successful! Redirecting...', 'success');
            
            // Store token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Redirect to appropriate page based on role
            setTimeout(() => {
                if (data.user.role === 'admin') {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'customer.html';
                }
            }, 1000);

        } catch (error) {
            this.showMessage(messageDiv, error.message, 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const messageDiv = document.getElementById('registerMessage');
        
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const role = document.getElementById('registerRole').value;

        // Validate passwords match
        if (password !== confirmPassword) {
            this.showMessage(messageDiv, 'Passwords do not match', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, password, role })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error);
            }

            this.showMessage(messageDiv, 'Registration successful! Please login.', 'success');
            
            // Clear form and switch to login
            document.getElementById('registerForm').reset();
            setTimeout(() => {
                this.switchTab('login');
                document.getElementById('loginEmail').value = email;
            }, 2000);

        } catch (error) {
            this.showMessage(messageDiv, error.message, 'error');
        }
    }

    checkAuthStatus() {
        const token = localStorage.getItem('token');
        const user = Auth.getUser();
        const currentPage = window.location.pathname;
        
        console.log('Auth check:', { token, user, currentPage });
        
        if (token && user) {
            // User is logged in
            if (currentPage.endsWith('index.html') || currentPage === '/' || currentPage === '') {
                // Redirect away from login page
                if (user.role === 'admin') {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'customer.html';
                }
            }
            // If already on correct page, do nothing
        } else {
            // User is NOT logged in
            if (currentPage.includes('dashboard.html') || currentPage.includes('customer.html')) {
                // Redirect to login if trying to access protected pages
                window.location.href = 'index.html';
            }
            // If already on login page, do nothing
        }
    }

    showMessage(element, message, type) {
        if (element) {
            element.textContent = message;
            element.className = `message ${type}`;
            element.style.display = 'block';
            
            // Auto-hide success messages
            if (type === 'success') {
                setTimeout(() => {
                    element.style.display = 'none';
                }, 3000);
            }
        }
    }
}

// Auth utility functions
class Auth {
    static isLoggedIn() {
        return localStorage.getItem('token') !== null;
    }

    static getToken() {
        return localStorage.getItem('token');
    }

    static getUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    }

    static logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }

    static requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }

    static async makeAuthenticatedRequest(url, options = {}) {
        const token = this.getToken();
        
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
                this.logout();
                throw new Error('Session expired. Please login again.');
            }
            
            return response;
        } catch (error) {
            console.error('Request failed:', error);
            throw error;
        }
    }
}

// Initialize auth manager only on login page
if (document.getElementById('loginForm') || document.getElementById('registerForm')) {
    const authManager = new AuthManager();
}

// Check auth status on all pages EXCEPT login page
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname;
    
    // Only run auth check on protected pages (not login page)
    if (!currentPage.endsWith('index.html') && currentPage !== '/' && currentPage !== '') {
        if (typeof Auth !== 'undefined') {
            // Simple check - if not logged in, redirect to login
            if (!Auth.isLoggedIn()) {
                window.location.href = 'index.html';
                return;
            }
            
            // If logged in, verify we're on the correct page based on role
            const user = Auth.getUser();
            if (user) {
                if (user.role === 'admin' && currentPage.includes('customer.html')) {
                    window.location.href = 'dashboard.html';
                } else if (user.role === 'customer' && currentPage.includes('dashboard.html')) {
                    window.location.href = 'customer.html';
                }
            }
        }
    }
});