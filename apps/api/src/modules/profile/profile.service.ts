import { NotFoundError } from '../../lib/AppError.js';
import { toProfileDto } from '../../lib/mappers.js';
import { profileRepo, type ProfileWrite } from './profile.repo.js';

export const profileService = {
  async get(userId: string) {
    const row = await profileRepo.find(userId);
    if (!row) throw new NotFoundError('Profil ni najden');
    return toProfileDto(row);
  },

  async save(userId: string, input: ProfileWrite) {
    return toProfileDto(await profileRepo.save(userId, input));
  },
};
