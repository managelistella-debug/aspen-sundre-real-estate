"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminJson, uploadImage } from "@/lib/admin/adminFetch";
import { moveItem } from "@/lib/admin/galleryOrder";
import { imageUrl } from "@/lib/sanity/image";
import { fromCanonicalSqft, toCanonicalSqft } from "@/lib/sanity/lotSize";
import { PROPERTY_TYPE_OPTIONS, type Listing, type LotSizeUnit, type SanityImageRef } from "@/lib/sanity/types";

interface ListingFormProps {
  listing?: Listing;
}

function field<T extends keyof Listing>(l: Partial<Listing> | undefined, key: T, fallback: Listing[T]) {
  return (l?.[key] ?? fallback) as Listing[T];
}

export default function ListingForm({ listing }: ListingFormProps) {
  const router = useRouter();
  const isEdit = !!listing?._id;
  const mainImageInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [address, setAddress] = useState(field(listing, "address", ""));
  const [city, setCity] = useState(field(listing, "city", ""));
  const [neighborhood, setNeighborhood] = useState(field(listing, "neighborhood", ""));
  const [status, setStatus] = useState(field(listing, "status", "Active"));
  const [price, setPrice] = useState(listing?.price?.toString() ?? "");
  const [bedrooms, setBedrooms] = useState(listing?.bedrooms?.toString() ?? "");
  const [bathrooms, setBathrooms] = useState(field(listing, "bathrooms", ""));
  const [livingAreaSqft, setLivingAreaSqft] = useState(listing?.livingAreaSqft?.toString() ?? "");
  const [yearBuilt, setYearBuilt] = useState(listing?.yearBuilt?.toString() ?? "");
  const [dateListed, setDateListed] = useState(listing?.dateListed ?? "");
  const [propertyTaxes, setPropertyTaxes] = useState(listing?.propertyTaxes?.toString() ?? "");
  const [mlsNumber, setMlsNumber] = useState(field(listing, "mlsNumber", ""));
  const [description, setDescription] = useState(field(listing, "description", ""));
  const [propertyType, setPropertyType] = useState<string[]>(field(listing, "propertyType", []));
  const [featured, setFeatured] = useState(field(listing, "featured", false));
  const [published, setPublished] = useState(field(listing, "published", false));
  const [mainImage, setMainImage] = useState<SanityImageRef | undefined>(listing?.mainImage);
  const [gallery, setGallery] = useState<SanityImageRef[]>(listing?.gallery ?? []);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [lotSizeUnit, setLotSizeUnit] = useState<LotSizeUnit>(listing?.lotSizeDisplayUnit || "sqft");
  const [lotSizeValue, setLotSizeValue] = useState(
    listing?.lotSizeSqft ? String(fromCanonicalSqft(listing.lotSizeSqft, listing.lotSizeDisplayUnit || "sqft")) : ""
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  function handleUnitChange(nextUnit: LotSizeUnit) {
    const current = parseFloat(lotSizeValue);
    if (Number.isFinite(current)) {
      const sqft = toCanonicalSqft(current, lotSizeUnit);
      const converted = fromCanonicalSqft(sqft, nextUnit);
      setLotSizeValue(String(Math.round(converted * 100) / 100));
    }
    setLotSizeUnit(nextUnit);
  }

  function togglePropertyType(type: string) {
    setPropertyType((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  async function handleMainImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const image = await uploadImage(file);
      setMainImage(image);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (mainImageInputRef.current) mainImageInputRef.current.value = "";
    }
  }

  async function handleGallerySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadImage(f)));
      setGallery((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  function removeGalleryImage(index: number) {
    setGallery((prev) => prev.filter((_, i) => i !== index));
  }

  function handleGalleryDrop(to: number) {
    if (dragIndex !== null) setGallery((prev) => moveItem(prev, dragIndex, to));
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function reverseGallery() {
    setGallery((prev) => [...prev].reverse());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const lotValue = parseFloat(lotSizeValue);
    const payload = {
      address,
      city,
      neighborhood,
      status,
      price: price === "" ? undefined : Number(price),
      bedrooms: bedrooms === "" ? undefined : Number(bedrooms),
      bathrooms,
      livingAreaSqft: livingAreaSqft === "" ? undefined : Number(livingAreaSqft),
      lotSizeSqft: Number.isFinite(lotValue) ? toCanonicalSqft(lotValue, lotSizeUnit) : undefined,
      lotSizeDisplayUnit: lotSizeUnit,
      propertyType,
      yearBuilt: yearBuilt === "" ? undefined : Number(yearBuilt),
      dateListed: dateListed === "" ? null : dateListed,
      propertyTaxes: propertyTaxes === "" ? undefined : Number(propertyTaxes),
      mlsNumber,
      description,
      mainImage,
      gallery,
      featured,
      published,
    };

    try {
      if (isEdit) {
        await adminJson(`/api/admin/listings/${listing!._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        // Stay on the editor so further edits don't mean re-finding the listing.
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        const res = await adminJson<{ listing: { _id: string } }>("/api/admin/listings", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        // A brand-new listing lands on its own editor page.
        router.replace(`/admin/listings/${res.listing._id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit || !confirm("Delete this listing? This can't be undone.")) return;
    await adminJson(`/api/admin/listings/${listing!._id}`, { method: "DELETE" });
    router.push("/admin/listings");
    router.refresh();
  }

  // Width kept separate so compound fields (lot size + unit) can size their own parts.
  const fieldClass =
    "bg-[rgba(17,61,53,0.4)] border border-white/15 px-3 py-2 text-white text-[14px] placeholder:text-white/30 outline-none focus:border-[#daaf3a]";
  const inputClass = `w-full ${fieldClass}`;
  const labelClass = "block text-white/50 text-[12px] mb-1";

  return (
    <form onSubmit={handleSubmit} className="max-w-[720px]">
      {error && <p className="text-red-400 text-[13px] mb-4">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="sm:col-span-2">
          <label className={labelClass}>Address</label>
          <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Neighbourhood</label>
          <input className={inputClass} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as "Active" | "Sold")}>
            <option value="Active">Active</option>
            <option value="Sold">Sold</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Price ($ CAD)</label>
          <input className={inputClass} type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Bedrooms</label>
          <input className={inputClass} type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Bathrooms</label>
          <input className={inputClass} value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} placeholder='e.g. "2.5"' />
        </div>
        <div>
          <label className={labelClass}>Living Area (sq ft)</label>
          <input className={inputClass} type="number" value={livingAreaSqft} onChange={(e) => setLivingAreaSqft(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Lot Size</label>
          <div className="flex gap-2 min-w-0">
            <input
              className={`flex-1 min-w-0 ${fieldClass}`}
              type="number"
              step="0.01"
              value={lotSizeValue}
              onChange={(e) => setLotSizeValue(e.target.value)}
            />
            <select
              className={`w-24 shrink-0 ${fieldClass}`}
              value={lotSizeUnit}
              onChange={(e) => handleUnitChange(e.target.value as LotSizeUnit)}
            >
              <option value="sqft">sq ft</option>
              <option value="acres">acres</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Year Built</label>
          <input className={inputClass} type="number" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Annual Property Taxes ($)</label>
          <input className={inputClass} type="number" value={propertyTaxes} onChange={(e) => setPropertyTaxes(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Date Listed</label>
          <input
            className={inputClass}
            type="date"
            value={dateListed}
            onChange={(e) => setDateListed(e.target.value)}
          />
          <p className="mt-1 text-white/40 text-[11px]">
            Orders the listing pages. Not shown on the site. Blank sorts to the end.
          </p>
        </div>
        <div>
          <label className={labelClass}>MLS Number</label>
          <input className={inputClass} value={mlsNumber} onChange={(e) => setMlsNumber(e.target.value)} />
        </div>
      </div>

      <div className="mb-6">
        <label className={labelClass}>Property Type</label>
        <div className="flex flex-wrap gap-3">
          {PROPERTY_TYPE_OPTIONS.map((type) => (
            <label key={type} className="flex items-center gap-1.5 text-white/80 text-[13px]">
              <input
                type="checkbox"
                checked={propertyType.includes(type)}
                onChange={() => togglePropertyType(type)}
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <label className={labelClass}>Description</label>
        <textarea
          className={`${inputClass} h-[140px] resize-y`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="mb-6">
        <label className={labelClass}>Main / Featured Image</label>
        {mainImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl(mainImage, 300) || ""} alt="" className="w-[160px] h-[120px] object-cover mb-2" />
        )}
        <input ref={mainImageInputRef} type="file" accept="image/*" onChange={handleMainImageSelect} className="text-white/60 text-[13px]" />
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <label className={labelClass.replace(" mb-1", "")}>
            Gallery{gallery.length > 1 && <span className="text-white/30"> · drag to reorder</span>}
          </label>
          {gallery.length > 1 && (
            <button
              type="button"
              onClick={reverseGallery}
              className="text-[12px] text-white/60 hover:text-[#daaf3a] border border-white/15 hover:border-[#daaf3a]/60 px-2 py-0.5"
            >
              Reverse order
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-3 mb-2">
          {gallery.map((img, i) => (
            <div
              key={img.asset._ref + i}
              draggable
              data-gallery-index={i}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                setDragIndex(i);
              }}
              onDragOver={(e) => {
                e.preventDefault(); // required, or the browser refuses the drop
                if (dragOverIndex !== i) setDragOverIndex(i);
              }}
              onDragLeave={() => setDragOverIndex((cur) => (cur === i ? null : cur))}
              onDrop={(e) => {
                e.preventDefault();
                handleGalleryDrop(i);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setDragOverIndex(null);
              }}
              className={`relative cursor-grab active:cursor-grabbing select-none ${
                dragIndex === i ? "opacity-40" : ""
              } ${dragOverIndex === i && dragIndex !== i ? "ring-2 ring-[#daaf3a]" : ""}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl(img, 200) || ""} alt="" draggable={false} className="w-[110px] h-[80px] object-cover pointer-events-none" />
              <span className="absolute top-1 left-1 bg-black/60 text-white/80 text-[10px] leading-none px-1.5 py-0.5">{i + 1}</span>
              <div className="flex justify-center mt-1">
                <button type="button" onClick={() => removeGalleryImage(i)} className="text-red-400/70 hover:text-red-400 text-[11px]">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <input ref={galleryInputRef} type="file" accept="image/*" multiple onChange={handleGallerySelect} className="text-white/60 text-[13px]" />
        {uploading && <p className="text-white/40 text-[12px] mt-1">Uploading...</p>}
      </div>

      <div className="flex items-center gap-6 mb-8">
        <label className="flex items-center gap-1.5 text-white/80 text-[13px]">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Featured on homepage
        </label>
        <label className="flex items-center gap-1.5 text-white/80 text-[13px]">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="gold-gradient-bg text-[#09312a] font-semibold text-[13px] px-5 py-2.5 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {saved && <span className="text-[#daaf3a] text-[13px]">Saved ✓</span>}
        {isEdit && (
          <a
            href={`/listings/${listing!.slug.current}`}
            target="_blank"
            rel="noreferrer"
            className="border border-white/20 text-white/80 hover:text-[#daaf3a] hover:border-[#daaf3a]/60 text-[13px] px-4 py-2.5"
            title={published ? "Opens the live listing in a new tab" : "Unpublished — the live page will 404 until you publish and save"}
          >
            View Listing ↗
          </a>
        )}
        <Link href="/admin/listings" className="text-white/50 hover:text-white text-[13px] ml-auto">
          ← All listings
        </Link>
        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            className="border border-red-400/40 text-red-400 hover:border-red-400 text-[13px] px-4 py-2.5"
          >
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
