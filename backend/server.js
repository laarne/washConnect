const express = require('express');
const cors = require('cors');
const path = require('path');
const ordersRouter = require('./routes/orders');
const customersRouter = require('./routes/customers');

const app = express();
// CHANGE: Use process.env.PORT for Render, fallback to 3000 for localhost
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the "frontend" folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/orders', ordersRouter);
app.use('/api/customers', customersRouter);

// Serve the HTML file for any request that isn't an API call
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});