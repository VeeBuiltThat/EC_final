/**
 * Payment Service
 * Handles payment authorization and refunds.
 * Behaviour controlled by PAYMENT_FAIL_MODE env var: never | always | random
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const PAYMENT_FAIL_MODE = process.env.PAYMENT_FAIL_MODE || 'never';

// In-memory call log (used by /admin/logs)
const callLog = [];

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-service' });
});

// POST /payment/authorize
app.post('/payment/authorize', (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || req.body.correlationId || uuidv4();
  const { orderId, amount, currency } = req.body;

  callLog.push({
    endpoint: '/payment/authorize',
    correlationId,
    orderId,
    amount,
    currency,
    timestamp: new Date().toISOString(),
  });

  console.log(`[payment-service] authorize | correlationId=${correlationId} | orderId=${orderId} | mode=${PAYMENT_FAIL_MODE}`);

  // Idempotent Receiver: check if we've already authorized this correlationId
  const existing = callLog.find(
    e => e.endpoint === '/payment/authorize' && e.correlationId === correlationId && e.result === 'authorized'
  );
  if (existing) {
    console.log(`[payment-service] Idempotent: already authorized correlationId=${correlationId}`);
    return res.status(200).json({ status: 'authorized', transactionId: existing.transactionId, correlationId, idempotent: true });
  }

  // Decide outcome based on fail mode
  let shouldFail = false;
  if (PAYMENT_FAIL_MODE === 'always') shouldFail = true;
  else if (PAYMENT_FAIL_MODE === 'random') shouldFail = Math.random() < 0.2;

  if (shouldFail) {
    callLog[callLog.length - 1].result = 'rejected';
    return res.status(422).json({ status: 'rejected', reason: 'Payment declined', correlationId });
  }

  const transactionId = uuidv4();
  callLog[callLog.length - 1].result = 'authorized';
  callLog[callLog.length - 1].transactionId = transactionId;

  res.status(200).json({ status: 'authorized', transactionId, correlationId });
});

// POST /payment/refund
app.post('/payment/refund', (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || req.body.correlationId || uuidv4();
  const { orderId, transactionId } = req.body;

  callLog.push({
    endpoint: '/payment/refund',
    correlationId,
    orderId,
    transactionId,
    timestamp: new Date().toISOString(),
    result: 'refunded',
  });

  console.log(`[payment-service] refund | correlationId=${correlationId} | orderId=${orderId} | transactionId=${transactionId}`);

  res.status(200).json({ status: 'refunded', correlationId });
});

// Admin endpoints
app.get('/admin/logs', (req, res) => {
  res.json(callLog);
});

app.post('/admin/reset', (req, res) => {
  callLog.length = 0;
  console.log('[payment-service] Call log cleared');
  res.json({ status: 'ok', message: 'Call log cleared' });
});

app.listen(PORT, () => {
  console.log(`[payment-service] Running on port ${PORT} | PAYMENT_FAIL_MODE=${PAYMENT_FAIL_MODE}`);
});