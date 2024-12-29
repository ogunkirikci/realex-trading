import express from 'express';
import { OrderBookController } from '../controllers/orderbook';

const router = express.Router();
const orderBookController = new OrderBookController();

router.get('/:pair', orderBookController.getOrderBook);
router.post('/:pair/order', orderBookController.placeOrder);

export default router;