import { clientsRepo } from './clients.repo.js';
import { NotFoundError } from '../../lib/AppError.js';

export const clientsService = {
  list: (userId: string) => clientsRepo.listByUser(userId),

  async get(userId: string, id: string) {
    const client = await clientsRepo.findById(userId, id);
    if (!client) throw new NotFoundError('Stranka ni najdena');
    return client;
  },
};
