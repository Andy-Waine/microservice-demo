const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "order-service",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "order-service-group" });
const producer = kafka.producer();

const priceList = {
  "CALIFORNIA-ROLL": 5.49,
  "SPICY-TUNA-ROLL": 6.99,
  "PHILLY-ROLL": 5.99,
  "FRIED-OYSTER-ROLL": 5.99,
  "AVOCADO-ROLL": 4.99,
  "DRAGON-ROLL": 10.99,
  "MISO-SOUP": 1.99,
  "GYOZA-6PC": 4.99,
  "GREEN-TEA": 1.99,
};

async function start() {
  await producer.connect();
  await consumer.connect();

  await consumer.subscribe({
    topic: "orders-placed",
    fromBeginning: true,
  });

  console.log("Order Service listening for orders-placed");

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value.toString();
      console.log("[OrderService] Received:", value);

      const event = JSON.parse(value);
      if (event.type !== "OrderPlaced") {
        console.log("Ignoring unknown event type:", event.type);
        return;
      }

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Compute total from dummy price list
      const totalAmount = event.items.reduce((sum, item) => {
        const price = priceList[item.productId] || 10; // default price
        return sum + price * item.quantity;
      }, 0);

      const confirmedEvent = {
        type: "OrderConfirmed",
        orderId: event.orderId,
        customerName: event.customerName,
        items: event.items,
        totalAmount,
        confirmedAt: new Date().toISOString(),
      };

      await producer.send({
        topic: "orders-confirmed",
        messages: [
          {
            key: event.orderId,
            value: JSON.stringify(confirmedEvent),
          },
        ],
      });

      console.log(
        `[OrderService] Confirmed order ${event.orderId}, total = ${totalAmount}`
      );
    },
  });
}

start().catch(console.error);
