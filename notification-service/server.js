/**
 * Notification Service — Pre-Built Mock
 *
 * This service is provided for you. DO NOT MODIFY IT.
 *
 * It simulates a notification system that logs outbound notifications
 * and exposes admin endpoints for grading verification.
 *
 * Endpoints:
 *   GET  /health              — health check
 *   POST /notification/send   — accept and log a notification
 *   GET  /admin/logs          — read all logged notifications (used for grading)
 *   POST /admin/reset         — clear the notification log
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3004;
const LOG_FILE = '/data/notification.log';

// Ensure /data directory exists
try {
  fs.mkdirSync('/data', { recursive: true });
} catch (_) {}

// ─────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

// ─────────────────────────────────────────────
// POST /notification/send
//
// Accepts a notification payload and appends it to the log file.
// Expected body (flexible — any JSON is accepted):
//   { correlationId, orderId, type, message, ... }
//
// The correlationId is read from the request body OR from the
// X-Correlation-Id header — whichever is present.
// ─────────────────────────────────────────────
app.post('/notification/send', (req, res) => {
  const correlationId =
    req.body.correlationId ||
    req.headers['x-correlation-id'] ||
    null;

  const entry = {
    ...req.body,
    correlationId,
    receivedAt: new Date().toISOString(),
  };

  // Append one JSON object per line (JSON Lines format)
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    console.error('Failed to write notification log:', err.message);
    return res.status(500).json({ status: 'error', message: 'Log write failed' });
  }

  console.log(`[notification-service] Notification sent | correlationId=${correlationId}`);
  res.json({ status: 'sent', correlationId });
});

// ─────────────────────────────────────────────
// GET /admin/logs
//
// Returns all logged notifications as a JSON array.
// Used by the grading instructor to verify notifications were triggered.
// ─────────────────────────────────────────────
app.get('/admin/logs', (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return res.json([]);
    }
    const raw = fs.readFileSync(LOG_FILE, 'utf8').trim();
    if (!raw) return res.json([]);
    const entries = raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read log', message: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /admin/reset
//
// Clears the notification log. Used between grading scenarios.
// ─────────────────────────────────────────────
app.post('/admin/reset', (req, res) => {
  try {
    fs.writeFileSync(LOG_FILE, '');
    console.log('[notification-service] Log cleared');
    res.json({ status: 'ok', message: 'Log cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear log', message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[notification-service] Running on port ${PORT}`);
});
