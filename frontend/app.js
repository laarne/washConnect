const API_BASE = 'http://localhost:3000/api';

// --- Navigation ---
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.section));
});

function switchSection(sectionName) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`${sectionName}-section`).classList.add('active');
    document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
    
    if (sectionName === 'dashboard') loadDashboard();
    else if (sectionName === 'orders') loadOrders();
    else if (sectionName === 'customers') loadCustomers();
    else if (sectionName === 'summary') loadSummary();
    else if (sectionName === 'notifications') loadNotifications();
}

// --- Order & Pricing Constants ---
const MIN_WEIGHT = 6;
const MAX_WEIGHT = 8;
const BASE_PRICE = 160;
const ADD_KG_PRICE = 20;
const ADDON_PRICE = 10;

const orderForm = document.getElementById('order-form');
const cancelEditBtn = document.getElementById('cancel-edit');
let editingOrderId = null;

// --- Order Form Logic ---
if(orderForm) {
    // Auto-calc listeners
    ['weight', 'serviceType', 'fabconQuantity', 'powderQuantity'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener(id === 'weight' ? 'input' : 'change', () => {
            toggleWashAddons();
            calculatePrice();
        });
    });

    // Submit Order
    orderForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const weight = parseFloat(document.getElementById('weight').value);
        const finalPrice = calculatePrice();

        if (weight < MIN_WEIGHT || weight > MAX_WEIGHT) return alert(`Weight must be ${MIN_WEIGHT}-${MAX_WEIGHT}kg`);

        const orderData = {
            customerName: document.getElementById('customerName').value,
            contact: document.getElementById('contact').value,
            email: document.getElementById('email').value,
            weight: weight,
            serviceType: document.getElementById('serviceType').value,
            fabconQuantity: document.getElementById('fabconQuantity').value,
            powderQuantity: document.getElementById('powderQuantity').value,
            notes: document.getElementById('notes').value,
            price: finalPrice,
            paymentStatus: 'unpaid',
            paymentMethod: 'cash'
        };

        try {
            const url = editingOrderId ? `${API_BASE}/orders/${editingOrderId}` : `${API_BASE}/orders`;
            const method = editingOrderId ? 'PUT' : 'POST';
            await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });

            orderForm.reset();
            editingOrderId = null;
            cancelEditBtn.style.display = 'none';
            document.getElementById('price-display').value = '';
            toggleWashAddons();
            setupCustomerAutocomplete(); // Refresh customer list
            
            if (document.getElementById('dashboard-section').classList.contains('active')) loadDashboard();
            else loadOrders();
        } catch (error) { alert('Error: ' + error.message); }
    });
}

function toggleWashAddons() {
    const type = document.getElementById('serviceType').value;
    const div = document.getElementById('wash-addons');
    if(div) {
        div.style.display = (type === 'wash') ? 'block' : 'none';
        if(type !== 'wash') {
            document.getElementById('fabconQuantity').value = '0';
            document.getElementById('powderQuantity').value = '0';
        }
    }
}

function calculatePrice() {
    const weight = parseFloat(document.getElementById('weight').value) || 0;
    const fQty = parseInt(document.getElementById('fabconQuantity').value) || 0;
    const pQty = parseInt(document.getElementById('powderQuantity').value) || 0;
    
    let price = 0;
    if (weight >= MIN_WEIGHT) {
        price = BASE_PRICE + ((weight - MIN_WEIGHT) * ADD_KG_PRICE);
    }
    price += (fQty * ADDON_PRICE) + (pQty * ADDON_PRICE);

    const display = document.getElementById('price-display');
    if (weight < MIN_WEIGHT) display.value = `Min ${MIN_WEIGHT}kg`;
    else if (weight > MAX_WEIGHT) display.value = `Max ${MAX_WEIGHT}kg`;
    else display.value = `₱${price.toFixed(2)}`;
    return price;
}

async function editOrder(id) {
    const res = await fetch(`${API_BASE}/orders/${id}`);
    const order = await res.json();
    
    document.getElementById('customerName').value = order.customerName;
    document.getElementById('contact').value = order.contact;
    document.getElementById('email').value = order.email || '';
    document.getElementById('weight').value = order.weight;
    document.getElementById('serviceType').value = order.serviceType;
    document.getElementById('fabconQuantity').value = order.fabconQuantity || 0;
    document.getElementById('powderQuantity').value = order.powderQuantity || 0;
    document.getElementById('notes').value = order.notes || '';
    
    toggleWashAddons();
    calculatePrice();
    
    editingOrderId = id;
    cancelEditBtn.style.display = 'inline-block';
    orderForm.scrollIntoView({ behavior: 'smooth' });
}

if(cancelEditBtn) cancelEditBtn.onclick = () => {
    orderForm.reset();
    editingOrderId = null;
    cancelEditBtn.style.display = 'none';
    document.getElementById('price-display').value = '';
};

// --- CUSTOMERS LOGIC (UPDATED) ---

