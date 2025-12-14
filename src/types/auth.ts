export type AuthRole = 'SuperAdmin' | 'Admin' | 'User';
export type AuthUserType = 'BRAND' | 'REGULAR';

export interface AuthProfileImageFileDto {
  id: string;
  s3Url: string;
  fileName: string;
  originalName: string;
  createdAt: string;
  updatedAt: string;
}
export interface AuthUserDto {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: AuthRole;
  type: AuthUserType;
  phoneNumber: string | null;
  address: string | null;
  brandFullName: string | null;
  brandDescription: string | null;
  brandCountry: string | null;
  brandState: string | null;
  brandCity: string | null;
  brandTags: string[];
  brandBusinessType: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialTwitter: string | null;
  socialWebsite: string | null;
  cacNumber: string | null;
  tin: string | null;
  ceoNin: string | null;
  ceoFirstName: string | null;
  ceoLastName: string | null;
  companyLocation: string | null;
  profileImage: string | null;
  profileImageId: string | null;
  profileImageFile: AuthProfileImageFileDto | null;
  bannerImage: string | null;
  bannerImageId: string | null;
  bannerImageFile: AuthProfileImageFileDto | null;
  isEmailVerified: boolean;
  storeId: string | null;
  isActive: string;
  createdAt: string;
  updatedAt: string;
}
export interface AuthTokensResponse {
  user: AuthUserDto;
  accessToken?: string | null;
  message?: string;
}

export interface AuthProfileResponse {
  user: AuthUserDto;
}

export interface AuthJwtClaims {
  sub: string;
  username: string;
  role: AuthRole;
  type: AuthUserType;
  email: string;
  firstName: string;
  lastName: string;
}
export type ApiSuccessPayload<T> =
  | (T & { statusCode: number; message: string })
  | { statusCode: number; message: string; data: T }
  | T;

export const unwrapApiResponse = <T>(payload: ApiSuccessPayload<T>): T => {
  // If payload contains a `data` key, return it
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }

  // If payload looks like { statusCode, message, ...rest } return the rest
  if (payload && typeof payload === 'object' && 'statusCode' in payload && 'message' in payload) {
    const asRecord = { ...(payload as Record<string, unknown>) };
    delete (asRecord as Record<string, unknown>).statusCode;
    delete (asRecord as Record<string, unknown>).message;
    return asRecord as unknown as T;
  }

  return payload as unknown as T;
};
