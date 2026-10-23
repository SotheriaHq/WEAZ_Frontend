import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render as rawRender, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FilterSelector from "./FilterSelector";
import { brandApi } from "@/api/BrandApi";

vi.mock("@/api/BrandApi", () => ({
  brandApi: {
    getFilterDimensions: vi.fn(),
  },
}));

const dimensions = [
  {
    id: "dim-style",
    slug: "style",
    name: "Style",
    isMulti: true,
    appliesTo: ["COLLECTION", "DESIGN", "PRODUCT", "STORE_COLLECTION"],
    values: [{ id: "value-style", slug: "casual-streetwear", name: "Casual / Streetwear" }],
  },
  {
    id: "dim-heritage",
    slug: "heritage",
    name: "Heritage",
    isMulti: true,
    appliesTo: ["COLLECTION", "DESIGN", "PRODUCT", "STORE_COLLECTION"],
    values: [{ id: "value-heritage", slug: "ankara", name: "Ankara" }],
  },
  {
    id: "dim-occasion",
    slug: "occasion",
    name: "Occasion",
    isMulti: true,
    appliesTo: ["COLLECTION", "DESIGN", "PRODUCT", "STORE_COLLECTION"],
    values: [{ id: "value-occasion", slug: "wedding", name: "Wedding" }],
  },
  {
    id: "dim-fabric",
    slug: "fabric",
    name: "Fabric",
    isMulti: true,
    appliesTo: ["COLLECTION", "DESIGN", "PRODUCT", "STORE_COLLECTION"],
    values: [{ id: "value-fabric", slug: "lace", name: "Lace" }],
  },
  {
    id: "dim-color",
    slug: "color-family",
    name: "Color Family",
    isMulti: true,
    appliesTo: ["COLLECTION", "DESIGN", "PRODUCT", "STORE_COLLECTION"],
    values: [{ id: "value-color", slug: "gold", name: "Gold" }],
  },
  {
    id: "dim-fit",
    slug: "fit",
    name: "Fit",
    isMulti: true,
    appliesTo: ["COLLECTION", "DESIGN", "PRODUCT", "STORE_COLLECTION"],
    values: [{ id: "value-fit", slug: "flowy", name: "Flowy" }],
  },
  {
    id: "dim-price",
    slug: "price-range",
    name: "Price Range",
    isMulti: false,
    appliesTo: ["COLLECTION", "DESIGN", "PRODUCT"],
    values: [{ id: "value-price", slug: "premium", name: "Premium" }],
  },
];

let client: QueryClient;
function render(ui: React.ReactElement) {
  return rawRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("FilterSelector", () => {
  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
    vi.mocked(brandApi.getFilterDimensions).mockResolvedValue(dimensions as any);
  });

  it("renders the Phase 3 discovery dimensions and excludes legacy dimensions", async () => {
    render(<FilterSelector value={{}} onChange={vi.fn()} entityType="PRODUCT" />);

    expect(await screen.findAllByText("Style details")).toHaveLength(2);
    expect(screen.getByText("Cultural vibe")).toBeInTheDocument();
    expect(screen.getByText("Where would you wear it?")).toBeInTheDocument();
    expect(screen.getByText("Fabric")).toBeInTheDocument();
    expect(screen.getByText("Color family")).toBeInTheDocument();
    expect(screen.getByText("Fit")).toBeInTheDocument();
    expect(screen.queryByText("Price Range")).not.toBeInTheDocument();
  });

  it('shares one request and cached options across product and design selectors', async () => {
    render(<><FilterSelector value={{}} onChange={vi.fn()} entityType="PRODUCT" /><FilterSelector value={{}} onChange={vi.fn()} entityType="DESIGN" /></>);
    expect(await screen.findAllByText('Cultural vibe')).toHaveLength(2);
    expect(brandApi.getFilterDimensions).toHaveBeenCalledTimes(1);
  });

  it('shows the metadata error without caching it as an empty successful response', async () => {
    vi.mocked(brandApi.getFilterDimensions).mockRejectedValueOnce(new Error('offline'));
    render(<FilterSelector value={{}} onChange={vi.fn()} entityType="PRODUCT" />);
    expect(await screen.findByText(/Style details could not load/)).toBeInTheDocument();
  });

  it("maps selected values back into the filterSelection structure", async () => {
    const handleChange = vi.fn();
    render(<FilterSelector value={{}} onChange={handleChange} entityType="DESIGN" />);

    fireEvent.click(await screen.findByText("Cultural vibe"));
    fireEvent.click(await screen.findByText("Ankara"));

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith({
        "dim-heritage": ["value-heritage"],
      });
    });
  });
});
