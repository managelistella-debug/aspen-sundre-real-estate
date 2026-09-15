import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/admin/requireAuth";
import { ensureUniqueSlug, isoDateOrUndefined, numOrUndefined, withArrayKeys } from "@/lib/admin/helpers";
import { getSanityWriteClient } from "@/lib/sanity/client";
import { slugify } from "@/lib/sanity/slugify";
import { PROPERTY_TYPE_OPTIONS } from "@/lib/sanity/types";

const LIST_PROJECTION = `{
  _id, address, city, neighborhood, slug, status, price, bedrooms, bathrooms,
  livingAreaSqft, lotSizeSqft, lotSizeDisplayUnit, propertyType, mainImage,
  featured, sortOrder, published, dateListed, _createdAt, _updatedAt
}`;

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const client = getSanityWriteClient();
  const listings = await client.fetch(
    `*[_type == "listing"] | order(sortOrder asc, _createdAt desc) ${LIST_PROJECTION}`
  );
  return NextResponse.json({ listings });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const body = await req.json().catch(() => ({}));
  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (!address) {
    return NextResponse.json({ error: "Address is required." }, { status: 400 });
  }

  const client = getSanityWriteClient();
  const baseSlug = slugify(typeof body.slug === "string" && body.slug ? body.slug : address);
  const slug = await ensureUniqueSlug(client, "listing", baseSlug);

  const propertyType = Array.isArray(body.propertyType)
    ? body.propertyType.filter((t: string) => (PROPERTY_TYPE_OPTIONS as string[]).includes(t))
    : [];

  const doc = {
    _type: "listing",
    address,
    city: body.city || "",
    neighborhood: body.neighborhood || "",
    slug: { _type: "slug", current: slug },
    status: body.status === "Sold" ? "Sold" : "Active",
    price: numOrUndefined(body.price),
    bedrooms: numOrUndefined(body.bedrooms),
    bathrooms: body.bathrooms || "",
    livingAreaSqft: numOrUndefined(body.livingAreaSqft),
    lotSizeSqft: numOrUndefined(body.lotSizeSqft),
    lotSizeDisplayUnit: body.lotSizeDisplayUnit === "acres" ? "acres" : "sqft",
    propertyType,
    yearBuilt: numOrUndefined(body.yearBuilt),
    propertyTaxes: numOrUndefined(body.propertyTaxes),
    dateListed: isoDateOrUndefined(body.dateListed),
    mlsNumber: body.mlsNumber || "",
    description: body.description || "",
    mainImage: body.mainImage || undefined,
    gallery: Array.isArray(body.gallery) ? withArrayKeys(body.gallery) : [],
    featured: !!body.featured,
    sortOrder: numOrUndefined(body.sortOrder) ?? 0,
    published: !!body.published,
  };

  const created = await client.create(doc);
  return NextResponse.json({ listing: created });
}
