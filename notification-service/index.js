const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "notification-service",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "notification-service-group" });

async function start() {
  await consumer.connect();
  await consumer.subscribe({
    topic: "orders-confirmed",
    fromBeginning: true,
  });

  console.log("Notification Service listening for orders-confirmed");

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value.toString();
      const event = JSON.parse(value);

      if (event.type !== "OrderConfirmed") {
        console.log("Ignoring unknown event type:", event.type);
        return;
      }

      console.log(
        `[Notification] Sending confirmation to ${event.customerName} for ` +
          `order ${event.orderId} – total: ${event.totalAmount}`
      );
    },
  });
}

start().catch(console.error);
