import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000",
  redis: {
    url: process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@127.0.0.1:5672'
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-key',
    expiresIn: '24h'
  }
};