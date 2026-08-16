import type { SessionInput } from '@reckon/shared';
import { ConflictError, NotFoundError } from '../../lib/AppError.js';
import { toSessionDto } from '../../lib/mappers.js';
import { sessionsRepo } from './sessions.repo.js';

/** Told apart from "not found" so the interface can explain which it is. */
const billed = () =>
  new ConflictError('Vnosa ni mogoče spremeniti — je že na računu');

export const sessionsService = {
  async list(userId: string) {
    return (await sessionsRepo.listByUser(userId)).map(toSessionDto);
  },

  async create(userId: string, input: SessionInput) {
    return toSessionDto(await sessionsRepo.create(userId, input));
  },

  async update(userId: string, id: string, input: SessionInput) {
    const row = await sessionsRepo.updateIfUnbilled(userId, id, input);
    if (row) return toSessionDto(row);
    // Nothing updated: either it isn't there, or it is and it's billed.
    const existing = await sessionsRepo.findById(userId, id);
    if (!existing) throw new NotFoundError('Vnos ni najden');
    throw billed();
  },

  async remove(userId: string, id: string) {
    if (await sessionsRepo.deleteIfUnbilled(userId, id)) return;
    const existing = await sessionsRepo.findById(userId, id);
    if (!existing) throw new NotFoundError('Vnos ni najden');
    throw billed();
  },
};
