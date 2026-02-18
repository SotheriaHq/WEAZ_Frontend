export function getProfileOrHomeUrl(user?: { type?: string } | null): string {
  if (!user?.type) return '/';
  return user.type === 'BRAND' || user.type === 'REGULAR' ? '/profile' : '/';
}

export default getProfileOrHomeUrl;
