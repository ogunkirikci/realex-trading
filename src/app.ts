import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { config } from './config';
import { logger } from './config/logger';
import { authenticateSocket } from './middleware/auth';
import { redisService } from './services/redis';
import { rabbitMQService } from './services/rabbitmq';
import { orderBookService } from './services/orderbook';
import authRoutes from './routes/auth';
import orderBookRoutes from './routes/orderbook';
import { AuthenticatedSocket } from './interfaces/User';
import path from 'path';

// Express app setup
const app = express();
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api/orderbook', orderBookRoutes);
app.use('/api/auth', authRoutes);

// HTTP server setup
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// Set Socket.IO instance in OrderBookService
orderBookService.setSocketIO(io);

// Apply socket authentication
io.use(authenticateSocket);

// Initialize crypto pairs
const cryptoPairs = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'ADA/USDT',
  'SOL/USDT'
];

// Initialize order books
cryptoPairs.forEach(pair => {
  orderBookService.initializePair(pair);
});

interface Order {
    type: 'buy' | 'sell';
    price: number;
    amount: number;
    pair: string;
    userId: string;
    timestamp: number;
}

interface CryptoData {
    lastPrice: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    priceHistory: {
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
    }[];
}

// In-memory storage
const orders: Order[] = [];
const cryptoData: { [pair: string]: CryptoData } = {
    'BTC/USDT': {
        lastPrice: 42000,
        high24h: 43000,
        low24h: 41000,
        volume24h: 1000,
        priceHistory: []
    },
    'ETH/USDT': {
        lastPrice: 2200,
        high24h: 2300,
        low24h: 2100,
        volume24h: 5000,
        priceHistory: []
    },
    'SOL/USDT': {
        lastPrice: 95,
        high24h: 98,
        low24h: 92,
        volume24h: 8000,
        priceHistory: []
    },
    'XRP/USDT': {
        lastPrice: 0.5,
        high24h: 0.52,
        low24h: 0.48,
        volume24h: 10000,
        priceHistory: []
    },
    'AVAX/USDT': {
        lastPrice: 35,
        high24h: 36,
        low24h: 34,
        volume24h: 3000,
        priceHistory: []
    }
};

// Initialize price history
function initializePriceHistory() {
    const pairs = Object.keys(cryptoData);
    const now = Math.floor(Date.now() / 1000);
    
    pairs.forEach(pair => {
        const data = cryptoData[pair];
        const basePrice = data.lastPrice;
        
        // Create 100 candles
        for (let i = 0; i < 100; i++) {
            const time = now - (100 - i) * 60; // Each candle is 1 minute apart
            const volatility = pair === 'BTC/USDT' ? 0.002 : 
                             pair === 'ETH/USDT' ? 0.003 : 0.004;
            
            const changePercent = (Math.random() - 0.5) * 2 * volatility;
            const open = i === 0 ? basePrice : data.priceHistory[i-1].close;
            const close = open * (1 + changePercent);
            const high = Math.max(open, close) * (1 + Math.random() * volatility);
            const low = Math.min(open, close) * (1 - Math.random() * volatility);

            data.priceHistory.push({
                time,
                open,
                high,
                low,
                close
            });
        }
    });
}

// More realistic price simulation
function simulatePrice(currentPrice: number, pair: string): number {
    const volatility = 
        pair === 'BTC/USDT' ? 0.0002 : 
        pair === 'ETH/USDT' ? 0.0003 : 
        pair === 'SOL/USDT' ? 0.0004 :
        pair === 'XRP/USDT' ? 0.0004 :
        0.0005; // AVAX/USDT
    
    const trend = Math.sin(Date.now() / 1000000) * 0.5 + 0.5;
    const changePercent = (Math.random() - 0.5 + trend * 0.1) * volatility;
    
    return currentPrice * (1 + changePercent);
}

