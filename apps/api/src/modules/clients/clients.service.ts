import { toCents, type ClientInput } from '@reckon/shared';
import { NotFoundError } from '../../lib/AppError.js';
import { toClientDto } from '../../lib/mappers.js';
import { clientsRepo, type ClientWrite } from './clients.repo.js';

const toWrite = (input: ClientInput): ClientWrite => ({
  name: input.name,
  street: input.street,
  postalCode: input.postalCode,
  city: input.city,
  taxNumber: input.taxNumber,
  rateCents: toCents(input.rate),
  email: input.email,
  phone: input.phone,
});

export const clientsService = {
  async list(userId: string) {
    return (await clientsRepo.listByUser(userId)).map(toClientDto);
  },

  async get(userId: string, id: string) {
    const row = await clientsRepo.findById(userId, id);
    if (!row) throw new NotFoundError('Stranka ni najdena');
    return toClientDto(row);
  },

  async create(userId: string, input: ClientInput) {
    return toClientDto(await clientsRepo.create(userId, toWrite(input)));
  },

  async update(userId: string, id: string, input: ClientInput) {
    const row = await clientsRepo.update(userId, id, toWrite(input));
    if (!row) throw new NotFoundError('Stranka ni najdena');
    return toClientDto(row);
  },

  async setActive(userId: string, id: string, active: boolean) {
    const row = await clientsRepo.setActive(userId, id, active);
    if (!row) throw new NotFoundError('Stranka ni najdena');
    return toClientDto(row);
  },

  /**
   * Removing a client that has been worked for or invoiced would orphan hours
   * and leave an invoice unable to name its addressee, so it is deactivated
   * instead — out of the pickers, still in the history. Only a client nothing
   * points at is actually deleted.
   */
  async remove(userId: string, id: string) {
    const existing = await clientsRepo.findById(userId, id);
    if (!existing) throw new NotFoundError('Stranka ni najdena');

    if (await clientsRepo.hasHistory(userId, id)) {
      const row = await clientsRepo.setActive(userId, id, false);
      return { deactivated: true, client: toClientDto(row!) };
    }

    await clientsRepo.delete(userId, id);
    return { deactivated: false, client: null };
  },
};
