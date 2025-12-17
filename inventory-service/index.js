const { Kafka } = require("kafkajs");

const kafka = new Kafka({
  clientId: "inventory-service",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({ groupId: "inventory-service-group" });
const producer = kafka.producer();

const inventoryList = {
  "CALIFORNIA-ROLL": 2,
  "SPICY-TUNA-ROLL": 2,
  "PHILLY-ROLL": 2,
  "FRIED-OYSTER-ROLL": 2,
  "AVOCADO-ROLL": 2,
  "DRAGON-ROLL": 2,
  "MISO-SOUP": 2,
  "GYOZA-6PC": 2,
  "GREEN-TEA": 2,
}

async function start() {
  await producer.connect();
  await consumer.connect();

  await consumer.subscribe({
    topic: "inventory-changed",
    fromBeginning: true,
  });

  console.log("Inventory Service listening for inventory-changed");

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value.toString();
      console.log("[InventoryService] Received:", value);

      const event = JSON.parse(value);
      if (event.type !== "InventoryChanged") {
        console.log("Ignoring unknown event type:", event.type);
        return;
      }

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 1000));

      console.log(inventoryList)

      for (const orderItem of event.items) {
        inventoryList[orderItem.productId] -= orderItem.quantity;
        if (inventoryList[orderItem.productId] < 0) {
          console.log("Cannot fill order: not enough " + orderItem.productId);
          console.log("Sending compensating transaction to cancel order ID " + event.orderId);
          const inventoryErrorEvent = {
            type: "InventoryError",
            orderId: event.orderId,
            message: "Cannot fill order: not enough " + orderItem.productId
          };

          await producer.send({
            topic: "inventory-error",
            messages: [
              {
                key: event.orderId,
                value: JSON.stringify(inventoryErrorEvent),
              },
            ],
          });
          console.log("Compensating transaction sent: " + inventoryErrorEvent)
          return;
        }
      }

      console.log(
        `[InventoryService] Updated inventory after order ${event.orderId}, new inventory: ${JSON.stringify(inventoryList)}`
      );
    },
  });
}

start().catch(console.error);