async function loadCustomers() {
    const [custRes, orderRes] = await Promise.all([
        fetch(`${API_BASE}/customers`),
        fetch(`${API_BASE}/orders`)
    ]);
    const customers = await custRes.json();
    const orders = await orderRes.json();
    
    const tbody = document.getElementById('customers-tbody');
    tbody.innerHTML = '';
    
    customers.forEach(c => {
        const count = orders.filter(o => o.customerName === c.name).length;
        tbody.innerHTML += `
            <tr>
                <td>${c.name}</td>
                <td>${c.contact}</td>
                <td>${c.email || '-'}</td>
                <td>${count}</td>
                <td>
                    <button class="secondary" onclick="viewCustomerHistory('${c.name}')">History</button>
                    <button style="background:#f39c12" onclick="editCustomer('${c.name}', '${c.contact}', '${c.email||''}')">Edit</button>
                    <button class="danger" onclick="deleteCustomer('${c.name}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

// Edit Customer Logic
function editCustomer(name, contact, email) {
    document.getElementById('customers-main-view').style.display = 'none';
    document.getElementById('edit-customer-form-container').style.display = 'block';
    
    document.getElementById('edit-cust-name').value = name;
    document.getElementById('edit-cust-contact').value = contact;
    document.getElementById('edit-cust-email').value = email;
}

function cancelEditCustomer() {
    document.getElementById('edit-customer-form-container').style.display = 'none';
    document.getElementById('customers-main-view').style.display = 'block';
}

// Save Customer Changes
document.getElementById('customer-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('edit-cust-name').value;
    const contact = document.getElementById('edit-cust-contact').value;
    const email = document.getElementById('edit-cust-email').value;
    
    await fetch(`${API_BASE}/customers/${name}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ contact, email })
    });
    
    cancelEditCustomer();
    loadCustomers();
    alert('Customer Updated!');
});

async function deleteCustomer(name) {
    if(confirm(`Delete customer "${name}"? This cannot be undone.`)) {
        await fetch(`${API_BASE}/customers/${name}`, { method: 'DELETE' });
        loadCustomers();
    }
}

async function viewCustomerHistory(name) {
    document.getElementById('customers-main-view').style.display = 'none';
    document.getElementById('customer-history').style.display = 'block';
    document.getElementById('history-title').innerText = `History: ${name}`;
    
    const res = await fetch(`${API_BASE}/orders`);
    const orders = (await res.json()).filter(o => o.customerName === name);
    
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '';
    
    if(orders.length === 0) tbody.innerHTML = '<tr><td colspan="6">No orders found.</td></tr>';
    else orders.forEach(o => {
        tbody.innerHTML += `
            <tr>
                <td>${o.id}</td>
                <td>${o.weight}kg</td>
                <td>${o.serviceType}</td>
                <td>₱${o.price.toFixed(2)}</td>
                <td>${o.status}</td>
                <td>${new Date(o.createdAt).toLocaleDateString()}</td>
            </tr>`;
    });
}

document.getElementById('back-to-customers').onclick = () => {
    document.getElementById('customer-history').style.display = 'none';
    document.getElementById('customers-main-view').style.display = 'block';
};

// --- REPEATING CUSTOMER AUTOCOMPLETE ---
async function setupCustomerAutocomplete() {
    try {
        const res = await fetch(`${API_BASE}/customers`);
        const customers = await res.json();
        const list = document.getElementById('customer-suggestions');
        if(list) {
            list.innerHTML = '';
            customers.forEach(c => {
                const op = document.createElement('option');
                op.value = c.name;
                list.appendChild(op);
            });
            
            const input = document.getElementById('customerName');
            if(input) {
                const clone = input.cloneNode(true);
                input.parentNode.replaceChild(clone, input);
                clone.addEventListener('input', (e) => {
                    const found = customers.find(c => c.name === e.target.value);
                    if(found) {
                        document.getElementById('contact').value = found.contact || '';
                        document.getElementById('email').value = found.email || '';
                    }
                });
            }
        }
    } catch(e) { console.error(e); }
}

// --- Standard Loaders ---
async function loadOrders() {
    const res = await fetch(`${API_BASE}/orders`);
    displayOrders(await res.json());
}

