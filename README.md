# Sushi Restaurant Kafka Microservices Demo

A simple microservice architecture demo using Node.js, Kafka,
and a small front-end UI.

## User Flow

1. The front-end sends an order request to the API Gateway when the user clicks Place Order.

2. The API Gateway doesn’t process the order itself—instead, it publishes an OrderPlaced event to Kafka.

3. Kafka delivers that event to any service interested in it, allowing services to stay loosely coupled.

4. The Order Service consumes the OrderPlaced event, calculates the order total, and then publishes an OrderConfirmed event back to Kafka.

5. The Notification Service consumes the OrderConfirmed event and logs a simulated email or notification.

6. The API Gateway also listens for OrderConfirmed, updating its in-memory order status so the front-end can display the order’s progress to the user.

## Services

**API Gateway (port 3000)**

- Serves the front-end UI
- Accepts orders
- Publishes `OrderPlaced` events
- Tracks order status when `OrderConfirmed` events arrive

**Order Service**

- Consumes `OrderPlaced`
- Calculates totals
- Publishes `OrderConfirmed`

**Notification Service**

- Consumes `OrderConfirmed`
- Logs a fake email/notification

**Kafka Broker (port 9092)**

- Message bus connecting all services

## Prerequisites

- Node.js 18+
- Docker Desktop

## How to Run

### 1. Start Kafka (from project root)

    Ensure Docker Desktop is running
    docker compose up -d

### 2. Start API Gateway

    cd api-gateway
    npm install
    npm start

Runs at:
http://localhost:3000

### 3. Start Order Service

    cd ../order-service
    npm install
    npm start

### 4. Start Notification Service

    cd ../notification-service
    npm install
    npm start

## How It Works

1.  Open http://localhost:3000
2.  Click _Place Order_
3.  API Gateway publishes an `OrderPlaced` event to Kafka
4.  Order Service consumes the event, computes total, and publishes
    `OrderConfirmed`
5.  Notification Service consumes `OrderConfirmed` and logs a mock
    email
6.  API Gateway listens for `OrderConfirmed` and updates order status\
7.  UI polls `/api/orders/:id` to show status changing from `PLACED` →
    `CONFIRMED`

## Project Structure

    shop-microservices-demo/
      docker-compose.yml

      api-gateway/
        index.js
        package.json
        public/
          index.html

      order-service/
        index.js
        package.json

      notification-service/
        index.js
        package.json

## Stopping Everything

    docker compose down

Stop each Node service with `Ctrl+C`.

## Notes

- Kafka auto-creates required topics: `orders-placed`,
  `orders-confirmed`\
- Order status is stored in memory inside the API Gateway for demo
  purposes
