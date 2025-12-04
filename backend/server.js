const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// --- CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- SUPABASE CONNECTION ---
// On Render, set SUPABASE_URL and SUPABASE_SERVICE_ROLE (or anon key) as environment variables.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('Supabase environment variables are not fully configured. Please set SUPABASE_URL and SUPABASE_KEY.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// --- PRICING CONFIGURATION (PESOS) ---
const PRICING = {
    'Wash & Fold': 160, // Base price for first 6kg
    'Wash & Iron': 200, // Base price for first 6kg
    'Dry Clean': 250    // Base price for first 6kg
};

const EXCESS_RATE = 20; // 20 Pesos per additional kg
const MIN_WEIGHT = 6;   // Minimum kilos
const ADDON_PRICE = 10; // Price per add-on

// --- API ENDPOINTS ---

/**
 * LOGIN
 */
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    
   

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

    if (error || !data) {
        return res.status(401).json({ error: "Invalid credentials" });
    }
    res.json({ success: true, user: data });
});

/**
 * CUSTOMERS
 */
app.get('/api/customers', async (req, res) => {
    const { search } = req.query;
    let query = supabase.from('customers').select('*').order('name');

    if (search) {
        query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/customers', async (req, res) => {
    const { name, phone, address } = req.body;
    const { data, error } = await supabase
        .from('customers')
        .insert([{ name, phone, address }])
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// Update customer (frontend used PUT)
app.put('/api/customers/:id', async (req, res) => {
    const { id } = req.params;
    const { name, phone, address } = req.body;

    try {
        const { data, error } = await supabase
            .from('customers')
            .update({ name, phone, address })
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete customer
app.delete('/api/customers/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * ORDERS (With New Calculation Logic)
 */
app.get('/api/orders', async (req, res) => {
    const { data, error } = await supabase
        .from('orders')
        .select('*, customer:customers(name)')
        .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const formatted = data.map(o => ({
        ...o,
        customer_name: o.customer?.name || 'Unknown'
    }));

    res.json(formatted);
});

// Get orders by payment status (for Payment Management view) - MUST be before /api/orders/:id
app.get('/api/orders/payments', async (req, res) => {
    const { payment_status } = req.query;
    
    let query = supabase
        .from('orders')
        .select('*, customer:customers(name)')
        .order('created_at', { ascending: false });

    if (payment_status) {
        if (payment_status === 'unpaid') {
            query = query.or('payment_status.is.null,payment_status.eq.unpaid');
        } else {
            query = query.eq('payment_status', payment_status);
        }
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const formatted = data.map(o => ({
        ...o,
        customer_name: o.customer?.name || 'Unknown'
    }));

    res.json(formatted);
});

// Get orders by laundry status (for Laundry Status view) - MUST be before /api/orders/:id
app.get('/api/orders/status', async (req, res) => {
    const { status } = req.query;
    
    let query = supabase
        .from('orders')
        .select('*, customer:customers(name)')
        .order('created_at', { ascending: false });

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });

    const formatted = data.map(o => ({
        ...o,
        customer_name: o.customer?.name || 'Unknown'
    }));

    res.json(formatted);
});

// Get single order by id (frontend expects this) - MUST be after specific routes
app.get('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*, customer:customers(name)')
            .eq('id', id)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const formatted = {
            ...data,
            customer_name: data.customer?.name || 'Unknown'
        };

        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    const { customer_id, service_type, weight_kg, notes, add_ons, printed_name, machine_number } = req.body;
    
    // 1. Get Base Price
    const basePrice = PRICING[service_type] || 0;
    
    // 2. Calculate Excess Weight Price
    const weight = parseFloat(weight_kg);
    let excessCost = 0;
    if (weight > MIN_WEIGHT) {
        excessCost = (weight - MIN_WEIGHT) * EXCESS_RATE;
    }

    // 3. Calculate Add-ons Price
    let addonsCost = 0;
    if (add_ons && Array.isArray(add_ons)) {
        addonsCost = add_ons.length * ADDON_PRICE;
    }

    // 4. Total
    const totalPrice = basePrice + excessCost + addonsCost;

    const { data, error } = await supabase
        .from('orders')
        .insert([{ 
            customer_id, 
            service_type, 
            weight_kg, 
            price: totalPrice, 
            notes,
            add_ons: add_ons, // Saves ["Fabcon", "Powder"] etc.
            printed_name: printed_name || null, // Name to print on label
            machine_number: machine_number || null, // Machine tracking
            status: 'pending',
            payment_status: null,
            paid_amount: null
        }])
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

// Update order status (existing)
app.patch('/api/orders/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Update machine number
app.patch('/api/orders/:id/machine', async (req, res) => {
    const { id } = req.params;
    const { machine_number } = req.body;

    const { data, error } = await supabase
        .from('orders')
        .update({ machine_number: machine_number || null })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Update whole order (frontend used PUT) - recalculates price
app.put('/api/orders/:id', async (req, res) => {
    const { id } = req.params;
    const { service_type, weight_kg, add_ons, notes, printed_name, machine_number } = req.body;

    try {
        const basePrice = PRICING[service_type] || 0;
        const weight = parseFloat(weight_kg);
        let excessCost = 0;
        if (weight > MIN_WEIGHT) {
            excessCost = (weight - MIN_WEIGHT) * EXCESS_RATE;
        }
        const addonsCost = (add_ons && Array.isArray(add_ons)) ? add_ons.length * ADDON_PRICE : 0;
        const totalPrice = basePrice + excessCost + addonsCost;

        const { data, error } = await supabase
            .from('orders')
            .update({
                service_type,
                weight_kg,
                add_ons,
                notes,
                printed_name: printed_name || null,
                machine_number: machine_number || null,
                price: totalPrice
            })
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Payment endpoint if frontend calls /orders/:id/payment
app.patch('/api/orders/:id/payment', async (req, res) => {
    const { id } = req.params;
    // Accept payment_status, paid_amount, payment_method (optional)
    const { payment_status, paid_amount, payment_method } = req.body;

    try {
        const updatePayload = {};
        if (payment_status !== undefined) updatePayload.payment_status = payment_status;
        if (paid_amount !== undefined) updatePayload.paid_amount = paid_amount;
        if (payment_method !== undefined) updatePayload.payment_method = payment_method;

        const { data, error } = await supabase
            .from('orders')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * ANALYTICS
 */
app.get('/api/analytics/summary', async (req, res) => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

    const { data: orders, error } = await supabase
        .from('orders')
        .select('created_at, price, status')
        .gte('created_at', startOfMonth);

    if (error) return res.status(500).json({ error: error.message });

    let stats = {
        today: { orders: 0, income: 0 },
        month: { orders: 0, income: 0 },
        statusCounts: { pending: 0, washing: 0, ready: 0, completed: 0, cancelled: 0 }
    };

    const now = new Date();
    const startOfDay = new Date(now.setHours(0,0,0,0));

    orders.forEach(order => {
        const orderDate = new Date(order.created_at);
        const isToday = orderDate >= startOfDay;
        const isBillable = order.status !== 'cancelled';

        stats.month.orders++;
        if (isBillable) stats.month.income += order.price;

        if (isToday) {
            stats.today.orders++;
            if (isBillable) stats.today.income += order.price;
        }

        if (stats.statusCounts[order.status] !== undefined) {
            stats.statusCounts[order.status]++;
        }
    });

    res.json(stats);
});

/**
 * REPORTS
 */
app.get('/api/reports', async (req, res) => {
    const { type, startDate, endDate } = req.query;

    if (!type) {
        return res.status(400).json({ error: "Report type is required" });
    }

    let start;
    let end;
    const now = new Date();

    switch (type) {
        case 'weekly':
            end = new Date();
            start = new Date();
            start.setDate(start.getDate() - 7);
            break;
        case 'monthly':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date();
            break;
        case 'custom':
            if (!startDate || !endDate) {
                return res.status(400).json({ error: "Start date and end date are required for custom reports" });
            }
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            break;
        default:
            return res.status(400).json({ error: "Invalid report type. Use 'weekly', 'monthly', or 'custom'." });
    }

    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*, customer:customers(name)')
            .gte('created_at', start.toISOString())
            .lte('created_at', end.toISOString())
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        const totalSales = orders
            .filter(order => order.status !== 'cancelled')
            .reduce((sum, order) => sum + (parseFloat(order.price) || 0), 0);

        const totalOrders = orders.length;

        const statusCounts = {
            pending: 0,
            washing: 0,
            ready: 0,
            completed: 0,
            cancelled: 0
        };

        orders.forEach(order => {
            if (statusCounts[order.status] !== undefined) {
                statusCounts[order.status]++;
            }
        });

        const formattedOrders = orders.map(order => ({
            ...order,
            customer_name: order.customer?.name || 'Unknown'
        }));

        const dailySales = {};
        orders
            .filter(order => order.status !== 'cancelled')
            .forEach(order => {
                const orderDate = new Date(order.created_at);
                const year = orderDate.getFullYear();
                const month = String(orderDate.getMonth() + 1).padStart(2, '0');
                const day = String(orderDate.getDate()).padStart(2, '0');
                const key = `${year}-${month}-${day}`;

                if (!dailySales[key]) {
                    dailySales[key] = 0;
                }
                dailySales[key] += parseFloat(order.price) || 0;
            });

        const allDates = [];
        const cursor = new Date(start);
        cursor.setHours(0, 0, 0, 0);
        const endDay = new Date(end);
        endDay.setHours(0, 0, 0, 0);

        while (cursor <= endDay) {
            const year = cursor.getFullYear();
            const month = String(cursor.getMonth() + 1).padStart(2, '0');
            const day = String(cursor.getDate()).padStart(2, '0');
            allDates.push(`${year}-${month}-${day}`);
            cursor.setDate(cursor.getDate() + 1);
        }

        const chartData = {
            labels: allDates,
            values: allDates.map(date => dailySales[date] || 0)
        };

        res.json({
            type,
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            totalSales,
            totalOrders,
            statusCounts,
            orders: formattedOrders,
            chartData
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Fallback route so direct navigation works when deployed
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
