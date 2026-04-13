/**
 * Order Service
 * Architecture: Option A — Node-RED is the entry point.
 * This service is called BY Node-RED to create and retrieve order records.
 * It does NOT orchestrate downstream services.
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

// In-memory order store
const orders = new Map();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

// POST /orders — create a new order record
app.post('/orders', (req, res) => {
  const orderId = 'ord-' + uuidv4().replace(/-/g, '').slice(0, 8);
  const correlationId = req.headers['x-correlation-id'] || uuidv4();

  const order = {
    orderId,
    correlationId,
    ...req.body,
    receivedAt: new Date().toISOString(),
    status: 'received',
  };

  orders.set(orderId, order);
  console.log(`[order-service] Created order ${orderId} (correlationId: ${correlationId})`);

  res.status(201).json({ orderId, correlationId, status: 'received' });
});

// PATCH /orders/:id — update order status (called by Node-RED after orchestration)
app.patch('/orders/:id', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  Object.assign(order, req.body);
  orders.set(req.params.id, order);
  console.log(`[order-service] Updated order ${req.params.id} → status: ${req.body.status}`);
  res.json(order);
});

// GET /orders/:id — retrieve order by ID
app.get('/orders/:id', (req, res) => {
  const order = orders.get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

app.listen(PORT, () => {
  console.log(`[order-service] Running on port ${PORT}`);
});