import React from "react";
import { createRoot } from "react-dom/client";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { DropdownManagerProvider } from "@/context/DropdownManagerContext";
import CustomersPage from "@/pages/dashboard/CustomersPage";
import CustomerSettings from "@/components/settings/tabs/CustomerSettings";
import StoreManagement from "@/pages/studio/store/StoreManagement";
import "@/index.css";

const ProductEditor = React.lazy(() => import('@/pages/studio/products/EditProduct'));
const id = "00000000-0000-4000-8000-000000000001";
const brandId = "00000000-0000-4000-8000-000000000002";
const user = {
  id,
  type: "BRAND",
  username: "nuels-cotour",
  brandFullName: "Nuel's Cotour",
  brandDescription: "Into the unknown Nuels Fashion hib and fix. ".repeat(8),
  brandCountry: 'Nigeria',
  brandTags: ['casual-streetwear'],
  isEmailVerified: true,
  storeId: brandId,
  activeBrandId: brandId,
  brandMemberships: [
    { brandId, role: "OWNER", status: "ACTIVE", isOwner: true },
  ],
};
const store = configureStore({
  reducer: {
    user: () => ({ profile: user, isAuthenticated: true }),
    ui: () => ({}),
    engagement: () => ({}),
  },
});
const screen = new URLSearchParams(location.search).get("screen");
const content =
  screen === "product-creation" ? <React.Suspense fallback={<p>Loading editor</p>}><ProductEditor /></React.Suspense> :
  screen === "customers" ? (
    <CustomersPage />
  ) : screen === "customer-settings" ? (
    <CustomerSettings />
  ) : (
    <StoreManagement />
  );
const embedded = new URLSearchParams(location.search).has("embedded");
createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, staleTime: 60000 } },
        })
      }
    >
      <MemoryRouter
        initialEntries={[
          (screen === "product-creation" ? "/studio/store/products/new" : "/studio/store") + (embedded ? "?surface=mobile-app" : ""),
        ]}
      >
        <DropdownManagerProvider>
          <main className="mx-auto max-w-6xl px-3">{content}</main>
        </DropdownManagerProvider>
      </MemoryRouter>
    </QueryClientProvider>
  </Provider>,
);
