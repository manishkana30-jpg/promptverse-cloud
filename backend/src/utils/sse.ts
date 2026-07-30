import { Response } from 'express';

// Store active connections indexed by user_id
const clients = new Map<string, Response[]>();

export const addClient = (userId: string, res: Response) => {
  const userClients = clients.get(userId) || [];
  userClients.push(res);
  clients.set(userId, userClients);
};

export const removeClient = (userId: string, res: Response) => {
  let userClients = clients.get(userId) || [];
  userClients = userClients.filter(client => client !== res);
  if (userClients.length === 0) {
    clients.delete(userId);
  } else {
    clients.set(userId, userClients);
  }
};

export const broadcastToUser = (userId: string, type: string, payload: any) => {
  const userClients = clients.get(userId) || [];
  const data = JSON.stringify({ type, data: payload });
  
  for (const res of userClients) {
    try {
      res.write(`data: ${data}\n\n`);
    } catch (e) {
      console.error(`Failed to send event to client for user ${userId}:`, e);
      removeClient(userId, res);
    }
  }
};
