import { Server, Socket } from 'socket.io';
import { orderBookService } from '../services/orderbook';

export const handleOrder = (io: Server, socket: Socket) => {
    console.log('Client connected:', socket.id);

    // First connection, send order book
    socket.on('getOrderBook', (pair: string) => {
        try {
            console.log('GetOrderBook request received for pair:', pair);
            const orderBook = orderBookService.getOrderBook(pair);
            console.log('Sending order book:', orderBook);
            socket.emit('orderBookUpdate', orderBook);
        } catch (error) {
            console.error('Error fetching order book:', error);
            socket.emit('error', { message: 'Failed to fetch order book' });
        }
    });

    // New order received
    socket.on('newOrder', async (order) => {
        try {
            console.log('New order received:', order);
            
            await orderBookService.addOrder({
                ...order,
                userId: socket.data.user?.id || 'anonymous',
                timestamp: Date.now()
            });

            // Send updated order book to all connected clients
            const orderBook = orderBookService.getOrderBook(order.pair);
            console.log('Broadcasting updated order book:', orderBook);
            io.emit('orderBookUpdate', orderBook);

        } catch (error) {
            console.error('Order handling error:', error);
            socket.emit('error', { message: 'Failed to process order' });
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
};