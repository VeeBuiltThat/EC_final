# Capstone: Orchestrated Enterprise Application Integration System

## Enterprise Application Integration

---

## This Is the Capstone

Everything you built in the three practices comes together here.

| Practice | What you learned |
|---|---|
| Practice 1 | Node-RED routing, transformation, Canonical Data Model |
| Practice 2 | RabbitMQ pub/sub, Correlation ID, DLQ, Idempotency |
| Practice 3 | Orchestration, Saga compensation, timeout handling |
| **Capstone** | **All of the above — in one coherent system** |

This is your most important deliverable of the course.

---

## What You Will Build

A complete enterprise integration system with **5 components**:

1. An **Order Service** — receives and records orders
2. A **Payment Service** — authorizes and refunds payments
3. An **Inventory Service** — reserves and releases stock
4. A **Notification Service** — sends notifications *(pre-built, you call it)*
5. A **Node-RED integration layer** — orchestrates the entire process

**Node-RED is not just a flow tool here — it is the integration bus.**

---

## Business Scenario

An e-commerce company must process orders across four independent services.

The services:
- Do **not** share a database
- Communicate **only** via APIs or messages
- Are **autonomous** — each can fail independently

**Your job:** design and implement the integration layer that coordinates them.

---

## The Business Process

```
Customer places order
       │
       ▼
[1] Payment authorized?  ──NO──► Return "failed"
       │ YES
       ▼
[2] Inventory reserved?  ──NO──► Refund payment ──► Return "compensated"
       │ YES
       ▼
[3] Notification sent
       │
       ▼
  Return "completed"
```

Every step carries the same **Correlation ID** so the full lifecycle is traceable.

---

## What Is Provided vs. What You Build

```
capstone-integration/
├── docker-compose.yml          ← Infrastructure ready to go
├── Dockerfile.nodered          ← Node-RED + RabbitMQ nodes pre-installed
├── flows.json                  ← 3-tab skeleton (stub nodes, no wiring)
├── notification-service/       ← PRE-BUILT MOCK — just call it
├── payment-service/server.js   ← YOU IMPLEMENT (TODOs inside)
├── inventory-service/server.js ← YOU IMPLEMENT (TODOs inside)
├── order-service/server.js     ← YOU IMPLEMENT (TODOs inside)
├── test-data/                  ← Same orders you used in Practice 1
├── canonical-schema.json       ← Same schema from Practice 1
└── GRADING.md                  ← The rubric used to grade your submission
```

---

## Node-RED Has Three Tabs

The starter `flows.json` gives you this structure:

| Tab | Purpose |
|---|---|
| **Orchestration** | Happy path: intake → route → payment → inventory → notification → response |
| **Error Handling** | Compensation: release inventory → refund payment → Dead Letter Channel |
| **Admin** | Health check (already wired) + debug trace endpoint |

**The tabs are empty stubs. You wire them.**

---

## Architecture Decision: Where Does the Request Enter?

You must choose **one** approach and justify it in your architecture diagram.

### Option A — Node-RED is the entry point
```
Client ──► POST /order (Node-RED) ──► Order Service (record)
                                  ──► Payment Service
                                  ──► Inventory Service
                                  ──► Notification Service
```

### Option B — Order Service is the entry point
```
Client ──► POST /orders (Order Service) ──► triggers Node-RED
                                          ──► Node-RED orchestrates the rest
```

Both are architecturally valid. One choice, documented and justified.

---

## Service APIs You Must Implement

### Order Service
- `GET /health`
- `POST /orders` → `{ orderId, correlationId, status: "received" }`
- `GET /orders/:id`

### Payment Service
- `POST /payment/authorize` → `{ status: "authorized" | "rejected", transactionId }`
- `POST /payment/refund` → `{ status: "refunded" }`

### Inventory Service
- `POST /inventory/reserve` → `{ status: "reserved" | "unavailable", reservationId }`
- `POST /inventory/release` → `{ status: "released" }`

---

## The Notification Service Is Pre-Built

You **do not implement** it. You **call** it.

```
POST http://notification-service:3004/notification/send
```

```json
{
  "correlationId": "550e8400-...",
  "orderId": "WEB-2024-001",
  "type": "order_confirmed",
  "message": "Your order has been processed."
}
```

Response: `{ "status": "sent" }`

---

## Required Response Format

Every orchestration call must return this structure:

```json
{
  "orderId": "WEB-2024-001",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "trace": [
    { "step": "payment",   "status": "success", "durationMs": 120 },
    { "step": "inventory", "status": "success", "durationMs": 85 },
    { "step": "notification", "status": "success", "durationMs": 44 }
  ]
}
```

**On compensation**, the trace must include the rollback steps:

```json
{ "step": "compensation:payment-refund", "status": "success" }
```

---

## Required EIP Patterns — Minimum 4

You must apply **4 named EIP patterns** from **at least 3 of these 4 categories**:

| Category | Required | Example patterns |
|---|---|---|
| **Routing & Flow** | YES | Content-Based Router, Recipient List |
| **Reliability** | YES | Dead Letter Channel, Idempotent Receiver |
| **Coordination** | YES | Correlation Identifier, Request-Reply |
| Transformation & Data | Bonus | Message Translator, Canonical Data Model |

Each pattern must be:
- **Correctly implemented** — not just named
- **Documented** in your Pattern Mapping Table

---

## Pattern Mapping Table (Required in README)

Add this to your README and fill it in:

