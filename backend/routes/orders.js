const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const dataPath = path.join(__dirname, '../data/orders.json');
const customersPath = path.join(__dirname, '../data/customers.json');

// Helper function to read orders
function readOrders() {
  try {
    const data = fs.readFileSync(dataPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Helper function to write orders
function writeOrders(orders) {
  fs.writeFileSync(dataPath, JSON.stringify(orders, null, 2));
}

// Helper function to read customers
function readCustomers() {
  try {
    const data = fs.readFileSync(customersPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Helper function to write customers
function writeCustomers(customers) {
  fs.writeFileSync(customersPath, JSON.stringify(customers, null, 2));
}

// Helper function to create or update customer
function saveCustomer(customerName, contact, email, address) {
  const customers = readCustomers();
  const existingIndex = customers.findIndex(c => c.name === customerName);
  
  if (existingIndex !== -1) {
    if (contact) customers[existingIndex].contact = contact;
    if (email) customers[existingIndex].email = email;
    customers[existingIndex].updatedAt = new Date().toISOString();
  } else {
    customers.push({
      name: customerName,
      contact: contact || '',
      email: email || '',
      address: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  writeCustomers(customers);
}

// Get all orders
router.get('/', (req, res) => {
  const orders = readOrders();
  res.json(orders);
});

// Get order by ID
router.get('/:id', (req, res) => {
  const orders = readOrders();
  const order = orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// Create new order
router.post('/', (req, res) => {
  try {
    const orders = readOrders();
    const { 
      customerName, contact, email, 
      weight, serviceType, notes,
      fabconQuantity, powderQuantity
    } = req.body;

    if (!customerName || !weight || !serviceType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Pricing Logic
    const MIN_WEIGHT = 6;
    const MAX_WEIGHT = 8;
    const BASE_PRICE = 160;
    const ADD_KG_PRICE = 20;
    const ADDON_PRICE = 10;
    
    const orderWeight = parseFloat(weight);
    let finalPrice = BASE_PRICE;

    // Calculate Extra Weight
    if (orderWeight > MIN_WEIGHT) {
      finalPrice += (orderWeight - MIN_WEIGHT) * ADD_KG_PRICE;
    }

    // Calculate Add-ons (Strict 10 pesos per quantity)
    const fQty = parseInt(fabconQuantity) || 0;
    const pQty = parseInt(powderQuantity) || 0;
    finalPrice += (fQty * ADDON_PRICE) + (pQty * ADDON_PRICE);

    const newOrder = {
      id: Date.now().toString(),
      customerName,
      contact: contact || '',
      email: email || '',
      weight: orderWeight,
      serviceType,
      fabconQuantity: fQty,
      powderQuantity: pQty,
      price: parseFloat(finalPrice.toFixed(2)),
      notes: notes || '',
      status: 'pending',
      paymentStatus: 'unpaid',
      paymentMethod: 'cash',
      paymentDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    orders.push(newOrder);
    writeOrders(orders);
    saveCustomer(customerName, contact, email, '');
    
    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create order: ' + error.message });
  }
});

// Update order
router.put('/:id', (req, res) => {
  const orders = readOrders();
  const index = orders.findIndex(o => o.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Order not found' });

  const order = orders[index];
  const { status, paymentStatus, paymentDate, customerName, contact, weight, serviceType, fabconQuantity, powderQuantity } = req.body;

  // Simple updates
  if (status) order.status = status;
  if (paymentStatus) order.paymentStatus = paymentStatus;
  if (paymentDate) order.paymentDate = paymentDate;
  
  // Logic to update price if details change would go here, 
  // but for now we focus on status/payment updates.
  
  order.updatedAt = new Date().toISOString();
  writeOrders(orders);
  res.json(order);
});

// Delete order
router.delete('/:id', (req, res) => {
  const orders = readOrders();
  const filtered = orders.filter(o => o.id !== req.params.id);
  writeOrders(filtered);
  res.json({ message: 'Deleted' });
});

// Summary Route
router.get('/summary/today', (req, res) => {
  const orders = readOrders();
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = orders.filter(o => o.createdAt.split('T')[0] === today);
  
  res.json({
    totalSales: todayOrders.reduce((sum, o) => sum + o.price, 0),
    totalOrders: todayOrders.length,
    completedOrders: todayOrders.filter(o => o.status === 'completed').length,
    paidOrders: todayOrders.filter(o => o.paymentStatus === 'paid').length,
    unpaidOrders: todayOrders.filter(o => o.paymentStatus === 'unpaid').length
  });
});

module.exports = router;