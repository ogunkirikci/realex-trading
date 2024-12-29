import { connect, Connection, Channel } from 'amqplib';
import { config } from '../config';
import { logger } from '../config/logger';

class RabbitMQService {
  private connection?: Connection;
  private channel?: Channel;
  private static instance: RabbitMQService;

  private constructor() {}

  public static getInstance(): RabbitMQService {
    if (!RabbitMQService.instance) {
      RabbitMQService.instance = new RabbitMQService();
    }
    return RabbitMQService.instance;
  }

  public async connect(): Promise<void> {
    try {
      this.connection = await connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      
      // Create exchange
      await this.channel.assertExchange('order_updates', 'fanout', { durable: false });
      
      logger.info('RabbitMQ connected successfully');
    } catch (error) {
      logger.error('RabbitMQ connection failed:', error);
      throw error;
    }
  }

  public async publishMessage(exchange: string, routingKey: string, content: any): Promise<void> {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel not initialized');
      }

      this.channel.publish(
        exchange,
        routingKey,
        Buffer.from(JSON.stringify(content))
      );
    } catch (error) {
      logger.error('Failed to publish to RabbitMQ:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
  }
}

export const rabbitMQService = RabbitMQService.getInstance(); 