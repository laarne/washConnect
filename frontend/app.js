const API_BASE = 'http://localhost:3000/api';

// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        switchSection(section);
    });
});

function switchSection(sectionName) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`${sectionName}-section`).classList.add('active');
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    
    if (sectionName === 'dashboard') {
        loadDashboard();
    } else if (sectionName === 'orders') {
        loadOrders();
    } else if (sectionName === 'customers') {
        loadCustomers();
    } else if (sectionName === 'summary') {
        loadSummary();
    } else if (sectionName === 'reports') {
        loadReports();
    } else if (sectionName === 'notifications') {
        loadNotifications();
    }
}

// Order Management
const orderForm = document.getElementById('order-form');
const cancelEditBtn = document.getElementById('cancel-edit');
let editingOrderId = null;

// Pricing: 6kg minimum, 160 pesos per load
// Additional kgs over 6kg: +20 pesos per kg
// Maximum: 8kg
const MIN_WEIGHT = 6;
const MAX_WEIGHT = 8;
const BASE_PRICE = 160;
const ADDITIONAL_KG_PRICE = 20;

// Helper function to display add-ons
function getAddonDisplay(order) {
    const fabconQty = order.fabconQuantity || (order.addFabcon ? 1 : 0);
    const powderQty = order.powderQuantity || (order.addPowder ? 1 : 0);
    
    let addons = [];
    if (fabconQty > 0) {
        addons.push(`Fabcon: ${fabconQty}`);
    }
    if (powderQty > 0) {
        addons.push(`Powder: ${powderQty}`);
    }
    
    return addons.length > 0 ? ' (' + addons.join(', ') + ')' : '';
}

// Calculate price on weight change
document.getElementById('weight').addEventListener('input', calculatePrice);
document.getElementById('serviceType').addEventListener('change', function() {
    toggleWashAddons();
    calculatePrice();
});

// Add event listeners for add-ons quantity dropdowns
const fabconQuantity = document.getElementById('fabconQuantity');
const powderQuantity = document.getElementById('powderQuantity');
if (fabconQuantity) {
    fabconQuantity.addEventListener('change', calculatePrice);
}
if (powderQuantity) {
    powderQuantity.addEventListener('change', calculatePrice);
}

// Also add listeners when DOM is ready (in case elements load later)
document.addEventListener('DOMContentLoaded', function() {
    const fabconQty = document.getElementById('fabconQuantity');
    const powderQty = document.getElementById('powderQuantity');
    
    if (fabconQty && !fabconQty.hasAttribute('data-listener-added')) {
        fabconQty.addEventListener('change', calculatePrice);
        fabconQty.setAttribute('data-listener-added', 'true');
    }
    if (powderQty && !powderQty.hasAttribute('data-listener-added')) {
        powderQty.addEventListener('change', calculatePrice);
        powderQty.setAttribute('data-listener-added', 'true');
    }
});

function toggleWashAddons() {
    const serviceType = document.getElementById('serviceType').value;
    const washAddons = document.getElementById('wash-addons');
    if (washAddons) {
        if (serviceType === 'wash') {
            washAddons.style.display = 'block';
        } else {
            washAddons.style.display = 'none';
            const fabconQty = document.getElementById('fabconQuantity');
            const powderQty = document.getElementById('powderQuantity');
            if (fabconQty) fabconQty.value = '0';
            if (powderQty) powderQty.value = '0';
        }
    }
}

