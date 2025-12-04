document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. CONFIGURATION ---
    // In production (Render), use same-origin API: `${window.location.origin}/api`
    // In local development, fall back to http://localhost:3000/api
    const API_URL = window.location.hostname === 'localhost'
        ? 'http://localhost:3000/api'
        : `${window.location.origin}/api`;
    
    // Store for filtering
    let allOrders = [];
    let allCustomers = [];
    
    // --- 2. DOM ELEMENTS ---
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    // Navigation Buttons
    const navBtns = {
        dashboard: document.getElementById('nav-dashboard'),
        orders: document.getElementById('nav-orders'),
        payments: document.getElementById('nav-payments'),
        laundryStatus: document.getElementById('nav-laundry-status'),
        customers: document.getElementById('nav-customers'),
        reports: document.getElementById('nav-reports')
    };

    // Views (Screens)
    const views = {
        dashboard: document.getElementById('dashboard-view'),
        orders: document.getElementById('orders-view'),
        payments: document.getElementById('payments-view'),
        laundryStatus: document.getElementById('laundry-status-view'),
        customers: document.getElementById('customers-view'),
        reports: document.getElementById('reports-view')
    };

    // Ensure tables expose a scrollbar on top that mirrors the main scroll area
    function refreshTableScrollbars() {
        const wrappers = document.querySelectorAll('.table-wrapper');

        wrappers.forEach(wrapper => {
            const topTrack = wrapper.querySelector('.table-scrollbar');
            const mainTrack = wrapper.querySelector('.table-scroll');
            const spacer = wrapper.querySelector('.table-scrollbar-spacer');

            if (!topTrack || !mainTrack || !spacer) {
                return;
            }

            const updateSpacerWidth = () => {
                spacer.style.width = `${mainTrack.scrollWidth}px`;
            };

            updateSpacerWidth();

            if (wrapper.dataset.scrollSynced === 'true') {
                return;
            }

            let isSyncing = false;
            const syncScroll = (source, target) => {
                if (isSyncing) return;
                isSyncing = true;
                target.scrollLeft = source.scrollLeft;
                isSyncing = false;
            };

            topTrack.addEventListener('scroll', () => syncScroll(topTrack, mainTrack));
            mainTrack.addEventListener('scroll', () => syncScroll(mainTrack, topTrack));
            window.addEventListener('resize', updateSpacerWidth);

            if (window.ResizeObserver) {
                const observer = new ResizeObserver(updateSpacerWidth);
                observer.observe(mainTrack);
                wrapper._scrollbarObserver = observer;
            }

            wrapper.dataset.scrollSynced = 'true';
        });
    }

    // --- 2.5. TOAST NOTIFICATION SYSTEM ---
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        
        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || icons.info}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
    
    // Make toast available globally
    window.showToast = showToast;

    // --- 3. LOGIN LOGIC ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-user').value;
        const password = document.getElementById('login-pass').value;

        try {
            // Send credentials to backend
            const res = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (data.success) {
                // SUCCESS: Hide login, show app
                loginScreen.classList.add('hidden');
                appContainer.classList.remove('hidden');
                showToast('Login successful!', 'success');
                
                // Load the dashboard data immediately
                loadDashboardData();
            } else {
                // FAIL: Show error message
                loginError.textContent = "Invalid username or password.";
                loginError.style.display = 'block';
                showToast('Invalid credentials', 'error');
            }
        } catch (err) {
            console.error(err);
            loginError.textContent = "Server error. Is the backend running?";
            loginError.style.display = 'block';
            showToast('Server connection error', 'error');
        }
    });

    // --- 4. NAVIGATION LOGIC ---
    function switchView(viewName) {
        // 1. Hide all views
        Object.values(views).forEach(el => el.classList.add('hidden'));
        
        // 2. Remove 'active' class from all buttons
        Object.values(navBtns).forEach(el => el.classList.remove('active'));

        // 3. Show the selected view
        views[viewName].classList.remove('hidden');
        
        // 4. Highlight the selected button
        navBtns[viewName].classList.add('active');

        // 5. Load data for that view
        if (viewName === 'dashboard') loadDashboardData();
        if (viewName === 'orders') {
            loadOrders();
            setTimeout(() => {
                if (typeof setupOrderFilters === 'function') setupOrderFilters();
            }, 100);
        }
        if (viewName === 'payments') {
            loadPayments();
        }
        if (viewName === 'laundryStatus') {
            loadLaundryStatus();
        }
        if (viewName === 'customers') loadCustomers();
        if (viewName === 'reports') {
            // Reset report view when switching to it
            document.getElementById('report-results').style.display = 'none';
        }
    }

    // Attach click events
    navBtns.dashboard.addEventListener('click', () => window.switchView('dashboard'));
    navBtns.orders.addEventListener('click', () => window.switchView('orders'));
    navBtns.payments.addEventListener('click', () => window.switchView('payments'));
    navBtns.laundryStatus.addEventListener('click', () => window.switchView('laundryStatus'));
    navBtns.customers.addEventListener('click', () => window.switchView('customers'));
    navBtns.reports.addEventListener('click', () => window.switchView('reports'));

    // --- 5. DATA LOADING FUNCTIONS ---

    // A. Load Dashboard (Summary Cards)
    async function loadDashboardData() {
        try {
            const res = await fetch(`${API_URL}/analytics/summary`);
            const data = await res.json();

            // Update Income/Order Cards
            document.getElementById('summary-income-today').textContent = `₱${data.today.income.toFixed(2)}`;
            document.getElementById('summary-orders-today').textContent = data.today.orders;
            document.getElementById('summary-income-month').textContent = `₱${data.month.income.toFixed(2)}`;
            
            // Update Status Cards
            document.getElementById('summary-status-pending').textContent = data.statusCounts.pending || 0;
            document.getElementById('summary-status-washing').textContent = data.statusCounts.washing || 0;
            document.getElementById('summary-status-ready').textContent = data.statusCounts.ready || 0;
            document.getElementById('summary-status-completed').textContent = data.statusCounts.completed || 0;

            // Load recent orders
            await loadRecentOrders();

        } catch (err) {
            console.error("Error loading dashboard:", err);
        }
    }

    // Load Recent Orders for Dashboard
    async function loadRecentOrders() {
        try {
            const res = await fetch(`${API_URL}/orders`);
            const orders = await res.json();
            
            // Get top 5 most recent orders
            const recentOrders = orders.slice(0, 5);
            const tbody = document.getElementById('recent-orders-table-body');
            if (!tbody) return;
            
            tbody.innerHTML = '';
            
            if (recentOrders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No recent orders</td></tr>';
                return;
            }
            
            recentOrders.forEach(order => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${order.id}</td>
                    <td><strong>${order.customer_name || 'Unknown'}</strong></td>
                    <td>${order.service_type}</td>
                    <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                    <td>₱${parseFloat(order.price || 0).toFixed(2)}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error("Error loading recent orders:", err);
        }
    }

    // B. Load Orders List
    async function loadOrders() {
        const tbody = document.getElementById('orders-table-body');
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;"><div class="loading-spinner" style="margin: 20px auto;"></div></td></tr>';

        try {
            const res = await fetch(`${API_URL}/orders`);
            const orders = await res.json();

            allOrders = orders; // Store for filtering
            displayOrders(orders);

            // Also refresh the dropdown in the "Create Order" form
            loadCustomers(true); 

        } catch (err) {
            console.error(err);
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">Error loading data.</td></tr>';
            showToast('Failed to load orders', 'error');
        }
    }
    
    // Display Orders (with filtering support)
    function displayOrders(orders) {
        const tbody = document.getElementById('orders-table-body');
        tbody.innerHTML = '';

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No orders found.</td></tr>';
            refreshTableScrollbars();
            return;
        }

        orders.forEach(order => {
            const tr = document.createElement('tr');
            const addOnsDisplay = order.add_ons && Array.isArray(order.add_ons) && order.add_ons.length > 0
                ? order.add_ons.join(', ')
                : '-';
            
            // Check payment status from database field or notes fallback
            let paymentStatus = order.payment_status || 'unpaid';
            const paymentMethod = order.payment_method || '';
            
            // Fallback: check notes for payment status if column doesn't exist
            if (!order.payment_status && order.notes) {
                if (order.notes.includes('[PAYMENT:PAID]')) {
                    paymentStatus = 'paid';
                } else if (order.notes.includes('[PAYMENT:UNPAID]')) {
                    paymentStatus = 'unpaid';
                }
            }
            
            const paymentBadge = paymentStatus === 'paid' 
                ? `<span class="payment-badge paid">Paid${paymentMethod ? ' (' + paymentMethod + ')' : ''}</span>`
                : `<span class="payment-badge unpaid">Unpaid</span>`;
            
            const printedName = order.printed_name || '-';
            const machineNumber = order.machine_number || '-';
            
            tr.innerHTML = `
                <td>${order.id}</td>
                <td><strong>${order.customer_name}</strong></td>
                <td><strong style="color: #4318FF;">${printedName}</strong></td>
                <td>${order.service_type}</td>
                <td>${order.weight_kg} kg</td>
                <td>${addOnsDisplay}</td>
                <td>₱${parseFloat(order.price).toFixed(2)}</td>
                <td>${machineNumber}</td>
                <td>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
                        <button onclick="openSmsModal('${order.id}')" class="btn-small btn-secondary">SMS</button>
                        <button onclick="openReceiptModal('${order.id}')" class="btn-small btn-secondary">Receipt</button>
                        <button onclick="openEditOrderModal('${order.id}')" class="btn-small btn-secondary">Edit</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        refreshTableScrollbars();
    }
    
    // Search and Filter Orders
    function setupOrderFilters() {
        const searchInput = document.getElementById('orders-search');
        const statusFilter = document.getElementById('orders-filter-status');
        const serviceFilter = document.getElementById('orders-filter-service');
        const clearBtn = document.getElementById('clear-filters-btn');
        
        function applyFilters() {
            let filtered = [...allOrders];
            
            // Search filter
            const searchTerm = searchInput.value.toLowerCase();
            if (searchTerm) {
                filtered = filtered.filter(order => 
                    order.customer_name?.toLowerCase().includes(searchTerm) ||
                    order.id.toString().includes(searchTerm) ||
                    order.service_type?.toLowerCase().includes(searchTerm)
                );
            }
            
            // Status filter
            const statusValue = statusFilter.value;
            if (statusValue) {
                filtered = filtered.filter(order => order.status === statusValue);
            }
            
            // Service filter
            const serviceValue = serviceFilter.value;
            if (serviceValue) {
                filtered = filtered.filter(order => order.service_type === serviceValue);
            }
            
            displayOrders(filtered);
        }
        
        searchInput.addEventListener('input', applyFilters);
        statusFilter.addEventListener('change', applyFilters);
        serviceFilter.addEventListener('change', applyFilters);
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            statusFilter.value = '';
            serviceFilter.value = '';
            displayOrders(allOrders);
        });
    }
    
    // Store original switchView
    const originalSwitchView = switchView.bind(null);
    
    // Override switchView to add filter setup
    window.switchView = function(viewName) {
        // 1. Hide all views
        Object.values(views).forEach(el => el.classList.add('hidden'));
        
        // 2. Remove 'active' class from all buttons
        Object.values(navBtns).forEach(el => el.classList.remove('active'));

        // 3. Show the selected view
        views[viewName].classList.remove('hidden');
        
        // 4. Highlight the selected button
        navBtns[viewName].classList.add('active');

        // 5. Load data for that view
        if (viewName === 'dashboard') loadDashboardData();
        if (viewName === 'orders') {
            loadOrders();
            setTimeout(setupOrderFilters, 100);
        }
        if (viewName === 'payments') {
            loadPayments();
        }
        if (viewName === 'laundryStatus') {
            loadLaundryStatus();
        }
        if (viewName === 'customers') loadCustomers();
        if (viewName === 'reports') {
            // Reset report view when switching to it
            document.getElementById('report-results').style.display = 'none';
        }
    };

    // C. Load Customers List
    async function loadCustomers(dropdownOnly = false) {
        try {
            const res = await fetch(`${API_URL}/customers`);
            const customers = await res.json();

            // 1. Populate Datalist (for Create Order form - searchable input)
            const datalist = document.getElementById('customer-list');
            datalist.innerHTML = '';
            customers.forEach(c => {
                const option = document.createElement('option');
                option.value = c.name;
                option.dataset.id = c.id;
                datalist.appendChild(option);
            });

            // Store customers for lookup
            window.customersList = customers;

            // If we only needed the dropdown, stop here
            if (dropdownOnly) return;

            // 2. Populate Table (for Customers View)
            const tbody = document.getElementById('customers-table-body');
            tbody.innerHTML = '';

            if (customers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No customers found.</td></tr>';
            refreshTableScrollbars();
                return;
            }

            customers.forEach(c => {
                tbody.innerHTML += `
                    <tr>
                        <td>${c.id}</td>
                        <td><strong>${c.name}</strong></td>
                        <td>${c.phone || '-'}</td>
                        <td>${c.address || '-'}</td>
                        <td style="text-align: center;">
                            <div style="display: flex; gap: 5px; justify-content: center;">
                                <button onclick="openEditCustomerModal(${c.id})" class="btn-small btn-secondary" title="Edit Customer">
                                    Edit
                                </button>
                                <button onclick="deleteCustomer(${c.id}, '${c.name.replace(/'/g, "\\'")}')" class="btn-small btn-danger" title="Delete Customer">
                                 Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });

        refreshTableScrollbars();

        } catch (err) {
            console.error("Error loading customers:", err);
        }
    }

    // D. Load Payments List
    async function loadPayments() {
        const tbody = document.getElementById('payments-table-body');
        if (!tbody) return; // View not loaded yet
        
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;"><div class="loading-spinner" style="margin: 20px auto;"></div></td></tr>';

        try {
            const filterStatus = document.getElementById('payments-filter-status')?.value || '';
            let url = `${API_URL}/orders/payments`;
            if (filterStatus) {
                url += `?payment_status=${filterStatus}`;
            }

            console.log('Fetching payments from:', url);
            const res = await fetch(url);
            
            if (!res.ok) {
                const errorText = await res.text();
                console.error('Payment API error:', res.status, errorText);
                throw new Error(`HTTP ${res.status}: ${errorText}`);
            }
            
            const orders = await res.json();
            console.log('Payments loaded:', orders.length);
            displayPayments(orders);
        } catch (err) {
            console.error('Error loading payments:', err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: var(--danger);">Error: ${err.message}</td></tr>`;
            }
            showToast(`Failed to load payments: ${err.message}`, 'error');
        }
    }

    function displayPayments(orders) {
        const tbody = document.getElementById('payments-table-body');
        tbody.innerHTML = '';

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No payments found.</td></tr>';
            refreshTableScrollbars();
            return;
        }

        orders.forEach(order => {
            const tr = document.createElement('tr');
            const printedName = order.printed_name || '-';
            let paymentStatus = order.payment_status || 'unpaid';
            const paymentMethod = order.payment_method || '';
            const paidAmount = order.paid_amount || 0;

            const paymentBadge = paymentStatus === 'paid' 
                ? `<span class="payment-badge paid">Paid${paymentMethod ? ' (' + paymentMethod + ')' : ''}</span>`
                : `<span class="payment-badge unpaid">Unpaid</span>`;

            tr.innerHTML = `
                <td>${order.id}</td>
                <td><strong>${order.customer_name}</strong></td>
                <td><strong style="color: #4318FF;">${printedName}</strong></td>
                <td>${order.service_type}</td>
                <td>₱${parseFloat(order.price).toFixed(2)}</td>
                <td>${paymentBadge}</td>
                <td>${paymentMethod || '-'}</td>
                <td>${paidAmount > 0 ? '₱' + parseFloat(paidAmount).toFixed(2) : '-'}</td>
                <td>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
                        <button onclick="markPayment('${order.id}', '${paymentStatus === 'paid' ? 'unpaid' : 'paid'}')" 
                                class="btn-small ${paymentStatus === 'paid' ? 'btn-secondary' : 'btn-success'}">
                            ${paymentStatus === 'paid' ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
                        <button onclick="openReceiptModal('${order.id}')" class="btn-small btn-secondary">Receipt</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        refreshTableScrollbars();
    }

    // E. Load Laundry Status List
    async function loadLaundryStatus() {
        const tbody = document.getElementById('laundry-status-table-body');
        if (!tbody) return; // View not loaded yet
        
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;"><div class="loading-spinner" style="margin: 20px auto;"></div></td></tr>';

        try {
            const filterStatus = document.getElementById('laundry-filter-status')?.value || '';
            let url = `${API_URL}/orders/status`;
            if (filterStatus) {
                url += `?status=${filterStatus}`;
            }

            console.log('Fetching laundry status from:', url);
            const res = await fetch(url);
            
            if (!res.ok) {
                const errorText = await res.text();
                console.error('Laundry status API error:', res.status, errorText);
                throw new Error(`HTTP ${res.status}: ${errorText}`);
            }
            
            const orders = await res.json();
            console.log('Laundry status loaded:', orders.length);
            displayLaundryStatus(orders);
        } catch (err) {
            console.error('Error loading laundry status:', err);
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--danger);">Error: ${err.message}</td></tr>`;
            }
            showToast(`Failed to load laundry status: ${err.message}`, 'error');
        }
    }

    function displayLaundryStatus(orders) {
        const tbody = document.getElementById('laundry-status-table-body');
        tbody.innerHTML = '';

        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No orders found.</td></tr>';
            refreshTableScrollbars();
            return;
        }

        orders.forEach(order => {
            const tr = document.createElement('tr');
            const printedName = order.printed_name || '-';
            const machineNumber = order.machine_number || '-';

            tr.innerHTML = `
                <td>${order.id}</td>
                <td><strong>${order.customer_name}</strong></td>
                <td><strong style="color: #4318FF;">${printedName}</strong></td>
                <td>${order.service_type}</td>
                <td>${order.weight_kg} kg</td>
                <td><span class="status-badge status-${order.status}">${order.status}</span></td>
                <td><strong style="color: #4318FF;">${machineNumber}</strong></td>
                <td>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap; align-items: center;">
                        <select onchange="updateStatus('${order.id}', this.value)" class="status-select">
                            <option value="">Status...</option>
                            <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                            <option value="washing" ${order.status === 'washing' ? 'selected' : ''}>Washing</option>
                            <option value="ready" ${order.status === 'ready' ? 'selected' : ''}>Ready</option>
                            <option value="completed" ${order.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                        <select onchange="updateMachine('${order.id}', this.value)" class="status-select">
                            <option value="">Machine...</option>
                            <option value="Washer 1" ${order.machine_number === 'Washer 1' ? 'selected' : ''}>Washer 1</option>
                            <option value="Washer 2" ${order.machine_number === 'Washer 2' ? 'selected' : ''}>Washer 2</option>
                            <option value="Washer 3" ${order.machine_number === 'Washer 3' ? 'selected' : ''}>Washer 3</option>
                            <option value="Washer 4" ${order.machine_number === 'Washer 4' ? 'selected' : ''}>Washer 4</option>
                            <option value="Dryer 1" ${order.machine_number === 'Dryer 1' ? 'selected' : ''}>Dryer 1</option>
                            <option value="Dryer 2" ${order.machine_number === 'Dryer 2' ? 'selected' : ''}>Dryer 2</option>
                            <option value="Dryer 3" ${order.machine_number === 'Dryer 3' ? 'selected' : ''}>Dryer 3</option>
                            <option value="Dryer 4" ${order.machine_number === 'Dryer 4' ? 'selected' : ''}>Dryer 4</option>
                            <option value="">Remove</option>
                        </select>
                        <button onclick="openSmsModal('${order.id}')" class="btn-small btn-secondary">SMS</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        refreshTableScrollbars();
    }

    // --- 6. FORM SUBMISSIONS ---

    // Create New Order
    document.getElementById('create-order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get customer from searchable input
        const customerInput = document.getElementById('order-customer-input').value;
        if (!customerInput) {
            alert("Please select a customer.");
            return;
        }

        // Find customer ID by name
        const customer = window.customersList?.find(c => c.name === customerInput);
        if (!customer) {
            alert("Customer not found. Please select from the list.");
            return;
        }
        
        // Collect add-ons
        const addOns = [];
        if (document.getElementById('addon-fabcon').checked) {
            addOns.push('Fabcon');
        }
        if (document.getElementById('addon-powder').checked) {
            addOns.push('Powder');
        }
        
        const data = {
            customer_id: customer.id,
            service_type: document.getElementById('order-service').value,
            weight_kg: document.getElementById('order-weight').value,
            add_ons: addOns,
            printed_name: document.getElementById('order-printed-name').value,
            machine_number: document.getElementById('order-machine-number').value || null,
            notes: document.getElementById('order-notes')?.value || ''
        };

        // Validate weight
        if (parseFloat(data.weight_kg) < 6) {
            showToast('Weight must be at least 6kg', 'error');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (res.ok) {
                showToast('Order created successfully!', 'success');
                e.target.reset(); // Clear form
                loadOrders(); // Refresh table
                loadDashboardData(); // Update dashboard
            } else {
                showToast(result.error || 'Failed to create order', 'error');
            }
        } catch (err) {
            showToast('Error connecting to server', 'error');
        }
    });

    // Create New Customer
    document.getElementById('create-customer-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            name: document.getElementById('cust-name').value,
            phone: document.getElementById('cust-phone').value,
            address: document.getElementById('cust-address').value
        };

        try {
            const res = await fetch(`${API_URL}/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            if (res.ok) {
                showToast('Customer added successfully!', 'success');
                e.target.reset(); // Clear form
                loadCustomers(); // Refresh table
            } else {
                showToast(result.error || 'Failed to add customer', 'error');
            }
        } catch (err) {
            showToast('Error connecting to server', 'error');
        }
    });

    // --- 7. REPORTS FUNCTIONALITY ---
    let salesChart = null; // Store chart instance

    // Report Type Selection
    const reportTypeBtns = document.querySelectorAll('.report-type-btn');
    const customDateRange = document.getElementById('custom-date-range');
    let currentReportType = 'weekly';

    reportTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            reportTypeBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            currentReportType = btn.dataset.type;
            
            // Show/hide custom date range inputs
            if (currentReportType === 'custom') {
                customDateRange.style.display = 'block';
            } else {
                customDateRange.style.display = 'none';
            }
        });
    });

    // Generate Report
    document.getElementById('generate-report-btn').addEventListener('click', async () => {
        let url = `${API_URL}/reports?type=${currentReportType}`;
        
        if (currentReportType === 'custom') {
            const startDate = document.getElementById('report-start-date').value;
            const endDate = document.getElementById('report-end-date').value;
            
            if (!startDate || !endDate) {
                alert("Please select both start and end dates for custom reports.");
                return;
            }
            
            url += `&startDate=${startDate}&endDate=${endDate}`;
        }

        try {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error('Failed to generate report');
            }
            
            const reportData = await res.json();
            displayReport(reportData);
        } catch (err) {
            console.error(err);
            alert("Error generating report. Please try again.");
        }
    });

    // Display Report Data
    function displayReport(data) {
        // Store report data for export
        window.currentReportData = data;
        
        // Show results section
        document.getElementById('report-results').style.display = 'block';

        // Update summary cards
        document.getElementById('report-total-sales').textContent = `₱${data.totalSales.toFixed(2)}`;
        document.getElementById('report-total-orders').textContent = data.totalOrders;
        
        // Format date range
        const start = new Date(data.startDate).toLocaleDateString();
        const end = new Date(data.endDate).toLocaleDateString();
        document.getElementById('report-date-range').textContent = `${start} - ${end}`;

        // Update status counts
        document.getElementById('report-status-pending').textContent = data.statusCounts.pending || 0;
        document.getElementById('report-status-washing').textContent = data.statusCounts.washing || 0;
        document.getElementById('report-status-ready').textContent = data.statusCounts.ready || 0;
        document.getElementById('report-status-completed').textContent = data.statusCounts.completed || 0;
        document.getElementById('report-status-cancelled').textContent = data.statusCounts.cancelled || 0;

        // Update chart
        updateChart(data.chartData);

        // Update orders table
        const tbody = document.getElementById('reports-orders-table-body');
        tbody.innerHTML = '';

        if (data.orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No orders found in this date range.</td></tr>';
            refreshTableScrollbars();
            return;
        }

        data.orders.forEach(order => {
            const tr = document.createElement('tr');
            const orderDate = new Date(order.created_at).toLocaleDateString();
            const addOnsDisplay = order.add_ons && Array.isArray(order.add_ons) && order.add_ons.length > 0
                ? order.add_ons.join(', ')
                : '-';
            
            tr.innerHTML = `
                <td>${order.id}</td>
                <td>${orderDate}</td>
                <td><strong>${order.customer_name}</strong></td>
                <td>${order.service_type}</td>
                <td>${order.weight_kg} kg</td>
                <td>${addOnsDisplay}</td>
                <td>₱${parseFloat(order.price).toFixed(2)}</td>
                <td><span class="status-badge status-${order.status}">${order.status}</span></td>
            `;
            tbody.appendChild(tr);
        });

        refreshTableScrollbars();
    }

    // Export Report to CSV
    window.exportReportToCSV = function() {
        const reportData = window.currentReportData;
        if (!reportData || !reportData.orders || reportData.orders.length === 0) {
            showToast('No data to export', 'warning');
            return;
        }
        
        // CSV Headers
        const headers = ['ID', 'Date', 'Customer', 'Service', 'Weight (kg)', 'Add-ons', 'Price', 'Status', 'Payment Status'];
        
        // CSV Rows
        const rows = reportData.orders.map(order => {
            const date = new Date(order.created_at).toLocaleDateString();
            const addOns = order.add_ons && Array.isArray(order.add_ons) ? order.add_ons.join('; ') : '-';
            return [
                order.id,
                date,
                order.customer_name,
                order.service_type,
                order.weight_kg,
                addOns,
                order.price,
                order.status,
                order.payment_status || 'unpaid'
            ];
        });
        
        // Add summary row
        rows.push([]);
        rows.push(['Summary', '', '', '', '', '', '', '']);
        rows.push(['Total Sales', '', '', '', '', '', reportData.totalSales.toFixed(2), '']);
        rows.push(['Total Orders', '', '', '', '', '', reportData.totalOrders, '']);
        
        // Convert to CSV
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        // Download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `report_${reportData.type}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('Report exported to CSV', 'success');
    };
    
    // Print Report
    window.printReport = function() {
        const reportData = window.currentReportData;
        if (!reportData) {
            showToast('No report data to print', 'warning');
            return;
        }
        
        const printWindow = window.open('', '_blank');
        const startDate = new Date(reportData.startDate).toLocaleDateString();
        const endDate = new Date(reportData.endDate).toLocaleDateString();
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Report - ${reportData.type}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { color: #4318FF; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #4318FF; color: white; }
                        .summary { margin: 20px 0; }
                        .summary-item { margin: 10px 0; }
                    </style>
                </head>
                <body>
                    <h1>Wash Connect - ${reportData.type.charAt(0).toUpperCase() + reportData.type.slice(1)} Report</h1>
                    <p><strong>Date Range:</strong> ${startDate} - ${endDate}</p>
                    
                    <div class="summary">
                        <div class="summary-item"><strong>Total Sales:</strong> ₱${reportData.totalSales.toFixed(2)}</div>
                        <div class="summary-item"><strong>Total Orders:</strong> ${reportData.totalOrders}</div>
                        <div class="summary-item"><strong>Pending:</strong> ${reportData.statusCounts.pending || 0}</div>
                        <div class="summary-item"><strong>Washing:</strong> ${reportData.statusCounts.washing || 0}</div>
                        <div class="summary-item"><strong>Ready:</strong> ${reportData.statusCounts.ready || 0}</div>
                        <div class="summary-item"><strong>Completed:</strong> ${reportData.statusCounts.completed || 0}</div>
                        <div class="summary-item"><strong>Cancelled:</strong> ${reportData.statusCounts.cancelled || 0}</div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Date</th>
                                <th>Customer</th>
                                <th>Service</th>
                                <th>Weight</th>
                                <th>Price</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.orders.map(order => {
                                const date = new Date(order.created_at).toLocaleDateString();
                                return `
                                    <tr>
                                        <td>${order.id}</td>
                                        <td>${date}</td>
                                        <td>${order.customer_name}</td>
                                        <td>${order.service_type}</td>
                                        <td>${order.weight_kg} kg</td>
                                        <td>₱${parseFloat(order.price).toFixed(2)}</td>
                                        <td>${order.status}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                    
                    <p style="margin-top: 30px; font-size: 12px; color: #666;">
                        Generated on ${new Date().toLocaleString()}
                    </p>
                </body>
            </html>
        `);
        
        printWindow.document.close();
        printWindow.print();
    };
    
    // Update Chart
    function updateChart(chartData) {
        const canvas = document.getElementById('sales-chart');
        if (!canvas) {
            console.error('Chart canvas not found');
            return;
        }
        
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('Chart.js library not loaded');
            showToast('Chart library not loaded. Please refresh the page.', 'error');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.error('Could not get canvas context');
            return;
        }
        
        // Destroy existing chart if it exists
        if (salesChart) {
            salesChart.destroy();
            salesChart = null;
        }

        // Check if we have data
        if (!chartData || !chartData.labels || !chartData.values) {
            console.error('Invalid chart data:', chartData);
            // Show message in chart area
            canvas.parentElement.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-muted);">No sales data available for this period.</p>';
            return;
        }

        // Ensure we have data
        if (chartData.labels.length === 0 || chartData.values.length === 0) {
            canvas.parentElement.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-muted);">No sales data available for this period.</p>';
            return;
        }

        // Format labels for better display
        const formattedLabels = chartData.labels.map(date => {
            try {
                // Parse YYYY-MM-DD format
                const [year, month, day] = date.split('-');
                const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            } catch (e) {
                console.error('Error formatting date:', date, e);
                return date;
            }
        });
        
        console.log('Formatted labels:', formattedLabels);
        console.log('Chart values:', chartData.values);

        try {
            salesChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: formattedLabels,
                    datasets: [{
                        label: 'Daily Sales (₱)',
                        data: chartData.values,
                        borderColor: '#4318FF',
                        backgroundColor: 'rgba(67, 24, 255, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        pointBackgroundColor: '#4318FF',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                font: {
                                    size: 14,
                                    weight: 'bold'
                                },
                                color: '#2B3674',
                                usePointStyle: true,
                                padding: 15
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            padding: 12,
                            titleFont: {
                                size: 14,
                                weight: 'bold'
                            },
                            bodyFont: {
                                size: 13
                            },
                            callbacks: {
                                label: function(context) {
                                    return `Sales: ₱${context.parsed.y.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '₱' + value.toFixed(0);
                                },
                                font: {
                                    size: 12
                                },
                                color: '#707EAE'
                            },
                            grid: {
                                color: 'rgba(112, 126, 174, 0.1)'
                            }
                        },
                        x: {
                            ticks: {
                                font: {
                                    size: 12
                                },
                                color: '#707EAE',
                                maxRotation: 45,
                                minRotation: 0
                            },
                            grid: {
                                display: false
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error creating chart:', error);
            showToast('Error displaying chart: ' + error.message, 'error');
            canvas.parentElement.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-muted);">Error loading chart. Please try again.</p>';
        }
    }

    // --- 8. GLOBAL FUNCTIONS ---
    // This allows the "onchange" in the HTML to find this function
    window.updateStatus = async (orderId, newStatus) => {
        if (!newStatus) return;

        try {
            const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                showToast('Order status updated', 'success');
                loadOrders(); // Refresh list to show change
                loadLaundryStatus(); // Refresh laundry status view if open
                loadDashboardData(); // Update dashboard
            } else {
                const error = await res.json();
                showToast(error.error || 'Failed to update status', 'error');
            }
        } catch (err) {
            showToast('Error updating status', 'error');
        }
    };
    
    // Mark Payment
    window.markPayment = async (orderId, paymentStatus) => {
        try {
            const res = await fetch(`${API_URL}/orders/${orderId}/payment`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    payment_status: paymentStatus,
                    payment_method: paymentStatus === 'paid' ? 'cash' : null
                })
            });

            const result = await res.json();

            if (res.ok) {
                showToast(`Payment marked as ${paymentStatus}`, 'success');
                loadOrders();
                loadPayments(); // Refresh payments view if open
                loadDashboardData();
            } else {
                // Check if it's a database column error
                if (result.error && result.error.includes('column')) {
                    showToast('Payment tracking requires database setup. Please add payment columns to your database.', 'warning');
                    console.error('Database setup needed:', result.error);
                } else {
                    showToast(result.error || 'Failed to update payment', 'error');
                }
            }
        } catch (err) {
            console.error('Payment update error:', err);
            showToast('Error updating payment', 'error');
        }
    };

    // Update Machine Number
    window.updateMachine = async (orderId, machineNumber) => {
        if (!machineNumber) {
            machineNumber = null; // Clear machine assignment
        }

        try {
            const res = await fetch(`${API_URL}/orders/${orderId}/machine`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ machine_number: machineNumber })
            });

            if (res.ok) {
                showToast(`Machine updated to ${machineNumber || 'none'}`, 'success');
                loadLaundryStatus(); // Refresh laundry status view
                loadOrders(); // Also refresh orders view
            } else {
                const error = await res.json();
                showToast(error.error || 'Failed to update machine', 'error');
            }
        } catch (err) {
            showToast('Error updating machine', 'error');
        }
    };

    // --- 9. SMS NOTIFICATION PROTOTYPE & DIGITAL RECEIPT ---

    // Open SMS modal (prototype only)
    window.openSmsModal = async (orderId) => {
        let order = allOrders.find(o => String(o.id) === String(orderId));
        
        // If order not in cache, fetch it
        if (!order) {
            try {
                const res = await fetch(`${API_URL}/orders/${orderId}`);
                if (!res.ok) {
                    showToast('Order not found for SMS', 'error');
                    return;
                }
                order = await res.json();
            } catch (err) {
                showToast('Error loading order for SMS', 'error');
                return;
            }
        }

        // Try to find customer phone from loaded customers
        let phone = '';
        if (Array.isArray(window.customersList)) {
            const customer = window.customersList.find(c => c.name === order.customer_name);
            if (customer && customer.phone) {
                phone = customer.phone;
            }
        }

        const customerNameInput = document.getElementById('sms-customer-name');
        const phoneInput = document.getElementById('sms-phone');
        const messageInput = document.getElementById('sms-message');

        const statusText = order.status === 'ready'
            ? 'is now READY for pickup'
            : order.status === 'completed'
                ? 'has been COMPLETED'
                : `is currently ${order.status.toUpperCase()}`;

        const message = `Hi ${order.customer_name}, your laundry order #${order.id} (${order.service_type}, ${order.weight_kg} kg) ${statusText}. Total: ₱${parseFloat(order.price).toFixed(2)}. - Wash Connect`;

        customerNameInput.value = order.customer_name || '';
        phoneInput.value = phone;
        messageInput.value = message;

        const modal = document.getElementById('sms-modal');
        modal.classList.remove('hidden');
        modal.dataset.orderId = order.id;
    };

    window.closeSmsModal = () => {
        const modal = document.getElementById('sms-modal');
        modal.classList.add('hidden');
        modal.dataset.orderId = '';
    };

    window.sendSmsPrototype = () => {
        const modal = document.getElementById('sms-modal');
        const phoneInput = document.getElementById('sms-phone');
        const messageInput = document.getElementById('sms-message');

        const phone = phoneInput.value.trim();
        const msg = messageInput.value.trim();

        if (!phone) {
            showToast('Please enter a phone number (prototype only).', 'warning');
            return;
        }
        if (!msg) {
            showToast('Message is empty.', 'warning');
            return;
        }

        // Prototype only – no real SMS is sent
        showToast(`Prototype: SMS would be sent to ${phone}.`, 'info');
        modal.classList.add('hidden');
    };

    // Digital receipt prototype
    window.openReceiptModal = async (orderId) => {
        let order = allOrders.find(o => String(o.id) === String(orderId));
        
        // If order not in cache, fetch it
        if (!order) {
            try {
                const res = await fetch(`${API_URL}/orders/${orderId}`);
                if (!res.ok) {
                    showToast('Order not found for receipt', 'error');
                    return;
                }
                order = await res.json();
            } catch (err) {
                showToast('Error loading order for receipt', 'error');
                return;
            }
        }

        // Try to get customer phone
        let phone = '';
        if (Array.isArray(window.customersList)) {
            const customer = window.customersList.find(c => c.name === order.customer_name);
            if (customer && customer.phone) {
                phone = customer.phone;
            }
        }

        // Fill receipt fields
        document.getElementById('receipt-order-id').textContent = order.id;
        document.getElementById('receipt-customer-name').textContent = order.customer_name || '';
        document.getElementById('receipt-customer-phone').textContent = phone || '-';
        document.getElementById('receipt-printed-name').textContent = order.printed_name || '-';

        const date = order.created_at ? new Date(order.created_at) : new Date();
        document.getElementById('receipt-date').textContent = date.toLocaleString();

        document.getElementById('receipt-service').textContent = order.service_type;
        document.getElementById('receipt-weight').textContent = `${order.weight_kg} kg`;

        const addOnsDisplay = order.add_ons && Array.isArray(order.add_ons) && order.add_ons.length > 0
            ? order.add_ons.join(', ')
            : '-';
        document.getElementById('receipt-addons').textContent = addOnsDisplay;

        document.getElementById('receipt-price').textContent = `₱${parseFloat(order.price).toFixed(2)}`;
        document.getElementById('receipt-status').textContent = order.status;

        let paymentStatus = order.payment_status || 'unpaid';
        if (!order.payment_status && order.notes) {
            if (order.notes.includes('[PAYMENT:PAID]')) {
                paymentStatus = 'paid';
            } else if (order.notes.includes('[PAYMENT:UNPAID]')) {
                paymentStatus = 'unpaid';
            }
        }
        const paymentText = paymentStatus === 'paid' ? 'Paid' : 'Unpaid';
        document.getElementById('receipt-payment').textContent = paymentText;

        document.getElementById('receipt-modal').classList.remove('hidden');
    };

    window.closeReceiptModal = () => {
        document.getElementById('receipt-modal').classList.add('hidden');
    };
    
    // Edit Order Modal
    window.openEditOrderModal = async (orderId) => {
        try {
            const res = await fetch(`${API_URL}/orders`);
            const orders = await res.json();
            const order = orders.find(o => o.id == orderId);
            
            if (!order) {
                showToast('Order not found', 'error');
                return;
            }
            
            document.getElementById('edit-order-id').value = order.id;
            document.getElementById('edit-order-service').value = order.service_type;
            document.getElementById('edit-order-weight').value = order.weight_kg;
            document.getElementById('edit-order-notes').value = order.notes || '';
            
            // Set add-ons checkboxes
            const addOns = order.add_ons || [];
            document.getElementById('edit-addon-fabcon').checked = addOns.includes('Fabcon');
            document.getElementById('edit-addon-powder').checked = addOns.includes('Powder');
            
            document.getElementById('edit-order-modal').classList.remove('hidden');
        } catch (err) {
            showToast('Error loading order', 'error');
        }
    };
    
    window.closeEditOrderModal = () => {
        document.getElementById('edit-order-modal').classList.add('hidden');
        document.getElementById('edit-order-form').reset();
    };
    
    // Edit Order Form Submit
    document.getElementById('edit-order-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const orderId = document.getElementById('edit-order-id').value;
        const addOns = [];
        if (document.getElementById('edit-addon-fabcon').checked) addOns.push('Fabcon');
        if (document.getElementById('edit-addon-powder').checked) addOns.push('Powder');
        
        const data = {
            service_type: document.getElementById('edit-order-service').value,
            weight_kg: document.getElementById('edit-order-weight').value,
            add_ons: addOns,
            printed_name: document.getElementById('edit-order-printed-name').value,
            machine_number: document.getElementById('edit-order-machine-number').value || null,
            notes: document.getElementById('edit-order-notes').value
        };
        
        if (parseFloat(data.weight_kg) < 6) {
            showToast('Weight must be at least 6kg', 'error');
            return;
        }
        
        try {
            const res = await fetch(`${API_URL}/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await res.json();
            
            if (res.ok) {
                showToast('Order updated successfully!', 'success');
                closeEditOrderModal();
                loadOrders();
                loadDashboardData();
            } else {
                showToast(result.error || 'Failed to update order', 'error');
            }
        } catch (err) {
            showToast('Error updating order', 'error');
        }
    });
    
    // Edit Customer Modal
    window.openEditCustomerModal = async (customerId) => {
        try {
            const res = await fetch(`${API_URL}/customers`);
            const customers = await res.json();
            const customer = customers.find(c => c.id == customerId);
            
            if (!customer) {
                showToast('Customer not found', 'error');
                return;
            }
            
            document.getElementById('edit-customer-id').value = customer.id;
            document.getElementById('edit-cust-name').value = customer.name;
            document.getElementById('edit-cust-phone').value = customer.phone || '';
            document.getElementById('edit-cust-address').value = customer.address || '';
            
            document.getElementById('edit-customer-modal').classList.remove('hidden');
        } catch (err) {
            showToast('Error loading customer', 'error');
        }
    };
    
    window.closeEditCustomerModal = () => {
        document.getElementById('edit-customer-modal').classList.add('hidden');
        document.getElementById('edit-customer-form').reset();
    };
    
    // Edit Customer Form Submit
    document.getElementById('edit-customer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const customerId = document.getElementById('edit-customer-id').value;
        const data = {
            name: document.getElementById('edit-cust-name').value,
            phone: document.getElementById('edit-cust-phone').value,
            address: document.getElementById('edit-cust-address').value
        };
        
        try {
            const res = await fetch(`${API_URL}/customers/${customerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await res.json();
            
            if (res.ok) {
                showToast('Customer updated successfully!', 'success');
                closeEditCustomerModal();
                loadCustomers();
            } else {
                showToast(result.error || 'Failed to update customer', 'error');
            }
        } catch (err) {
            showToast('Error updating customer', 'error');
        }
    });
    
    // Delete Customer
    window.deleteCustomer = async (customerId, customerName) => {
        if (!confirm(`Are you sure you want to delete customer "${customerName}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const res = await fetch(`${API_URL}/customers/${customerId}`, {
                method: 'DELETE'
            });
            
            if (res.ok) {
                showToast('Customer deleted successfully', 'success');
                loadCustomers();
            } else {
                const error = await res.json();
                showToast(error.error || 'Failed to delete customer', 'error');
            }
        } catch (err) {
            showToast('Error deleting customer', 'error');
        }
    };
    
    // Close modals on outside click
    document.getElementById('edit-order-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'edit-order-modal') {
            closeEditOrderModal();
        }
    });
    
    document.getElementById('edit-customer-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'edit-customer-modal') {
            closeEditCustomerModal();
        }
    });

    // Payment filter event listener
    document.getElementById('payments-filter-status')?.addEventListener('change', () => {
        loadPayments();
    });

    document.getElementById('refresh-payments-btn')?.addEventListener('click', () => {
        loadPayments();
    });

    // Laundry status filter event listener
    document.getElementById('laundry-filter-status')?.addEventListener('change', () => {
        loadLaundryStatus();
    });

    document.getElementById('refresh-laundry-btn')?.addEventListener('click', () => {
        loadLaundryStatus();
    });

});