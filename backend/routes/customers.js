const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const customersPath = path.join(__dirname, '../data/customers.json');
const ordersPath = path.join(__dirname, '../data/orders.json');

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

// Helper function to read orders
function readOrders() {
  try {
    const data = fs.readFileSync(ordersPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Get all customers
router.get('/', (req, res) => {
  const customers = readCustomers();
  res.json(customers);
});

// Get customer by name with order history
router.get('/:name', (req, res) => {
  const customers = readCustomers();
  const orders = readOrders();
  const customerName = decodeURIComponent(req.params.name);
  
  const customer = customers.find(c => c.name === customerName);
  const customerOrders = orders.filter(o => o.customerName === customerName);

  res.json({
    customer: customer || { name: customerName, contact: '' },
    orders: customerOrders
  });
});

// Create or update customer
router.post('/', (req, res) => {
  const customers = readCustomers();
  const { name, contact } = req.body;

  const existingIndex = customers.findIndex(c => c.name === name);
  
  if (existingIndex !== -1) {
    // Update existing customer
    customers[existingIndex].contact = contact || '';
    customers[existingIndex].updatedAt = new Date().toISOString();
  } else {
    // Create new customer
    customers.push({
      name,
      contact: contact || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  writeCustomers(customers);
  res.json(customers[existingIndex !== -1 ? existingIndex : customers.length - 1]);
});

module.exports = router;

