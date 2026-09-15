import { createClient } from "@sanity/client";

export const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || "";
export const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET || "production";
export const apiVersion = process.env.SANITY_API_VERSION || "2025-02-19";

/**
 * Public, read-only client. No token — used for all frontend/public queries.
 *
 * useCdn is false so an admin edit (a new listing, a reordered gallery, a
 * price change) shows on the live site the moment it's saved. With the CDN on,
 * Sanity serves a cached copy at the edge for up to ~60s, which read as a delay
 * after saving. Reads already opt out of Next's fetch cache (see queries.ts),
 * so this removes the last cache between a save and the rendered page.
 */
export const sanityReadClient = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  perspective: "published",
});

/**
 * Authenticated write client. Only ever imported from `/api/admin/*` route
 * handlers — never from a client component or public page.
 */
export function getSanityWriteClient() {
  const token = process.env.SANITY_WRITE_TOKEN;
  if (!token) {
    throw new Error("SANITY_WRITE_TOKEN is not configured.");
  }
  return createClient({
    projectId,
    dataset,
    apiVersion,
    token,
    useCdn: false,
    perspective: "raw",
  });
}
