const express = require('express');
const cors = require('cors');
const path = require('path');
const ordersRouter = require('./routes/orders');
const customersRouter = require('./routes/customers');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Routes
app.use('/api/orders', ordersRouter);
app.use('/api/customers', customersRouter);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

