import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

describe("FilterSelector", () => {
  beforeEach(() => {
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
