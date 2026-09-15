import {
  fetchAllPublishedListings,
  fetchFeaturedListings,
  fetchListingBySlug,
  fetchListingsByPropertyType,
  fetchListingsByStatus,
} from "./sanity/queries";
import { imageUrl } from "./sanity/image";
import { formatLotSize, fromCanonicalSqft } from "./sanity/lotSize";
import type { Listing as SanityListing } from "./sanity/types";

export interface Listing {
  id: string;
  slug: string;
  address: string;
  city: string;
  neighborhood: string;
  description: string;
  listPrice: number;
  listingStatus: "active" | "sold";
  propertyType: string;
  bedrooms: number;
  bathrooms: string;
  livingArea: number;
  lotArea: number;
  lotAreaUnit: string;
  yearBuilt: number;
  taxes: number;
  /** ISO date (YYYY-MM-DD), "" when unset. Ordering only — never displayed. */
  dateListed: string;
  mlsNumber: string;
  gallery: string[];
  thumbnail: string;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function descriptionToHtml(text: string): string {
  if (!text) return "";
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toListing(l: SanityListing): Listing {
  // The public gallery leads with the main/featured image, then the rest of the
  // gallery in its saved order — with the main image de-duplicated so it never
  // appears twice (some listings store it as gallery[0] as well).
  const mainRef = l.mainImage?.asset?._ref;
  const orderedImages = l.mainImage
    ? [l.mainImage, ...(l.gallery || []).filter((img) => img.asset?._ref !== mainRef)]
    : l.gallery || [];
  const gallery = orderedImages.map((img) => imageUrl(img, 1600) || "").filter(Boolean);
  const thumbnail = imageUrl(l.mainImage, 1200) || gallery[0] || "";
  const lotAreaUnit = l.lotSizeDisplayUnit || "sqft";
  const lotArea = l.lotSizeSqft
    ? roundTo(fromCanonicalSqft(l.lotSizeSqft, lotAreaUnit), lotAreaUnit === "acres" ? 2 : 0)
    : 0;

  return {
    id: l._id,
    slug: l.slug.current,
    address: l.address,
    city: l.city || "",
    neighborhood: l.neighborhood || "",
    description: descriptionToHtml(l.description || ""),
    listPrice: l.price || 0,
    listingStatus: l.status === "Sold" ? "sold" : "active",
    propertyType: (l.propertyType || []).join(", "),
    bedrooms: l.bedrooms || 0,
    bathrooms: l.bathrooms || "",
    livingArea: l.livingAreaSqft || 0,
    lotArea,
    lotAreaUnit: lotAreaUnit === "acres" ? "acres" : "sq ft",
    yearBuilt: l.yearBuilt || 0,
    taxes: l.propertyTaxes || 0,
    dateListed: l.dateListed || "",
    mlsNumber: l.mlsNumber || "",
    gallery,
    thumbnail,
  };
}

const STATUS_RANK: Record<Listing["listingStatus"], number> = { active: 0, sold: 1 };

/**
 * The one ordering every listings page uses: active before sold, then newest
 * list date first, then price high to low as the tie-break. Listings with no
 * list date fall to the end of their status group.
 */
export function compareListings(a: Listing, b: Listing): number {
  const byStatus = STATUS_RANK[a.listingStatus] - STATUS_RANK[b.listingStatus];
  if (byStatus !== 0) return byStatus;

  if (a.dateListed !== b.dateListed) {
    // Blank sorts last either way, so it can't win on a string comparison.
    if (!a.dateListed) return 1;
    if (!b.dateListed) return -1;
    return a.dateListed < b.dateListed ? 1 : -1;
  }

  return b.listPrice - a.listPrice;
}

export async function getFeaturedListings(limit = 6): Promise<Listing[]> {
  const listings = await fetchFeaturedListings(limit);
  if (listings.length > 0) return listings.map(toListing);
  // Fall back to the most recently added active listings if none are flagged featured.
  const active = await fetchListingsByStatus("Active");
  return active.slice(0, limit).map(toListing);
}

export async function getActiveListings(): Promise<Listing[]> {
  const listings = await fetchListingsByStatus("Active");
  return listings.map(toListing).sort(compareListings);
}

export async function getSoldListings(): Promise<Listing[]> {
  const listings = await fetchListingsByStatus("Sold");
  return listings.map(toListing).sort(compareListings);
}

/** Acreages collection page. */
export async function getRanchEstateListings(): Promise<Listing[]> {
  const listings = await fetchListingsByPropertyType("Acreage");
  return listings.map(toListing).sort(compareListings);
}

/** Recreational Properties collection page. */
export async function getRecreationalPropertyListings(): Promise<Listing[]> {
  const listings = await fetchListingsByPropertyType("Recreational");
  return listings.map(toListing).sort(compareListings);
}

export async function getAllListings(): Promise<Listing[]> {
  const listings = await fetchAllPublishedListings();
  return listings.map(toListing).sort(compareListings);
}

export async function getListingBySlug(slug: string): Promise<Listing | undefined> {
  const listing = await fetchListingBySlug(slug);
  return listing ? toListing(listing) : undefined;
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(price);
}

export { formatLotSize };