function calculatePrice() {
    const weight = parseFloat(document.getElementById('weight').value) || 0;
    const serviceType = document.getElementById('serviceType').value;
    
    // Calculate base price + additional kg charges
    let price = BASE_PRICE;
    let additionalKgs = 0;
    let additionalKgPrice = 0;
    
    if (weight > MIN_WEIGHT) {
        additionalKgs = weight - MIN_WEIGHT;
        additionalKgPrice = additionalKgs * ADDITIONAL_KG_PRICE;
        price += additionalKgPrice;
    }
    
    let addonTotal = 0;
    let addonDetails = [];
    
    // Add additional charges for wash service add-ons based on quantity
    if (serviceType === 'wash') {
        const fabconQty = parseInt(document.getElementById('fabconQuantity')?.value || 0);
        const powderQty = parseInt(document.getElementById('powderQuantity')?.value || 0);
        
        if (fabconQty > 0) {
            const fabconPrice = fabconQty * 10;
            price += fabconPrice;
            addonTotal += fabconPrice;
            addonDetails.push(`Fabcon: ${fabconQty} × ₱10 = ₱${fabconPrice.toFixed(2)}`);
        }
        
        if (powderQty > 0) {
            const powderPrice = powderQty * 10;
            price += powderPrice;
            addonTotal += powderPrice;
            addonDetails.push(`Powder: ${powderQty} × ₱10 = ₱${powderPrice.toFixed(2)}`);
        }
    }
    
    // Store the calculated price for use in form submission
    document.getElementById('price-display').dataset.calculatedPrice = price.toFixed(2);
    
    if (weight < MIN_WEIGHT) {
        document.getElementById('price-display').value = `₱${price.toFixed(2)} (minimum ${MIN_WEIGHT}kg)${addonTotal > 0 ? ' + ₱' + addonTotal.toFixed(2) + ' add-ons' : ''}`;
    } else if (weight > MAX_WEIGHT) {
        document.getElementById('price-display').value = `Maximum weight is ${MAX_WEIGHT}kg`;
    } else {
        let priceText = `₱${price.toFixed(2)}`;
        let breakdown = [];
        
        breakdown.push(`Base (6kg): ₱${BASE_PRICE.toFixed(2)}`);
        
        if (additionalKgs > 0) {
            breakdown.push(`+ ${additionalKgs}kg × ₱${ADDITIONAL_KG_PRICE} = ₱${additionalKgPrice.toFixed(2)}`);
        }
        
        if (addonTotal > 0) {
            breakdown.push(`+ Add-ons: ₱${addonTotal.toFixed(2)}`);
        }
        
        priceText += ` (${breakdown.join(', ')})`;
        document.getElementById('price-display').value = priceText;
    }
    
    return price;
}

orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const weight = parseFloat(document.getElementById('weight').value);
    if (weight < MIN_WEIGHT) {
        alert(`Minimum weight is ${MIN_WEIGHT}kg`);
        return;
    }
    if (weight > MAX_WEIGHT) {
        alert(`Maximum weight is ${MAX_WEIGHT}kg`);
        return;
    }
    
    // Calculate price using the same function to ensure consistency
    const finalPrice = calculatePrice();
    
    // Validate price
    if (isNaN(finalPrice) || finalPrice <= 0) {
        alert('Invalid price calculation. Please check your inputs.');
        return;
    }
    
    const fabconQty = parseInt(document.getElementById('fabconQuantity')?.value || 0) || 0;
    const powderQty = parseInt(document.getElementById('powderQuantity')?.value || 0) || 0;
    
    const orderData = {
        customerName: document.getElementById('customerName').value,
        contact: document.getElementById('contact').value,
        email: document.getElementById('email').value,
        address: document.getElementById('address').value,
        weight: document.getElementById('weight').value,
        serviceType: document.getElementById('serviceType').value,
        fabconQuantity: fabconQty,
        powderQuantity: powderQty,
        addFabcon: fabconQty > 0, // Keep for backward compatibility
        addPowder: powderQty > 0,  // Keep for backward compatibility
        notes: document.getElementById('notes').value,
        paymentStatus: document.getElementById('paymentStatus').value,
        paymentMethod: document.getElementById('paymentMethod').value,
        paymentDate: document.getElementById('paymentDate').value || null,
        price: finalPrice
    };

    try {
        let response;
        if (editingOrderId) {
            // Update existing order
            response = await fetch(`${API_BASE}/orders/${editingOrderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
        } else {
            // Create new order
            response = await fetch(`${API_BASE}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
        }
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        orderForm.reset();
        document.getElementById('price-display').value = '';
        document.getElementById('wash-addons').style.display = 'none';
        if (document.getElementById('fabconQuantity')) document.getElementById('fabconQuantity').value = '0';
        if (document.getElementById('powderQuantity')) document.getElementById('powderQuantity').value = '0';
        editingOrderId = null;
        cancelEditBtn.style.display = 'none';
        if (document.getElementById('dashboard-section').classList.contains('active')) {
            loadDashboard();
        } else {
            loadOrders();
        }
    } catch (error) {
        console.error('Error saving order:', error);
        alert(`Error saving order: ${error.message}`);
    }
});

