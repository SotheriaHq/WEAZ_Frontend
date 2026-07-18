import { apiClient } from '@/api/httpClient';
import type { ShippingAddress } from '@/api/StoreApi';

export interface SavedDeliveryAddress {
  id: string;
  firstName: string;
  lastName: string;
  customerName: string;
  contactEmail: string;
  phone: string;
  street: string;
  apartment: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  updatedAt: string;
}

export interface CustomOrderSavedAddress {
  id: string;
  customerName: string;
  contactEmail: string;
  contactPhone: string;
  street: string;
  city: string;
  state: string;
  country: string;
  updatedAt: string;
}

const DELIVERY_ADDRESS_BOOK_PREFIX = 'threadly.deliveryAddresses';
const LEGACY_CUSTOM_ORDER_PREFIX = 'threadly.customOrderAddresses';

const getStorageKey = (prefix: string, userId?: string | null) =>
  `${prefix}:${userId && userId.trim() ? userId.trim() : 'guest'}`;

const safeWindow = () =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const createAddressId = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `addr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const splitName = (fullName: string) => {
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { firstName: '', lastName: '' };
  }
  if (tokens.length === 1) {
    return { firstName: tokens[0], lastName: '' };
  }

  return {
    firstName: tokens[0],
    lastName: tokens.slice(1).join(' '),
  };
};

const normalizeDeliveryAddress = (
  raw: Partial<SavedDeliveryAddress> & {
    contactPhone?: string | null;
  },
): SavedDeliveryAddress | null => {
  const explicitCustomerName = String(raw.customerName ?? '').trim();
  const nameParts = splitName(explicitCustomerName);
  const firstName = String(raw.firstName ?? nameParts.firstName).trim();
  const lastName = String(raw.lastName ?? nameParts.lastName).trim();
  const customerName = explicitCustomerName || [firstName, lastName].filter(Boolean).join(' ').trim();
  const contactEmail = String(raw.contactEmail ?? '').trim();
  const phone = String(raw.phone ?? raw.contactPhone ?? '').trim();
  const street = String(raw.street ?? '').trim();
  const apartment = String(raw.apartment ?? '').trim();
  const city = String(raw.city ?? '').trim();
  const state = String(raw.state ?? '').trim();
  const postalCode = String(raw.postalCode ?? '').trim();
  const country = String(raw.country ?? 'Nigeria').trim() || 'Nigeria';

  if (!customerName || !street || !city || !state || !phone) {
    return null;
  }

  return {
    id: String(raw.id ?? createAddressId()),
    firstName,
    lastName,
    customerName,
    contactEmail,
    phone,
    street,
    apartment,
    city,
    state,
    postalCode,
    country,
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  };
};

const readStorage = (storageKey: string) => {
  if (!safeWindow()) return [] as SavedDeliveryAddress[];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) =>
        normalizeDeliveryAddress(
          entry as Partial<SavedDeliveryAddress> & { contactPhone?: string | null },
        ),
      )
      .filter((entry): entry is SavedDeliveryAddress => Boolean(entry))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } catch {
    return [];
  }
};

const ensureMigrated = (userId?: string | null) => {
  if (!safeWindow()) return [] as SavedDeliveryAddress[];

  const deliveryKey = getStorageKey(DELIVERY_ADDRESS_BOOK_PREFIX, userId);
  const current = readStorage(deliveryKey);
  if (current.length > 0) return current;

  const legacyKey = getStorageKey(LEGACY_CUSTOM_ORDER_PREFIX, userId);
  const legacyEntries = readStorage(legacyKey);
  if (legacyEntries.length === 0) return [];

  window.localStorage.setItem(deliveryKey, JSON.stringify(legacyEntries));
  return legacyEntries;
};

const saveRecords = (
  userId: string | null | undefined,
  addresses: SavedDeliveryAddress[],
) => {
  if (!safeWindow()) return;
  window.localStorage.setItem(
    getStorageKey(DELIVERY_ADDRESS_BOOK_PREFIX, userId),
    JSON.stringify(addresses),
  );
};

export const loadDeliveryAddressBook = (userId?: string | null) => {
  const migrated = ensureMigrated(userId);
  if (migrated.length > 0) return migrated;
  return readStorage(getStorageKey(DELIVERY_ADDRESS_BOOK_PREFIX, userId));
};

export const saveDeliveryAddressBook = (
  userId: string | null | undefined,
  addresses: SavedDeliveryAddress[],
) => {
  saveRecords(userId, addresses);
};

export const upsertDeliveryAddress = (
  userId: string | null | undefined,
  address: Partial<SavedDeliveryAddress> & { contactPhone?: string | null },
) => {
  const normalized = normalizeDeliveryAddress(address);
  if (!normalized) {
    return loadDeliveryAddressBook(userId);
  }

  const existing = loadDeliveryAddressBook(userId).filter((entry) => entry.id !== normalized.id);
  const next = [normalized, ...existing].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  saveRecords(userId, next);
  return next;
};

export const removeDeliveryAddress = (
  userId: string | null | undefined,
  addressId: string,
) => {
  const next = loadDeliveryAddressBook(userId).filter((entry) => entry.id !== addressId);
  saveRecords(userId, next);
  return next;
};

const mergeAddressLists = (
  left: SavedDeliveryAddress[],
  right: SavedDeliveryAddress[],
): SavedDeliveryAddress[] => {
  const byId = new Map<string, SavedDeliveryAddress>();
  for (const entry of [...left, ...right]) {
    const existing = byId.get(entry.id);
    if (!existing || entry.updatedAt.localeCompare(existing.updatedAt) > 0) {
      byId.set(entry.id, entry);
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
};

/**
 * Server-backed address book sync: the backend (`/users/me/delivery-addresses`)
 * is the cross-device source so web and the native app see the same saved
 * addresses. Local storage stays as the offline/latency cache; merges favor
 * the newest updatedAt per address id.
 */
export const syncDeliveryAddressBook = async (
  userId?: string | null,
): Promise<SavedDeliveryAddress[]> => {
  const local = loadDeliveryAddressBook(userId);
  if (!userId) return local;

  try {
    const res = await apiClient.get('/users/me/delivery-addresses');
    const rawItems = res.data?.data?.items;
    const serverItems = (Array.isArray(rawItems) ? rawItems : [])
      .map((entry) =>
        normalizeDeliveryAddress(entry as Partial<SavedDeliveryAddress> & { contactPhone?: string | null }),
      )
      .filter((entry): entry is SavedDeliveryAddress => Boolean(entry));

    const merged = mergeAddressLists(local, serverItems);
    saveRecords(userId, merged);

    const serverById = new Map(serverItems.map((entry) => [entry.id, entry]));
    const serverMissesLocal = merged.some((entry) => {
      const remote = serverById.get(entry.id);
      return !remote || entry.updatedAt.localeCompare(remote.updatedAt) > 0;
    });
    if (serverMissesLocal) {
      void apiClient.put('/users/me/delivery-addresses', { items: merged }).catch(() => undefined);
    }
    return merged;
  } catch {
    return local;
  }
};

/** Fire-and-forget upload of the current book so other devices can pull it. */
export const pushDeliveryAddressBook = (
  userId: string | null | undefined,
  addresses: SavedDeliveryAddress[],
) => {
  if (!userId) return;
  void apiClient.put('/users/me/delivery-addresses', { items: addresses }).catch(() => undefined);
};

export const toShippingAddress = (address: SavedDeliveryAddress): ShippingAddress => ({
  firstName: address.firstName || address.customerName,
  lastName: address.lastName,
  street: address.street,
  apartment: address.apartment,
  city: address.city,
  state: address.state,
  postalCode: address.postalCode,
  country: address.country,
  phone: address.phone,
});

export const loadCustomOrderAddressBook = (userId?: string | null) =>
  loadDeliveryAddressBook(userId)
    .filter((entry) => Boolean(entry.contactEmail.trim()))
    .map<CustomOrderSavedAddress>((entry) => ({
      id: entry.id,
      customerName: entry.customerName,
      contactEmail: entry.contactEmail,
      contactPhone: entry.phone,
      street: entry.street,
      city: entry.city,
      state: entry.state,
      country: entry.country,
      updatedAt: entry.updatedAt,
    }));

export const upsertCustomOrderAddress = (
  userId: string | null | undefined,
  address: Partial<CustomOrderSavedAddress>,
) =>
  upsertDeliveryAddress(userId, {
    id: address.id,
    customerName: address.customerName,
    contactEmail: address.contactEmail,
    phone: address.contactPhone,
    street: address.street,
    city: address.city,
    state: address.state,
    country: address.country,
    updatedAt: address.updatedAt,
  }).map<CustomOrderSavedAddress>((entry) => ({
    id: entry.id,
    customerName: entry.customerName,
    contactEmail: entry.contactEmail,
    contactPhone: entry.phone,
    street: entry.street,
    city: entry.city,
    state: entry.state,
    country: entry.country,
    updatedAt: entry.updatedAt,
  }));

export const removeCustomOrderAddress = (
  userId: string | null | undefined,
  addressId: string,
) =>
  removeDeliveryAddress(userId, addressId)
    .filter((entry) => Boolean(entry.contactEmail.trim()))
    .map<CustomOrderSavedAddress>((entry) => ({
      id: entry.id,
      customerName: entry.customerName,
      contactEmail: entry.contactEmail,
      contactPhone: entry.phone,
      street: entry.street,
      city: entry.city,
      state: entry.state,
      country: entry.country,
      updatedAt: entry.updatedAt,
    }));
