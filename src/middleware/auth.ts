import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../config/logger';
import { AuthenticatedSocket } from '../interfaces/User';
import { getUserById } from '../services/user';

export const authenticateSocket = async (
  socket: Socket,
  next: (err?: Error) => void
) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: string;
      email: string;
    };

    const user = await getUserById(decoded.id);
    if (!user) {
      return next(new Error('User not found'));
    }

    (socket as AuthenticatedSocket).user = {
      id: decoded.id,
      email: decoded.email
    };

    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Invalid token'));
  }
};