function displayOrders(orders) {
    const tbody = document.getElementById('orders-tbody');
    tbody.innerHTML = '';
    orders.forEach(order => {
        const payBtn = order.paymentStatus === 'paid' 
            ? `<span style="color:green; font-weight:bold;">Paid</span>` 
            : `<button style="font-size:10px;" onclick="markPaid('${order.id}')">Mark Paid</button>`;
            
        let addOns = [];
        if(order.fabconQuantity > 0) addOns.push(`Fabcon: ${order.fabconQuantity}`);
        if(order.powderQuantity > 0) addOns.push(`Powder: ${order.powderQuantity}`);

        tbody.innerHTML += `
            <tr>
                <td>${order.id}</td>
                <td>${order.customerName}</td>
                <td>${order.contact}</td>
                <td>${order.weight}kg</td>
                <td>${order.serviceType} <small>${addOns.join(', ')}</small></td>
                <td>₱${order.price.toFixed(2)}</td>
                <td>
                    <select class="status-select" onchange="updateStatus('${order.id}', this.value)">
                        <option value="pending" ${order.status==='pending'?'selected':''}>Pending</option>
                        <option value="washing" ${order.status==='washing'?'selected':''}>Washing</option>
                        <option value="drying" ${order.status==='drying'?'selected':''}>Drying</option>
                        <option value="folded" ${order.status==='folded'?'selected':''}>Folded</option>
                        <option value="completed" ${order.status==='completed'?'selected':''}>Completed</option>
                        <option value="claimed" ${order.status==='claimed'?'selected':''}>Claimed</option>
                    </select>
                </td>
                <td>${payBtn}</td>
                <td>${new Date(order.createdAt).toLocaleDateString()}</td>
                <td>
                    <button class="secondary" onclick="editOrder('${order.id}')">Edit</button>
                    <button class="danger" onclick="deleteOrder('${order.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
}

async function markPaid(id) {
    await fetch(`${API_BASE}/orders/${id}`, {
        method: 'PUT', 
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({paymentStatus: 'paid'})
    });
    loadOrders();
}

async function updateStatus(id, status) {
    await fetch(`${API_BASE}/orders/${id}`, {
        method: 'PUT', 
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({status})
    });
}

async function deleteOrder(id) {
    if(confirm('Delete Order?')) {
        await fetch(`${API_BASE}/orders/${id}`, { method: 'DELETE' });
        loadOrders();
    }
}

async function loadDashboard() {
    const res = await fetch(`${API_BASE}/orders`);
    const orders = await res.json();
    
    document.getElementById('active-orders-count').innerText = orders.filter(o => ['pending','washing','drying','folded'].includes(o.status)).length;
    document.getElementById('unpaid-orders-count').innerText = orders.filter(o => o.paymentStatus === 'unpaid').length;
    document.getElementById('in-progress-count').innerText = orders.filter(o => ['washing','drying'].includes(o.status)).length;
    document.getElementById('ready-count').innerText = orders.filter(o => o.status === 'completed').length;

    const tbody = document.getElementById('dashboard-tbody');
    tbody.innerHTML = '';
    orders.filter(o => ['pending','washing','drying','folded'].includes(o.status)).forEach(order => {
        const progress = (order.status==='pending')?10:(order.status==='washing')?30:(order.status==='drying')?60:(order.status==='folded')?80:100;
        tbody.innerHTML += `
            <tr>
                <td>${order.id}</td>
                <td>${order.customerName}</td>
                <td>${order.serviceType}</td>
                <td>${order.status}</td>
                <td><div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div></td>
                <td>${order.paymentStatus}</td>
                <td><button class="secondary" onclick="editOrder('${order.id}')">View</button></td>
            </tr>
        `;
    });
}

async function loadNotifications() {
    // Populate dropdown
    const res = await fetch(`${API_BASE}/orders`);
    const orders = await res.json();
    const sel = document.getElementById('notificationOrder');
    sel.innerHTML = '<option value="">Select Order...</option>';
    orders.forEach(o => {
        sel.innerHTML += `<option value="${o.id}">${o.customerName} (${o.status})</option>`;
    });
    
    // Listener for auto-fill
    sel.onchange = () => {
        const o = orders.find(x => x.id === sel.value);
        if(o) {
             const type = document.getElementById('notificationType').value;
             const msg = document.getElementById('notificationMessage');
             if(type === 'status') msg.value = `Hi ${o.customerName}, your laundry is ${o.status}.`;
             else if(type === 'payment') msg.value = `Hi ${o.customerName}, pending balance: ₱${o.price}.`;
             else if(type === 'ready') msg.value = `Hi ${o.customerName}, laundry is ready! Total: ₱${o.price}.`;
        }
    };
}

async function loadSummary() {
    const res = await fetch(`${API_BASE}/orders/summary/today`);
    const data = await res.json();
    document.getElementById('total-sales').innerText = `₱${data.totalSales.toFixed(2)}`;
    document.getElementById('total-orders').innerText = data.totalOrders;
    document.getElementById('completed-orders').innerText = data.completedOrders;
    document.getElementById('paid-orders').innerText = data.paidOrders;
    document.getElementById('unpaid-orders').innerText = data.unpaidOrders;
}

// --- Init ---
window.editOrder = editOrder;
window.deleteOrder = deleteOrder;
window.markPaid = markPaid;
window.updateStatus = updateStatus;
window.viewCustomerHistory = viewCustomerHistory;
window.editCustomer = editCustomer;
window.deleteCustomer = deleteCustomer;
window.cancelEditCustomer = cancelEditCustomer;

toggleWashAddons();
setupCustomerAutocomplete();
loadDashboard();