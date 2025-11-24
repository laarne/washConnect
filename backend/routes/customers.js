const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const customersPath = path.join(__dirname, '../data/customers.json');
const ordersPath = path.join(__dirname, '../data/orders.json');

// --- Helpers ---
function readCustomers() {
    try { return JSON.parse(fs.readFileSync(customersPath, 'utf8')); } 
    catch (e) { return []; }
}
function writeCustomers(data) {
    fs.writeFileSync(customersPath, JSON.stringify(data, null, 2));
}
function readOrders() {
    try { return JSON.parse(fs.readFileSync(ordersPath, 'utf8')); } 
    catch (e) { return []; }
}

// --- Routes ---

// 1. Get All Customers
router.get('/', (req, res) => {
    res.json(readCustomers());
});

// 2. Update Customer (Contact/Email only)
router.put('/:name', (req, res) => {
    const customers = readCustomers();
    const targetName = decodeURIComponent(req.params.name);
    const { contact, email } = req.body;

    const index = customers.findIndex(c => c.name === targetName);
    if (index !== -1) {
        customers[index].contact = contact;
        customers[index].email = email;
        writeCustomers(customers);
        res.json(customers[index]);
    } else {
        res.status(404).json({ error: "Customer not found" });
    }
});

// 3. Delete Customer
router.delete('/:name', (req, res) => {
    const customers = readCustomers();
    const targetName = decodeURIComponent(req.params.name);
    
    const newCustomers = customers.filter(c => c.name !== targetName);
    
    if (customers.length === newCustomers.length) {
        return res.status(404).json({ error: "Customer not found" });
    }

    writeCustomers(newCustomers);
    res.json({ message: "Customer deleted" });
});

module.exports = router;