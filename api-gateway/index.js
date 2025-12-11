const express = require("express");
const path = require("path");
const { Kafka } = require("kafkajs");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());

// Serve static front-end from /public
app.use(express.static(path.join(__dirname, "public")));

const kafka = new Kafka({
  clientId: "shop-api-gateway",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();
const consumer = kafka.consumer({ groupId: "gateway-status-group" });
const admin = kafka.admin();

// In-memory order status store for demo purposes
// orderStatus[orderId] = { status: 'PLACED' | 'CONFIRMED', details: {...} }
const orderStatus = {};

async function start() {
  await ensureTopics(); 

  await producer.connect();
  console.log("API Gateway producer connected to Kafka");

  await consumer.connect();
  await consumer.subscribe({
    topic: "orders-confirmed",
    fromBeginning: true,
  });

  // Listen for OrderConfirmed events to update status
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value.toString();
      console.log("[Gateway] Received from Kafka:", value);
      const event = JSON.parse(value);

      if (event.type === "OrderConfirmed") {
        orderStatus[event.orderId] = {
          status: "CONFIRMED",
          details: event,
        };
      }
    },
  });

  app.listen(3000, () => {
    console.log("API Gateway running on http://localhost:3000");
  });
}

start().catch(console.error);

async function ensureTopics() {
  await admin.connect();
  await admin.createTopics({
    topics: [
      { topic: 'orders-placed', numPartitions: 1, replicationFactor: 1 },
      { topic: 'orders-confirmed', numPartitions: 1, replicationFactor: 1 },
    ],
    waitForLeaders: true,
  });
  await admin.disconnect();
  console.log('Ensured Kafka topics exist');
}

// POST /api/orders
// body: { customerName, items: [{ productId, quantity }] }
app.post("/api/orders", async (req, res) => {
  const { customerName, items } = req.body || {};

  if (!customerName || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "customerName and non-empty items array are required",
    });
  }

  const orderId = uuidv4();
  const event = {
    type: "OrderPlaced",
    orderId,
    customerName,
    items,
    placedAt: new Date().toISOString(),
  };

  try {
    // Initial status
    orderStatus[orderId] = {
      status: "PLACED",
      details: event,
    };

    // Publish to Kafka
    await producer.send({
      topic: "orders-placed",
      messages: [{ key: orderId, value: JSON.stringify(event) }],
    });

    // Return 202 Accepted to show async processing
    res.status(202).json({
      message: "Order placed, processing asynchronously",
      orderId,
    });
  } catch (err) {
    console.error("Error producing OrderPlaced:", err);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// GET /api/orders/:id
// Returns status if we know about this order
app.get("/api/orders/:id", (req, res) => {
  const order = orderStatus[req.params.id];
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  res.json({
    orderId: req.params.id,
    status: order.status,
    details: order.details,
  });
});
