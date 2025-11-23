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
    // Update existing customer
    if (contact) customers[existingIndex].contact = contact;
    if (email) customers[existingIndex].email = email;
    if (address) customers[existingIndex].address = address;
    customers[existingIndex].updatedAt = new Date().toISOString();
  } else {
    // Create new customer
    customers.push({
      name: customerName,
      contact: contact || '',
      email: email || '',
      address: address || '',
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
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// Create new order
router.post('/', (req, res) => {
  try {
    const orders = readOrders();
    const { 
      customerName, contact, email, address, 
      weight, serviceType, notes,
      paymentStatus, paymentMethod, paymentDate,
      addFabcon, addPowder, fabconQuantity, powderQuantity, price
    } = req.body;

    // Validate required fields
    if (!customerName || !weight || !serviceType) {
      return res.status(400).json({ error: 'Missing required fields: customerName, weight, or serviceType' });
    }

    // Pricing: 6kg minimum, 160 pesos base
    // Additional kgs over 6kg: +20 pesos per kg
    // Maximum: 8kg
    // Additional 10 pesos per item for fabcon and/or powder if wash service
    const MIN_WEIGHT = 6;
    const MAX_WEIGHT = 8;
    const BASE_PRICE = 160;
    const ADDITIONAL_KG_PRICE = 20;
    let finalPrice = price || BASE_PRICE;
    
    const orderWeight = parseFloat(weight);
    if (isNaN(orderWeight) || orderWeight < MIN_WEIGHT || orderWeight > MAX_WEIGHT) {
      return res.status(400).json({ error: `Weight must be between ${MIN_WEIGHT}kg and ${MAX_WEIGHT}kg` });
    }
    
    // If price not provided, calculate it based on weight and quantities
    if (!price) {
      finalPrice = BASE_PRICE;
      
      // Add additional kg charges
      if (orderWeight > MIN_WEIGHT) {
        const additionalKgs = orderWeight - MIN_WEIGHT;
        finalPrice += additionalKgs * ADDITIONAL_KG_PRICE;
      }
      
      // Add wash service add-ons
      if (serviceType === 'wash') {
        const fabconQty = fabconQuantity !== undefined && fabconQuantity !== null ? parseInt(fabconQuantity) : (addFabcon ? 1 : 0);
        const powderQty = powderQuantity !== undefined && powderQuantity !== null ? parseInt(powderQuantity) : (addPowder ? 1 : 0);
        finalPrice += ((fabconQty || 0) * 10) + ((powderQty || 0) * 10);
      }
    }

    const newOrder = {
      id: Date.now().toString(),
      customerName,
      contact: contact || '',
      email: email || '',
      address: address || '',
      weight: orderWeight,
      serviceType,
      fabconQuantity: fabconQuantity !== undefined && fabconQuantity !== null ? parseInt(fabconQuantity) : (addFabcon ? 1 : 0),
      powderQuantity: powderQuantity !== undefined && powderQuantity !== null ? parseInt(powderQuantity) : (addPowder ? 1 : 0),
      addFabcon: (fabconQuantity !== undefined && fabconQuantity !== null && parseInt(fabconQuantity) > 0) || addFabcon || false, // Backward compatibility
      addPowder: (powderQuantity !== undefined && powderQuantity !== null && parseInt(powderQuantity) > 0) || addPowder || false,  // Backward compatibility
      price: parseFloat(finalPrice.toFixed(2)),
      notes: notes || '',
      status: 'pending',
      paymentStatus: paymentStatus || 'unpaid',
      paymentMethod: paymentMethod || '',
      paymentDate: paymentDate || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    orders.push(newOrder);
    writeOrders(orders);
    
    // Save customer to customers.json
    saveCustomer(customerName, contact, email, address);
    
    res.status(201).json(newOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Failed to create order: ' + error.message });
  }
});

// Update order
router.put('/:id', (req, res) => {
  const orders = readOrders();
  const index = orders.findIndex(o => o.id === req.params.id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const { 
    customerName, contact, email, address,
    weight, serviceType, notes, status,
    paymentStatus, paymentMethod, paymentDate,
    addFabcon, addPowder, fabconQuantity, powderQuantity, price
  } = req.body;
  const order = orders[index];

  // Update fields
  if (customerName !== undefined) {
    order.customerName = customerName;
    // Save customer if name changed
    saveCustomer(customerName, contact || order.contact, email || order.email, address || order.address);
  }
  if (contact !== undefined) {
    order.contact = contact;
    // Update customer contact
    if (order.customerName) {
      saveCustomer(order.customerName, contact, order.email, order.address);
    }
  }
  if (email !== undefined) {
    order.email = email;
    if (order.customerName) {
      saveCustomer(order.customerName, order.contact, email, order.address);
    }
  }
  if (address !== undefined) {
    order.address = address;
    if (order.customerName) {
      saveCustomer(order.customerName, order.contact, order.email, address);
    }
  }
  if (weight !== undefined) order.weight = parseFloat(weight);
  if (serviceType !== undefined) order.serviceType = serviceType;
  if (fabconQuantity !== undefined) {
    order.fabconQuantity = parseInt(fabconQuantity);
    order.addFabcon = order.fabconQuantity > 0; // Backward compatibility
  }
  if (powderQuantity !== undefined) {
    order.powderQuantity = parseInt(powderQuantity);
    order.addPowder = order.powderQuantity > 0; // Backward compatibility
  }
  if (addFabcon !== undefined) {
    order.addFabcon = addFabcon;
    if (order.fabconQuantity === undefined) order.fabconQuantity = addFabcon ? 1 : 0;
  }
  if (addPowder !== undefined) {
    order.addPowder = addPowder;
    if (order.powderQuantity === undefined) order.powderQuantity = addPowder ? 1 : 0;
  }
  if (notes !== undefined) order.notes = notes;
  if (status !== undefined) order.status = status;
  if (paymentStatus !== undefined) order.paymentStatus = paymentStatus;
  if (paymentMethod !== undefined) order.paymentMethod = paymentMethod;
  if (paymentDate !== undefined) order.paymentDate = paymentDate;

  // Recalculate price if weight, serviceType, or add-ons changed
  if (weight !== undefined || serviceType !== undefined || addFabcon !== undefined || addPowder !== undefined || fabconQuantity !== undefined || powderQuantity !== undefined || price !== undefined) {
    // Pricing: 6kg minimum, 160 pesos base
    // Additional kgs over 6kg: +20 pesos per kg
    // Maximum: 8kg
    const BASE_PRICE = 160;
    const ADDITIONAL_KG_PRICE = 20;
    const MIN_WEIGHT = 6;
    let finalPrice = price || BASE_PRICE;
    
    // If price not provided, calculate it based on weight and quantities
    if (!price) {
      finalPrice = BASE_PRICE;
      const orderWeight = parseFloat(order.weight);
      
      // Add additional kg charges
      if (orderWeight > MIN_WEIGHT) {
        const additionalKgs = orderWeight - MIN_WEIGHT;
        finalPrice += additionalKgs * ADDITIONAL_KG_PRICE;
      }
      
      // Add wash service add-ons
      if (order.serviceType === 'wash') {
        const fabconQty = order.fabconQuantity || (order.addFabcon ? 1 : 0);
        const powderQty = order.powderQuantity || (order.addPowder ? 1 : 0);
        finalPrice += (fabconQty * 10) + (powderQty * 10);
      }
    }
    
    order.price = parseFloat(finalPrice.toFixed(2));
  }

  order.updatedAt = new Date().toISOString();
  writeOrders(orders);
  res.json(order);
});

// Delete order
router.delete('/:id', (req, res) => {
  const orders = readOrders();
  const filteredOrders = orders.filter(o => o.id !== req.params.id);
  
  if (orders.length === filteredOrders.length) {
    return res.status(404).json({ error: 'Order not found' });
  }

  writeOrders(filteredOrders);
  res.json({ message: 'Order deleted successfully' });
});

// Get sales summary
router.get('/summary/today', (req, res) => {
  const orders = readOrders();
  const today = new Date().toISOString().split('T')[0];
  
  const todayOrders = orders.filter(order => {
    const orderDate = order.createdAt.split('T')[0];
    return orderDate === today;
  });

  const totalSales = todayOrders.reduce((sum, order) => sum + order.price, 0);
  const totalOrders = todayOrders.length;
  const completedOrders = todayOrders.filter(order => order.status === 'completed').length;
  const paidOrders = todayOrders.filter(order => order.paymentStatus === 'paid').length;
  const unpaidOrders = todayOrders.filter(order => order.paymentStatus === 'unpaid').length;

  res.json({
    totalSales: parseFloat(totalSales.toFixed(2)),
    totalOrders,
    completedOrders,
    paidOrders,
    unpaidOrders
  });
});

// Get sales report (date range)
router.get('/summary/report', (req, res) => {
  const orders = readOrders();
  const { startDate, endDate } = req.query;
  
  let filteredOrders = orders;
  
  if (startDate && endDate) {
    filteredOrders = orders.filter(order => {
      const orderDate = order.createdAt.split('T')[0];
      return orderDate >= startDate && orderDate <= endDate;
    });
  }

  const totalSales = filteredOrders.reduce((sum, order) => sum + order.price, 0);
  const totalOrders = filteredOrders.length;
  const completedOrders = filteredOrders.filter(order => order.status === 'completed').length;
  const paidOrders = filteredOrders.filter(order => order.paymentStatus === 'paid').length;
  const unpaidOrders = filteredOrders.filter(order => order.paymentStatus === 'unpaid').length;
  const pendingOrders = filteredOrders.filter(order => order.status === 'pending').length;
  const activeOrders = filteredOrders.filter(order => 
    ['pending', 'washing', 'drying', 'folded'].includes(order.status)
  ).length;

  res.json({
    startDate: startDate || null,
    endDate: endDate || null,
    totalSales: parseFloat(totalSales.toFixed(2)),
    totalOrders,
    completedOrders,
    paidOrders,
    unpaidOrders,
    pendingOrders,
    activeOrders,
    orders: filteredOrders
  });
});

module.exports = router;