cancelEditBtn.addEventListener('click', () => {
    orderForm.reset();
    document.getElementById('price-display').value = '';
    editingOrderId = null;
    cancelEditBtn.style.display = 'none';
});

async function loadOrders() {
    try {
        const response = await fetch(`${API_BASE}/orders`);
        const orders = await response.json();
        displayOrders(orders);
    } catch (error) {
        console.error('Error loading orders:', error);
    }
}

function displayOrders(orders) {
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = '';

    orders.forEach(order => {
        const tr = document.createElement('tr');
        const orderDate = new Date(order.createdAt).toLocaleDateString();
        const paymentBadge = order.paymentStatus === 'paid' ? 
            '<span style="color: green; font-weight: bold;">Paid</span>' : 
            '<span style="color: red; font-weight: bold;">Unpaid</span>';
        
        tr.innerHTML = `
            <td>${order.id}</td>
            <td>${order.customerName}</td>
            <td>${order.contact || '-'}</td>
            <td>${order.weight} kg</td>
            <td>${order.serviceType}${getAddonDisplay(order)}</td>
            <td>₱${order.price.toFixed(2)}</td>
            <td>
                <select class="status-select" data-order-id="${order.id}" data-current-status="${order.status}">
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="washing" ${order.status === 'washing' ? 'selected' : ''}>Washing</option>
                    <option value="drying" ${order.status === 'drying' ? 'selected' : ''}>Drying</option>
                    <option value="folded" ${order.status === 'folded' ? 'selected' : ''}>Folded</option>
                    <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="claimed" ${order.status === 'claimed' ? 'selected' : ''}>Claimed</option>
                </select>
            </td>
            <td>${paymentBadge}</td>
            <td>${orderDate}</td>
            <td>
                <button class="secondary" onclick="editOrder('${order.id}')">Edit</button>
                <button class="danger" onclick="deleteOrder('${order.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Add event listeners for status changes
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const orderId = e.target.dataset.orderId;
            const newStatus = e.target.value;
            try {
                await fetch(`${API_BASE}/orders/${orderId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });
                loadOrders();
            } catch (error) {
                console.error('Error updating status:', error);
                alert('Error updating status');
            }
        });
    });
}

async function editOrder(id) {
    try {
        const response = await fetch(`${API_BASE}/orders/${id}`);
        const order = await response.json();
        
        document.getElementById('customerName').value = order.customerName;
        document.getElementById('contact').value = order.contact || '';
        document.getElementById('email').value = order.email || '';
        document.getElementById('address').value = order.address || '';
        document.getElementById('weight').value = order.weight;
        document.getElementById('serviceType').value = order.serviceType;
        
        // Set add-on quantities (support both old boolean and new quantity format)
        const fabconQty = order.fabconQuantity || (order.addFabcon ? 1 : 0);
        const powderQty = order.powderQuantity || (order.addPowder ? 1 : 0);
        
        if (document.getElementById('fabconQuantity')) {
            document.getElementById('fabconQuantity').value = fabconQty;
        }
        if (document.getElementById('powderQuantity')) {
            document.getElementById('powderQuantity').value = powderQty;
        }
        
        document.getElementById('notes').value = order.notes || '';
        document.getElementById('paymentStatus').value = order.paymentStatus || 'unpaid';
        document.getElementById('paymentMethod').value = order.paymentMethod || '';
        document.getElementById('paymentDate').value = order.paymentDate ? order.paymentDate.split('T')[0] : '';
        
        toggleWashAddons();
        calculatePrice();
        
        editingOrderId = id;
        cancelEditBtn.style.display = 'inline-block';
        orderForm.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error loading order:', error);
        alert('Error loading order');
    }
}

