// Socket connection
let socket;

function initializeSocket() {
    if (socket) {
        socket.disconnect(); // Close existing connection
    }

    socket = io('http://localhost:3000', {
        auth: { token: localStorage.getItem('token') }
    });

    // Connection events
    socket.on('connect', () => {
        console.log('Socket connected');
        socket.emit('getOrderBook', 'BTCUSDT');
    });

    socket.on('disconnect', () => {
        console.log('Socket disconnected');
    });

    socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
    });

    // Order book updates
    socket.on('orderBookUpdate', (data) => {
        console.log('Received order book update:', data);
        updateOrderBook(data);
    });
}

// Order book update function
function updateOrderBook(data) {
    if (!data) {
        console.error('Invalid order book data');
        return;
    }

    const asksElement = document.getElementById('asks');
    const bidsElement = document.getElementById('bids');
    const currentPriceElement = document.getElementById('currentPrice');

    // Update sell orders (asks)
    if (Array.isArray(data.asks)) {
        const asksHtml = data.asks
            .map(ask => `
                <div class="grid grid-cols-3 gap-2 text-sm py-1 hover:bg-gray-700">
                    <div class="text-red-500 text-right">${Number(ask.price).toFixed(2)}</div>
                    <div class="text-right">${Number(ask.amount).toFixed(8)}</div>
                    <div class="text-right">${(Number(ask.price) * Number(ask.amount)).toFixed(2)}</div>
                </div>
            `)
            .join('');
        asksElement.innerHTML = asksHtml || '<div class="text-center py-2">No asks</div>';
    }

    // Update buy orders (bids)
    if (Array.isArray(data.bids)) {
        const bidsHtml = data.bids
            .map(bid => `
                <div class="grid grid-cols-3 gap-2 text-sm py-1 hover:bg-gray-700">
                    <div class="text-green-500 text-right">${Number(bid.price).toFixed(2)}</div>
                    <div class="text-right">${Number(bid.amount).toFixed(8)}</div>
                    <div class="text-right">${(Number(bid.price) * Number(bid.amount)).toFixed(2)}</div>
                </div>
            `)
            .join('');
        bidsElement.innerHTML = bidsHtml || '<div class="text-center py-2">No bids</div>';
    }

    // Update current price
    if (data.currentPrice) {
        currentPriceElement.textContent = `$${Number(data.currentPrice).toFixed(2)}`;
    }
}

// Buy order submit
async function submitBuyOrder(event) {
    event.preventDefault();
    if (!socket?.connected) {
        showNotification('Socket not connected', 'error');
        return;
    }

    const form = event.target;
    const price = form.price.value;
    const amount = form.amount.value;

    try {
        socket.emit('newOrder', {
            pair: 'BTCUSDT',
            type: 'buy',
            price: Number(price),
            amount: Number(amount)
        });

        form.reset();
        showNotification('Buy order placed successfully', 'success');
    } catch (error) {
        console.error('Buy order error:', error);
        showNotification('Failed to place buy order', 'error');
    }
}

// Sell order submit
async function submitSellOrder(event) {
    event.preventDefault();
    if (!socket?.connected) {
        showNotification('Socket not connected', 'error');
        return;
    }

    const form = event.target;
    const price = form.price.value;
    const amount = form.amount.value;

    try {
        socket.emit('newOrder', {
            pair: 'BTCUSDT',
            type: 'sell',
            price: Number(price),
            amount: Number(amount)
        });

        form.reset();
        showNotification('Sell order placed successfully', 'success');
    } catch (error) {
        console.error('Sell order error:', error);
        showNotification('Failed to place sell order', 'error');
    }
}

// Notification helper
function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `p-4 rounded-lg mb-2 ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    notification.textContent = message;
    
    container.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Login sonrası socket'i başlat
function updateUIAfterAuth() {
    const token = localStorage.getItem('token');
    const userEmail = localStorage.getItem('userEmail');
    const authButtons = document.getElementById('authButtons');
    const userInfo = document.getElementById('userInfo');
    const userEmailSpan = document.getElementById('userEmail');

    if (token && userEmail) {
        authButtons.style.display = 'none';
        userInfo.style.display = 'flex';
        userEmailSpan.textContent = userEmail;
        initializeSocket(); // Socket bağlantısını başlat
    } else {
        authButtons.style.display = 'flex';
        userInfo.style.display = 'none';
        userEmailSpan.textContent = '';
        if (socket) {
            socket.disconnect(); // Socket bağlantısını kapat
        }
    }
}

// Modal operations
function showLoginForm() {
    const modal = document.getElementById('loginModal');
    modal.style.display = 'flex';
}

function hideLoginForm() {
    const modal = document.getElementById('loginModal');
    modal.style.display = 'none';
}

function showRegisterForm() {
    const modal = document.getElementById('registerModal');
    modal.style.display = 'flex';
}

function hideRegisterForm() {
    const modal = document.getElementById('registerModal');
    modal.style.display = 'none';
}

// Login
async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value;
    const password = form.password.value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('userEmail', email);
            updateUIAfterAuth();
            hideLoginForm();
            socket.auth = { token: data.token };
            socket.connect();
            showNotification('Login successful', 'success');
        } else {
            showNotification(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Login failed: ' + error.message, 'error');
    }
}

// Register
async function handleRegister(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value;
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;

    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (response.ok) {
            showNotification('Registration successful! Please login.', 'success');
            hideRegisterForm();
            showLoginForm();
        } else {
            showNotification(data.message || 'Registration failed', 'error');
        }
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('An error occurred during registration', 'error');
    }
}

// Logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    updateUIAfterAuth();
    socket.disconnect();
    showNotification('Logged out successfully', 'success');
}

// When the page loads, update the UI and initialize the socket
document.addEventListener('DOMContentLoaded', () => {
    updateUIAfterAuth();
    if (localStorage.getItem('token')) {
        initializeSocket();
    }
});