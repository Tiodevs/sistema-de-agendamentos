export function publicApiBase(): string {
  const explicit = process.env.PUBLIC_API_URL || process.env.API_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
  return `http://localhost:${process.env.PORT || 3001}`;
}

export function userAvatarUrl(
  userId: string,
  avatarKey: string | null | undefined,
  updatedAt?: Date | string | null,
): string | null {
  if (!avatarKey) return null;
  const version = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  return `${publicApiBase()}/api/users/${userId}/avatar?v=${version}`;
}