async function deleteOrder(id) {
    if (!confirm('Are you sure you want to delete this order?')) {
        return;
    }
    
    try {
        await fetch(`${API_BASE}/orders/${id}`, {
            method: 'DELETE'
        });
        loadOrders();
    } catch (error) {
        console.error('Error deleting order:', error);
        alert('Error deleting order');
    }
}

// Customer Management
async function loadCustomers() {
    try {
        const response = await fetch(`${API_BASE}/customers`);
        const customers = await response.json();
        
        // Get all orders to count per customer
        const ordersResponse = await fetch(`${API_BASE}/orders`);
        const orders = await ordersResponse.json();
        
        // Count orders per customer
        const customerOrderCounts = {};
        orders.forEach(order => {
            customerOrderCounts[order.customerName] = (customerOrderCounts[order.customerName] || 0) + 1;
        });
        
        displayCustomers(customers, customerOrderCounts);
    } catch (error) {
        console.error('Error loading customers:', error);
    }
}

async function displayCustomers(customers, orderCounts) {
    const tbody = document.getElementById('customers-tbody');
    tbody.innerHTML = '';

    // Get unique customers from orders if not in customers.json
    const allCustomerNames = new Set();
    customers.forEach(c => allCustomerNames.add(c.name));
    
    // Add customers from orders
    const ordersResponse = await fetch(`${API_BASE}/orders`);
    const orders = await ordersResponse.json();
    orders.forEach(order => allCustomerNames.add(order.customerName));
    
    allCustomerNames.forEach(name => {
        const customer = customers.find(c => c.name === name) || { name, contact: '' };
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${customer.name}</td>
            <td>${customer.contact || '-'}</td>
            <td>${orderCounts[customer.name] || 0}</td>
            <td>
                <button class="secondary" onclick="viewCustomerHistory('${encodeURIComponent(customer.name)}')">View History</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function viewCustomerHistory(customerName) {
    try {
        const response = await fetch(`${API_BASE}/customers/${customerName}`);
        const data = await response.json();
        
        document.getElementById('customers-table').style.display = 'none';
        document.getElementById('customer-history').style.display = 'block';
        
        const tbody = document.getElementById('history-tbody');
        tbody.innerHTML = '';
        
        if (data.orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6">No orders found</td></tr>';
        } else {
            data.orders.forEach(order => {
                const tr = document.createElement('tr');
                const date = new Date(order.createdAt).toLocaleDateString();
                tr.innerHTML = `
                    <td>${order.id}</td>
                    <td>${order.weight} kg</td>
                    <td>${order.serviceType}${getAddonDisplay(order)}</td>
                    <td>₱${order.price.toFixed(2)}</td>
                    <td>${order.status}</td>
                    <td>${date}</td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (error) {
        console.error('Error loading customer history:', error);
        alert('Error loading customer history');
    }
}

document.getElementById('back-to-customers').addEventListener('click', () => {
    document.getElementById('customers-table').style.display = 'table';
    document.getElementById('customer-history').style.display = 'none';
    loadCustomers();
});

// Sales Summary
async function loadSummary() {
    try {
        const response = await fetch(`${API_BASE}/orders/summary/today`);
        const summary = await response.json();
        
        document.getElementById('total-sales').textContent = `₱${summary.totalSales.toFixed(2)}`;
        document.getElementById('total-orders').textContent = summary.totalOrders;
        document.getElementById('completed-orders').textContent = summary.completedOrders;
        document.getElementById('paid-orders').textContent = summary.paidOrders || 0;
        document.getElementById('unpaid-orders').textContent = summary.unpaidOrders || 0;
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

// Dashboard
async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE}/orders`);
        const orders = await response.json();
        
        const activeOrders = orders.filter(o => 
            ['pending', 'washing', 'drying', 'folded'].includes(o.status)
        );
        const unpaidOrders = orders.filter(o => o.paymentStatus === 'unpaid');
        const inProgress = orders.filter(o => 
            ['washing', 'drying'].includes(o.status)
        );
        const ready = orders.filter(o => o.status === 'completed' || o.status === 'folded');
        
        document.getElementById('active-orders-count').textContent = activeOrders.length;
        document.getElementById('unpaid-orders-count').textContent = unpaidOrders.length;
        document.getElementById('in-progress-count').textContent = inProgress.length;
        document.getElementById('ready-count').textContent = ready.length;
        
        displayDashboardOrders(activeOrders);
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

function displayDashboardOrders(orders) {
    const tbody = document.getElementById('dashboard-tbody');
    tbody.innerHTML = '';
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No active orders</td></tr>';
        return;
    }
    
    orders.forEach(order => {
        const tr = document.createElement('tr');
        const progress = getProgressPercentage(order.status);
        const paymentBadge = order.paymentStatus === 'paid' ? 
            '<span style="color: green; font-weight: bold;">✓ Paid</span>' : 
            '<span style="color: red; font-weight: bold;">✗ Unpaid</span>';
        
        tr.innerHTML = `
            <td>${order.id}</td>
            <td>${order.customerName}</td>
            <td>${order.serviceType}${getAddonDisplay(order)}</td>
            <td>${order.status}</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <small>${progress}%</small>
            </td>
            <td>${paymentBadge}</td>
            <td>
                <button class="secondary" onclick="editOrder('${order.id}')">View</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getProgressPercentage(status) {
    const progressMap = {
        'pending': 10,
        'washing': 30,
        'drying': 60,
        'folded': 80,
        'completed': 100,
        'claimed': 100
    };
    return progressMap[status] || 0;
}

// Reports
async function loadReports() {
    // Initialize report form
    const reportForm = document.getElementById('report-form');
    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await generateReport();
        });
    }
    
    const exportBtn = document.getElementById('export-report');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportReport);
    }
}

async function generateReport() {
    try {
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        
        let url = `${API_BASE}/orders/summary/report`;
        if (startDate && endDate) {
            url += `?startDate=${startDate}&endDate=${endDate}`;
        }
        
        const response = await fetch(url);
        const report = await response.json();
        
        // Display summary cards
        const summaryDiv = document.getElementById('report-summary');
        summaryDiv.innerHTML = `
            <div class="summary-card">
                <h3>Total Sales</h3>
                <p class="summary-value">₱${report.totalSales.toFixed(2)}</p>
            </div>
            <div class="summary-card">
                <h3>Total Orders</h3>
                <p class="summary-value">${report.totalOrders}</p>
            </div>
            <div class="summary-card">
                <h3>Active Orders</h3>
                <p class="summary-value">${report.activeOrders}</p>
            </div>
            <div class="summary-card">
                <h3>Completed</h3>
                <p class="summary-value">${report.completedOrders}</p>
            </div>
            <div class="summary-card">
                <h3>Paid</h3>
                <p class="summary-value">${report.paidOrders}</p>
            </div>
            <div class="summary-card">
                <h3>Unpaid</h3>
                <p class="summary-value">${report.unpaidOrders}</p>
            </div>
        `;
        
        // Display report table
        const tbody = document.getElementById('report-tbody');
        tbody.innerHTML = '';
        
        report.orders.forEach(order => {
            const tr = document.createElement('tr');
            const date = new Date(order.createdAt).toLocaleDateString();
            tr.innerHTML = `
                <td>${order.id}</td>
                <td>${order.customerName}</td>
                <td>${date}</td>
                <td>${order.serviceType}${getAddonDisplay(order)}</td>
                <td>${order.weight} kg</td>
                <td>₱${order.price.toFixed(2)}</td>
                <td>${order.status}</td>
                <td>${order.paymentStatus}</td>
            `;
            tbody.appendChild(tr);
        });
        
        document.getElementById('report-results').style.display = 'block';
    } catch (error) {
        console.error('Error generating report:', error);
        alert('Error generating report');
    }
}

function exportReport() {
    const tbody = document.getElementById('report-tbody');
    if (!tbody || tbody.children.length === 0) {
        alert('Please generate a report first');
        return;
    }
    
    let csv = 'Order ID,Customer,Date,Service,Weight,Price,Status,Payment\n';
    Array.from(tbody.children).forEach(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length > 0) {
            csv += Array.from(cells).map(cell => `"${cell.textContent.trim()}"`).join(',') + '\n';
        }
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// Notifications
async function loadNotifications() {
    // Load orders for notification dropdown
    try {
        const response = await fetch(`${API_BASE}/orders`);
        const orders = await response.json();
        
        const select = document.getElementById('notificationOrder');
        select.innerHTML = '<option value="">Select an order...</option>';
        orders.forEach(order => {
            const option = document.createElement('option');
            option.value = order.id;
            option.textContent = `${order.id} - ${order.customerName} (${order.status})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading orders for notifications:', error);
    }
    
    // Auto-generate message based on order status
    document.getElementById('notificationOrder').addEventListener('change', (e) => {
        const orderId = e.target.value;
        if (orderId) {
            generateNotificationMessage(orderId);
        }
    });
    
    document.getElementById('notificationType').addEventListener('change', (e) => {
        const orderId = document.getElementById('notificationOrder').value;
        if (orderId) {
            generateNotificationMessage(orderId);
        }
    });
    
    const form = document.getElementById('notification-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await sendNotification();
        });
    }
    
    const previewBtn = document.getElementById('preview-notification');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            const message = document.getElementById('notificationMessage').value;
            alert('Preview:\n\n' + message);
        });
    }
}

async function generateNotificationMessage(orderId) {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}`);
        const order = await response.json();
        const type = document.getElementById('notificationType').value;
        
        let message = '';
        const customerName = order.customerName;
        const orderIdShort = order.id.substring(order.id.length - 6);
        
        switch(type) {
            case 'status':
                message = `Hello ${customerName}, your laundry order #${orderIdShort} is now ${order.status}. We'll notify you when it's ready for pickup. Thank you!`;
                break;
            case 'payment':
                message = `Hello ${customerName}, this is a reminder that your order #${orderIdShort} (₱${order.price.toFixed(2)}) is ${order.paymentStatus === 'unpaid' ? 'unpaid' : 'pending payment'}. Please settle at your earliest convenience. Thank you!`;
                break;
            case 'ready':
                message = `Hello ${customerName}, your laundry order #${orderIdShort} is ready for pickup! Total: ₱${order.price.toFixed(2)}. Please visit us to collect your items. Thank you!`;
                break;
            default:
                message = `Hello ${customerName}, regarding your order #${orderIdShort}...`;
        }
        
        document.getElementById('notificationMessage').value = message;
    } catch (error) {
        console.error('Error generating message:', error);
    }
}

