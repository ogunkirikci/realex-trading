import { Order, OrderBook } from '../interfaces/Order';
import { redisService } from './redis';
import { rabbitMQService } from './rabbitmq';
import { logger } from '../config/logger';
import { Server } from 'socket.io';

class OrderBookService {
  private orderBooks: Map<string, OrderBook>;
  private static instance: OrderBookService;
  private io?: Server;

  private constructor() {
    this.orderBooks = new Map<string, OrderBook>();
  }

  public static getInstance(): OrderBookService {
    if (!OrderBookService.instance) {
      OrderBookService.instance = new OrderBookService();
    }
    return OrderBookService.instance;
  }

  public initializePair(pair: string): void {
    if (!this.orderBooks.has(pair)) {
      this.orderBooks.set(pair, {
        bids: [],
        asks: []
      });
    }
  }

  public async getOrderBook(pair: string): Promise<OrderBook | undefined> {
    try {
      // Try to get from Redis first
      const cachedOrderBook = await redisService.get(`orderbook:${pair}`);
      if (cachedOrderBook) {
        return JSON.parse(cachedOrderBook);
      }
      
      return this.orderBooks.get(pair);
    } catch (error) {
      logger.error('Error getting orderbook:', error);
      return this.orderBooks.get(pair);
    }
  }

  public setSocketIO(io: Server) {
    this.io = io;
  }

  public async addOrder(pair: string, order: Order, type: 'bid' | 'ask'): Promise<void> {
    try {
      const orderBook = this.orderBooks.get(pair);
      if (!orderBook) {
        throw new Error('Invalid pair');
      }

      if (type === 'bid') {
        orderBook.bids.push(order);
        orderBook.bids.sort((a, b) => b.price - a.price);
      } else {
        orderBook.asks.push(order);
        orderBook.asks.sort((a, b) => a.price - b.price);
      }

      // Immediately broadcast update to all clients
      if (this.io) {
        this.io.to(pair).emit('orderBookUpdate', {
          pair,
          orderBook: {
            bids: [...orderBook.bids],
            asks: [...orderBook.asks]
          },
          timestamp: Date.now()
        });
      }

      // Cache in Redis
      try {
        await redisService.set(`orderbook:${pair}`, JSON.stringify(orderBook));
      } catch (error) {
        logger.warn('Failed to cache orderbook:', error);
      }

      // Publish to RabbitMQ
      try {
        await rabbitMQService.publishMessage('order_updates', '', {
          pair,
          type: 'orderBookUpdate',
          data: orderBook,
          timestamp: Date.now()
        });
      } catch (error) {
        logger.warn('Failed to publish orderbook update:', error);
      }
    } catch (error) {
      logger.error('Error adding order:', error);
      throw error;
    }
  }

  public async matchOrders(pair: string): Promise<void> {
    const orderBook = this.orderBooks.get(pair);
    if (!orderBook) return;

    while (orderBook.bids.length > 0 && orderBook.asks.length > 0) {
      const topBid = orderBook.bids[0];
      const topAsk = orderBook.asks[0];

      if (topBid.price >= topAsk.price) {
        const matchedQuantity = Math.min(topBid.quantity, topAsk.quantity);
        
        const trade = {
          pair,
          price: topAsk.price,
          quantity: matchedQuantity,
          timestamp: Date.now()
        };

        // Broadcast trade to all clients
        if (this.io) {
          this.io.to(pair).emit('trade', trade);
        }

        // Update quantities
        topBid.quantity -= matchedQuantity;
        topAsk.quantity -= matchedQuantity;

        // Remove completed orders
        if (topBid.quantity === 0) orderBook.bids.shift();
        if (topAsk.quantity === 0) orderBook.asks.shift();

        // Update cache
        try {
          await redisService.set(`orderbook:${pair}`, JSON.stringify(orderBook));
        } catch (error) {
          logger.warn('Failed to cache orderbook:', error);
        }

        // Broadcast updated orderbook
        if (this.io) {
          this.io.to(pair).emit('orderBookUpdate', {
            pair,
            orderBook,
            timestamp: Date.now()
          });
        }
      } else {
        break;
      }
    }
  }
}

export const orderBookService = OrderBookService.getInstance();