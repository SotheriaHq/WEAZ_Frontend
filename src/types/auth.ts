import type { ThemePreference } from './theme';

export type AuthRole = 'SuperAdmin' | 'Admin' | 'User';
export type AuthUserType = 'BRAND' | 'REGULAR';
export type BrandMemberRole =
  | 'OWNER'
  | 'MANAGER'
  | 'CATALOG_MANAGER'
  | 'ORDER_MANAGER'
  | 'SUPPORT_AGENT'
  | 'VIEWER';
export type BrandMemberStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED';

export interface AuthBrandMembershipDto {
  brandId: string;
  brandName: string;
  role: BrandMemberRole;
  status: BrandMemberStatus;
  isOwner: boolean;
}

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
  themePreference: ThemePreference;
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
  brandMemberships?: AuthBrandMembershipDto[];
  activeBrandId?: string | null;
  verificationStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'IN_REVIEW' | 'ADDITIONAL_INFO_REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | null;
  isVerifiedBrand?: boolean;
  verificationBadgeVisible?: boolean;
  verifiedExplanationUrl?: string | null;
  isActive: string;
  status?: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | null;
  mustResetPassword?: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface AuthTokensResponse {
  user: AuthUserDto;
  accessToken?: string | null;
  refreshToken?: string | null;
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
  permissions?: string[];
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