io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);
    let userEmail: string | null = null;

    socket.on('subscribe', (data: { email: string, pair: string }) => {
        userEmail = data.email;
        socket.join(data.pair);
        console.log(`Client ${socket.id} (${data.email}) subscribed to ${data.pair}`);

        // Send current orders and price data
        const currentOrders = orders.filter(order => order.pair === data.pair);
        const orderBook = {
            bids: currentOrders.filter(order => order.type === 'buy')
                .sort((a, b) => b.price - a.price),
            asks: currentOrders.filter(order => order.type === 'sell')
                .sort((a, b) => a.price - b.price),
            lastPrice: cryptoData[data.pair].lastPrice,
            priceHistory: cryptoData[data.pair].priceHistory
        };

        socket.emit('orderBook', orderBook);
    });

    socket.on('buy', (data: { price: number; amount: number; pair: string }) => {
        if (!userEmail) return;

        console.log('Buy order received:', data);

        const order: Order = {
            type: 'buy',
            price: data.price,
            amount: data.amount,
            pair: data.pair,
            userId: userEmail,
            timestamp: Date.now()
        };

        orders.push(order);
        
        // Update last price
        cryptoData[data.pair].lastPrice = data.price;

        // Calculate current order book
        const currentOrders = orders.filter(o => o.pair === data.pair);
        const orderBook = {
            bids: currentOrders.filter(o => o.type === 'buy')
                .sort((a, b) => b.price - a.price),
            asks: currentOrders.filter(o => o.type === 'sell')
                .sort((a, b) => a.price - b.price),
            lastPrice: cryptoData[data.pair].lastPrice,
            priceHistory: cryptoData[data.pair].priceHistory
        };

        // Broadcast order book update
        io.to(data.pair).emit('orderBook', orderBook);
        console.log('Order book updated:', orderBook);
    });

    socket.on('sell', (data: { price: number; amount: number; pair: string }) => {
        if (!userEmail) return;

        console.log('Sell order received:', data);

        const order: Order = {
            type: 'sell',
            price: data.price,
            amount: data.amount,
            pair: data.pair,
            userId: userEmail,
            timestamp: Date.now()
        };

        orders.push(order);

        // Update last price
        cryptoData[data.pair].lastPrice = data.price;

        // Calculate current order book
        const currentOrders = orders.filter(o => o.pair === data.pair);
        const orderBook = {
            bids: currentOrders.filter(o => o.type === 'buy')
                .sort((a, b) => b.price - a.price),
            asks: currentOrders.filter(o => o.type === 'sell')
                .sort((a, b) => a.price - b.price),
            lastPrice: cryptoData[data.pair].lastPrice,
            priceHistory: cryptoData[data.pair].priceHistory
        };

        // Broadcast order book update
        io.to(data.pair).emit('orderBook', orderBook);
        console.log('Order book updated:', orderBook);
    });

    // Less frequent price update
    const priceUpdateInterval = setInterval(() => {
        if (userEmail) {
            Object.keys(cryptoData).forEach(pair => {
                const data = cryptoData[pair];
                const currentTime = Math.floor(Date.now() / 1000);
                
                // Create a new candle every 15 seconds
                if (currentTime - data.priceHistory[data.priceHistory.length - 1].time >= 15) {
                    const lastClose = data.priceHistory[data.priceHistory.length - 1].close;
                    const newPrice = simulatePrice(lastClose, pair);
                    
                    const newCandle = {
                        time: currentTime,
                        open: lastClose,
                        high: Math.max(lastClose, newPrice),
                        low: Math.min(lastClose, newPrice),
                        close: newPrice
                    };

                    data.priceHistory.push(newCandle);
                    
                    // Keep last 100 candles
                    if (data.priceHistory.length > 100) {
                        data.priceHistory.shift();
                    }

                    data.lastPrice = newPrice;
                    data.high24h = Math.max(data.high24h, newPrice);
                    data.low24h = Math.min(data.low24h, newPrice);
                    
                    // Send order book and price data
                    const currentOrders = orders.filter(o => o.pair === pair);
                    const orderBook = {
                        bids: currentOrders.filter(o => o.type === 'buy')
                            .sort((a, b) => b.price - a.price),
                        asks: currentOrders.filter(o => o.type === 'sell')
                            .sort((a, b) => a.price - b.price),
                        lastPrice: data.lastPrice,
                        high24h: data.high24h,
                        low24h: data.low24h,
                        volume24h: data.volume24h,
                        priceHistory: data.priceHistory
                    };

                    io.to(pair).emit('orderBook', orderBook);
                }
            });
        }
    }, 1000); // Check every second but update every 15 seconds

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        clearInterval(priceUpdateInterval);
    });
});

// Create price history when server starts
initializePriceHistory();

// Initialize services and start server
async function initializeServices() {
  try {
    // Initialize Redis
    try {
      await redisService.connect();
    } catch (redisError) {
      logger.warn('Redis connection failed, continuing without Redis:', redisError);
    }

    // Initialize RabbitMQ
    try {
      await rabbitMQService.connect();
    } catch (rabbitError) {
      logger.warn('RabbitMQ connection failed, continuing without RabbitMQ:', rabbitError);
    }

    // Start server
    httpServer.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });

  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  try {
    await redisService.quit();
    await rabbitMQService.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the application
initializeServices().catch(error => {
  logger.error('Application startup failed:', error);
  process.exit(1);
});