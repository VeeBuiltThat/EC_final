/**
 * Inventory Service
 * Handles stock reservation and release.
 * Behaviour controlled by INVENTORY_FAIL_MODE env var: never | always | random
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;
const INVENTORY_FAIL_MODE = process.env.INVENTORY_FAIL_MODE || 'never';

// In-memory call log (used by /admin/logs)
const callLog = [];

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inventory-service' });
});

// POST /inventory/reserve
app.post('/inventory/reserve', (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || req.body.correlationId || uuidv4();
  const { orderId, items } = req.body;

  callLog.push({
    endpoint: '/inventory/reserve',
    correlationId,
    orderId,
    items,
    timestamp: new Date().toISOString(),
  });

  console.log(`[inventory-service] reserve | correlationId=${correlationId} | orderId=${orderId} | mode=${INVENTORY_FAIL_MODE}`);

  // Idempotent Receiver: check if already reserved for this correlationId
  const existing = callLog.find(
    e => e.endpoint === '/inventory/reserve' && e.correlationId === correlationId && e.result === 'reserved'
  );
  if (existing) {
    console.log(`[inventory-service] Idempotent: already reserved correlationId=${correlationId}`);
    return res.status(200).json({ status: 'reserved', reservationId: existing.reservationId, correlationId, idempotent: true });
  }

  // Decide outcome based on fail mode
  let shouldFail = false;
  if (INVENTORY_FAIL_MODE === 'always') shouldFail = true;
  else if (INVENTORY_FAIL_MODE === 'random') shouldFail = Math.random() < 0.1;

  if (shouldFail) {
    callLog[callLog.length - 1].result = 'unavailable';
    return res.status(422).json({ status: 'unavailable', reason: 'Insufficient stock', correlationId });
  }

  const reservationId = uuidv4();
  callLog[callLog.length - 1].result = 'reserved';
  callLog[callLog.length - 1].reservationId = reservationId;

  res.status(200).json({ status: 'reserved', reservationId, correlationId });
});

// POST /inventory/release
app.post('/inventory/release', (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || req.body.correlationId || uuidv4();
  const { orderId, reservationId } = req.body;

  callLog.push({
    endpoint: '/inventory/release',
    correlationId,
    orderId,
    reservationId,
    timestamp: new Date().toISOString(),
    result: 'released',
  });

  console.log(`[inventory-service] release | correlationId=${correlationId} | orderId=${orderId} | reservationId=${reservationId}`);

  res.status(200).json({ status: 'released', correlationId });
});

// Admin endpoints
app.get('/admin/logs', (req, res) => {
  res.json(callLog);
});

app.post('/admin/reset', (req, res) => {
  callLog.length = 0;
  console.log('[inventory-service] Call log cleared');
  res.json({ status: 'ok', message: 'Call log cleared' });
});

app.listen(PORT, () => {
  console.log(`[inventory-service] Running on port ${PORT} | INVENTORY_FAIL_MODE=${INVENTORY_FAIL_MODE}`);
});