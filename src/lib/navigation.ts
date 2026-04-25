type NavigationUser = {
  role?: string;
  type?: string;
} | null;

export function getProfileOrHomeUrl(user?: NavigationUser): string {
  if (!user) return '/';

  if (user.role === 'SuperAdmin' || user.role === 'Admin') {
    return '/admin';
  }

  if (user.type === 'BRAND' || user.type === 'REGULAR') {
    return '/profile';
  }

  return '/';
}

export default getProfileOrHomeUrl;