| Pattern | Problem It Solves | Where Applied | Why Chosen |
|---|---|---|---|
| Content-Based Router | | | |
| Correlation Identifier | | | |
| Dead Letter Channel | | | |
| *(your 4th pattern)* | | | |

Patterns named but not implemented → **0 points** for that pattern.

---

## Failure Scenarios — You Must Demonstrate 2

### Scenario 1: Payment Rejection

Set `PAYMENT_FAIL_MODE=always` → restart payment-service → send order.

**Expected:**
- Response `status: "failed"`
- Inventory log is **empty** (not called)
- Notification log is **empty** (not called)

### Scenario 2: Inventory Failure (triggers compensation)

Set `INVENTORY_FAIL_MODE=always` → restart inventory-service → send order.

**Expected:**
- Payment refund is **called** (compensation)
- Response `status: "compensated"`
- Compensation steps appear in `trace`

---

## Compensation Must Be in Reverse Order

```
Steps completed:   Payment ✓ → Inventory ✗
                                    │
Compensation:               Refund Payment ← (reverse order)
```

```
Steps completed:   Payment ✓ → Inventory ✓ → Notification ✗
                                                    │
Compensation:      Release Inventory ← Refund Payment ← (reverse order)
```

**Wrong order = partial credit only.**

---

## Architecture Integrity Rules

These are hard requirements — violations cost full criterion points:

| Rule | What it means |
|---|---|
| No shared database | Services use only their own memory/files. No shared volume as a data bus. |
| No direct coupling | `payment-service` and `inventory-service` must not call each other. All coordination goes through Node-RED. |
| No monolithic function node | The Content-Based Router must use a switch node or separate routing nodes — not a single giant function node. |
| Environment-driven config | No hardcoded `http://localhost:3002` in service code. Use `process.env.PAYMENT_URL`. |

---

## Required Deliverables

### Code
- [ ] `order-service/server.js` — fully implemented
- [ ] `payment-service/server.js` — fully implemented
- [ ] `inventory-service/server.js` — fully implemented
- [ ] `flows.json` — all 3 tabs wired (Orchestration + Error Handling + Admin)

### Documentation (in `docs/` or inline Mermaid in README)
- [ ] **System Context Diagram** — all services, integration layer, client, labeled arrows, error paths
- [ ] **Integration Architecture Diagram** — message flows, protocols, error/DLQ paths
- [ ] **Orchestration Flow** — success path + at least 2 compensation paths

### README
- [ ] Architecture decision (entry point choice + justification, 1 paragraph)
- [ ] Pattern Mapping Table (≥4 patterns, all 4 columns filled)
- [ ] Failure Analysis (≥2 scenarios: what fails → system reaction → final state)
- [ ] AI usage disclosure

---

## How to Run

```bash
# Start everything
cp .env.example .env
docker compose up -d --build

# Open Node-RED editor
# → http://localhost:1880

# Health check all services
curl http://localhost:1880/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
```

**Inside Node-RED, use service names — not localhost:**
```
http://payment-service:3002
http://inventory-service:3003
http://notification-service:3004
```

---

## How to Test

```bash
# Send a standard order
curl -X POST http://localhost:1880/order \
  -H "Content-Type: application/json" \
  -d @test-data/web-order.json

# Check notification was triggered
curl http://localhost:3004/admin/logs

# Reset between tests
curl -X POST http://localhost:3002/admin/reset
curl -X POST http://localhost:3003/admin/reset
curl -X POST http://localhost:3004/admin/reset
```

---

## Grading — 100 Points + 15 Bonus

| Section | Points |
|---|---:|
| Infrastructure — all services boot, Node-RED loads | 10 |
| Architecture Diagrams — 3 required diagrams complete | 20 |
| EIP Pattern Application — table + CBR + correlation + DLC | 25 |
| Compensation & Business Logic — happy path + 2 failure scenarios | 25 |
| Architecture Integrity — no shared DB, no direct coupling | 10 |
| Code & Documentation Quality — env config, failure analysis, AI disclosure | 10 |
| **Total** | **100** |
| **Bonus: RabbitMQ Integration** | **+15** |

Grading is performed by the instructor using `GRADING.md`.

---

## Bonus: RabbitMQ Integration (+15 points)

Uncomment `rabbitmq` in `docker-compose.yml` and:

1. Connect Node-RED to RabbitMQ via `amqp-in` / `amqp-out` nodes *(already installed)*
2. Have at least one service communicate via AMQP instead of HTTP
3. Configure a Dead Letter Queue — trigger a failure, verify the message lands there
4. Use a fanout exchange so at least 2 consumers receive the same event

Management UI: `http://localhost:15672` (guest / guest)

---

## Common Mistakes — Don't Lose Easy Points

| Mistake | Cost |
|---|---|
| All orchestration in one Function node | CBR criterion → 0 pts |
| Pattern named but wrongly implemented | Pattern table → 0 pts for that entry |
| Services calling each other directly | Architecture integrity → 0 pts |
| `correlationId` regenerated per service | Correlation criterion → 0 pts |
| Compensation in wrong order | Partial credit only |
| Hardcoded `http://localhost:3002` in code | Config criterion → 0 pts |
| `status: "compensated"` when compensation failed silently | Observable compensation → 0 pts |
| Diagrams show only happy path, no error paths | Diagram criteria → half pts |

---

## Deadline

**25.03.2026**

Submit your public GitHub repository URL to: **martins.leitass@turiba.lv**

---

## Questions?