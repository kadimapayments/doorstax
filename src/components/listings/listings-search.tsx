"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { MapPin, Bed, Bath, Maximize } from "lucide-react";

interface Listing {
  id: string;
  unitNumber: string;
  bedrooms: number | null;
  bathrooms: number | null;
  sqft: number | null;
  rentAmount: string | number;
  photos: string[];
  property: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    photos: string[];
  };
}

interface ListingsSearchProps {
  initialListings: Listing[];
}

export function ListingsSearch({ initialListings }: ListingsSearchProps) {
  const [search, setSearch] = useState("");
  const [beds, setBeds] = useState("any");
  const [baths, setBaths] = useState("any");
  const [minRent, setMinRent] = useState("");
  const [maxRent, setMaxRent] = useState("");
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInteracted = useRef(false);

  const fetchListings = useCallback(async () => {
    const params = new URLSearchParams();

    if (search) params.set("search", search);

    if (beds !== "any") {
      if (beds === "4") {
        params.set("minBeds", "4");
      } else {
        params.set("minBeds", beds);
        params.set("maxBeds", beds);
      }
    }

    if (baths !== "any") {
      if (baths === "3") {
        params.set("minBaths", "3");
      } else {
        params.set("minBaths", baths);
        params.set("maxBaths", baths);
      }
    }

    if (minRent) params.set("minRent", minRent);
    if (maxRent) params.set("maxRent", maxRent);

    setLoading(true);
    try {
      const res = await fetch(`/api/public/listings?${params.toString()}`);
      const data = await res.json();
      setListings(Array.isArray(data) ? data : []);
    } catch {
      // keep current listings on error
    } finally {
      setLoading(false);
    }
  }, [search, beds, baths, minRent, maxRent]);

  useEffect(() => {
    if (!hasInteracted.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      fetchListings();
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fetchListings]);

  function handleChange<T>(setter: (v: T) => void) {
    return (v: T) => {
      hasInteracted.current = true;
      setter(v);
    };
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-auto sm:min-w-[200px]">
          <Label htmlFor="search" className="mb-1.5 block text-sm">
            City / ZIP
          </Label>
          <Input
            id="search"
            placeholder="Search city or ZIP..."
            value={search}
            onChange={(e) => handleChange(setSearch)(e.target.value)}
          />
        </div>

        <div>
          <Label className="mb-1.5 block text-sm">Beds</Label>
          <Select value={beds} onValueChange={handleChange(setBeds)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="0">Studio</SelectItem>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="mb-1.5 block text-sm">Baths</Label>
          <Select value={baths} onValueChange={handleChange(setBaths)}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3+</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="minRent" className="mb-1.5 block text-sm">
            Min Rent
          </Label>
          <Input
            id="minRent"
            type="number"
            placeholder="$0"
            className="w-[110px]"
            value={minRent}
            onChange={(e) => handleChange(setMinRent)(e.target.value)}
          />
        </div>

        <div>
          <Label htmlFor="maxRent" className="mb-1.5 block text-sm">
            Max Rent
          </Label>
          <Input
            id="maxRent"
            type="number"
            placeholder="No max"
            className="w-[110px]"
            value={maxRent}
            onChange={(e) => handleChange(setMaxRent)(e.target.value)}
          />
        </div>
      </div>

      {/* Results count */}
      <p className="mt-6 text-sm text-muted-foreground">
        {loading
          ? "Searching..."
          : `${listings.length} listing${listings.length !== 1 ? "s" : ""} found`}
      </p>

      {/* Results grid */}
      {listings.length === 0 && !loading ? (
        <div className="mt-12 text-center text-muted-foreground">
          <p>No listings match your filters. Try broadening your search.</p>
        </div>
      ) : (
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((unit) => (
            <Link key={unit.id} href={`/listings/${unit.id}`}>
              <Card className="border-border transition-colors hover:border-border-hover overflow-hidden">
                <div className="relative aspect-[16/10] bg-muted">
                  {unit.photos?.[0] ? (
                    <Image
                      src={unit.photos[0]}
                      alt={`${unit.property.name} Unit ${unit.unitNumber}`}
                      fill
                      className="object-cover"
                    />
                  ) : unit.property.photos?.[0] ? (
                    <Image
                      src={unit.property.photos[0]}
                      alt={unit.property.name}
                      fill
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <CardContent className="p-5">
                  <p className="text-2xl font-bold">
                    {formatCurrency(Number(unit.rentAmount))}
                    <span className="text-sm font-normal text-muted-foreground">
                      /mo
                    </span>
                  </p>
                  <h3 className="mt-1 font-semibold">
                    {unit.property.name} — Unit {unit.unitNumber}
                  </h3>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {unit.property.city}, {unit.property.state}
                  </p>
                  <div className="mt-3 flex gap-4 text-sm text-muted-foreground">
                    {unit.bedrooms !== null && (
                      <span className="flex items-center gap-1">
                        <Bed className="h-3.5 w-3.5" /> {unit.bedrooms} bed
                      </span>
                    )}
                    {unit.bathrooms !== null && (
                      <span className="flex items-center gap-1">
                        <Bath className="h-3.5 w-3.5" /> {unit.bathrooms} bath
                      </span>
                    )}
                    {unit.sqft !== null && (
                      <span className="flex items-center gap-1">
                        <Maximize className="h-3.5 w-3.5" /> {unit.sqft} sqft
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
