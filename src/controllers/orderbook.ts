import { Request, Response } from 'express';
import { logger } from '../config/logger';
import { orderBookService } from '../services/orderbook';

export class OrderBookController {
  public getOrderBook = async (req: Request, res: Response): Promise<void> => {
    try {
      const { pair } = req.params;
      const orderBook = await orderBookService.getOrderBook(pair);
      
      if (!orderBook) {
        res.status(404).json({ error: 'Order book not found' });
        return;
      }

      res.json(orderBook);
    } catch (error) {
      logger.error('Get orderbook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };

  public placeOrder = async (req: Request, res: Response): Promise<void> => {
    try {
      const { pair } = req.params;
      const { type, price, quantity, userId } = req.body;

      if (!type || !price || !quantity || !userId) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      await orderBookService.matchOrders(pair);

      res.json({ message: 'Order placed successfully' });
    } catch (error) {
      logger.error('Place order error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}