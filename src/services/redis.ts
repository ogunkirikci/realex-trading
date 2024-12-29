import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../config/logger';

class RedisService {
  private client: RedisClientType;
  private static instance: RedisService;

  private constructor() {
    this.client = createClient({
      url: config.redis.url
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Redis connected successfully');
    } catch (error) {
      logger.error('Redis connection failed:', error);
      throw error;
    }
  }

  public async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  public async set(key: string, value: string): Promise<void> {
    await this.client.set(key, value);
  }

  public async quit(): Promise<void> {
    await this.client.quit();
  }
}

export const redisService = RedisService.getInstance(); 