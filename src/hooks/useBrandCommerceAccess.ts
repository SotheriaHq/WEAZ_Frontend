import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import { getActiveBrandId, isBrandOwner } from "@/lib/brandAccess";
import { brandCustomersApi } from "@/api/BrandCustomersApi";
import { useCustomerEntitlementExpiry } from "./useCustomerEntitlementExpiry";

export function useBrandCommerceAccess() {
  const profile = useSelector((state: RootState) => state.user.profile);
  const brandId = getActiveBrandId(profile);
  const canManage = Boolean(brandId && isBrandOwner(profile, brandId));
  const query = useQuery({
    queryKey: ["brand-commerce-access", profile?.id, brandId],
    queryFn: ({ signal }) => brandCustomersApi.access(brandId!, signal),
    enabled: canManage,
    staleTime: 30_000,
    refetchOnMount: true,
  });
  const expired = useCustomerEntitlementExpiry(query.data, query.dataUpdatedAt, profile?.id, brandId, canManage);
  const data = useMemo(() => !canManage ? undefined : expired && query.data ? { ...query.data, canConfigureCustomers: false, effectiveMinimumOrders: 1 } : query.data, [canManage, expired, query.data]);
  return { ...query, data, brandId, canManage, entitlementExpired: canManage && expired };
}