async function sendNotification() {
    const orderId = document.getElementById('notificationOrder').value;
    const type = document.getElementById('notificationType').value;
    const message = document.getElementById('notificationMessage').value;
    
    if (!orderId || !message) {
        alert('Please select an order and enter a message');
        return;
    }
    
    try {
        // In a real system, this would send SMS/email
        // For now, we'll just log it and show a success message
        const response = await fetch(`${API_BASE}/orders/${orderId}`);
        const order = await response.json();
        
        // Add to notifications table
        const tbody = document.getElementById('notifications-tbody');
        if (tbody.children[0] && tbody.children[0].textContent.includes('No notifications')) {
            tbody.innerHTML = '';
        }
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date().toLocaleString()}</td>
            <td>${order.id}</td>
            <td>${order.customerName}</td>
            <td>${type}</td>
            <td>${message.substring(0, 50)}...</td>
            <td><span style="color: green;">Sent</span></td>
        `;
        tbody.insertBefore(tr, tbody.firstChild);
        
        alert('Notification sent successfully! (In production, this would send SMS/email to customer)');
        document.getElementById('notification-form').reset();
    } catch (error) {
        console.error('Error sending notification:', error);
        alert('Error sending notification');
    }
}

// Make functions global for onclick handlers
window.editOrder = editOrder;
window.deleteOrder = deleteOrder;
window.viewCustomerHistory = viewCustomerHistory;

// Load dashboard on page load
loadDashboard();

