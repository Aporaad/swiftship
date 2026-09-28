import type { SaveRoleInput } from '../types';

export function validateSaveRoleInput(input: SaveRoleInput): void {
  if (!input.roleId.trim()) throw new Error('roleId is required');
  if (input.title !== null && !input.title.trim()) throw new Error('title cannot be empty');
  if (!Array.isArray(input.permissions)) throw new Error('permissions must be an array');

  const invalidPermission = input.permissions.find(
    (permission) => typeof permission !== 'string' || !permission.trim(),
  );
  if (invalidPermission !== undefined) throw new Error('permissions contains an invalid value');
}
