export function getProfileOrHomeUrl(user?: { type?: string } | null): string {
  return user?.type === 'BRAND' ? '/profile' : '/';
}

export default getProfileOrHomeUrl;
