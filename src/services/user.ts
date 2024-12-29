import { User } from '../interfaces/User';

// In-memory user store
const users = new Map<string, User>();

export const getUserById = async (id: string): Promise<User | undefined> => {
  return users.get(id);
};

export const createUser = async (user: User): Promise<User> => {
  users.set(user.id, user);
  return user;
};

export const getUserByEmail = async (email: string): Promise<User | undefined> => {
  return Array.from(users.values()).find(u => u.email === email);
};

export const getAllUsers = async (): Promise<User[]> => {
  return Array.from(users.values());
};