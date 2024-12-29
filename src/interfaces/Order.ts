export interface Order {
  price: number;
  quantity: number;
  userId: string;
  timestamp: number;
}

export interface OrderBook {
  bids: Order[];
  asks: Order[];
}