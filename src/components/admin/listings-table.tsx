"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Search, Check, X } from "lucide-react";

interface ListingRow {
  id: string;
  propertyName: string;
  unitNumber: string;
  landlordId: string;
  landlordName: string;
  city: string;
  state: string;
  bedrooms: number;
  rent: number;
  status: string;
  listingEnabled: boolean;
  applicationsEnabled: boolean;
}

interface ListingsTableProps {
  rows: ListingRow[];
  landlords: { id: string; name: string }[];
  cities: string[];
}

const listingOptions = [
  { label: "All", value: "ALL" },
  { label: "Listed", value: "YES" },
  { label: "Unlisted", value: "NO" },
];

export function ListingsTable({ rows, landlords, cities }: ListingsTableProps) {
  const [search, setSearch] = useState("");
  const [landlordFilter, setLandlordFilter] = useState("ALL");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [listingFilter, setListingFilter] = useState("ALL");

  const filtered = rows.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.propertyName.toLowerCase().includes(q) &&
        !r.unitNumber.toLowerCase().includes(q)
      )
        return false;
    }
    if (landlordFilter !== "ALL" && r.landlordId !== landlordFilter) return false;
    if (cityFilter !== "ALL" && r.city !== cityFilter) return false;
    if (listingFilter === "YES" && !r.listingEnabled) return false;
    if (listingFilter === "NO" && r.listingEnabled) return false;
    return true;
  });

  const listedCount = filtered.filter((r) => r.listingEnabled).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by property or unit..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={landlordFilter}
          onChange={(e) => setLandlordFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="ALL">All Managers</option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="ALL">All Cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <div className="flex gap-1">
          {listingOptions.map((o) => (
            <Button
              key={o.value}
              variant={listingFilter === o.value ? "default" : "outline"}
              size="sm"
              onClick={() => setListingFilter(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {listedCount} listed / {filtered.length} total
        </span>
      </div>

      <div className="rounded-lg border border-border card-glow">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Property</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Landlord</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="text-right">Beds</TableHead>
              <TableHead className="text-right">Rent</TableHead>
              <TableHead>Unit Status</TableHead>
              <TableHead>Listed</TableHead>
              <TableHead>Apps</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No listings match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id} className="border-border">
                  <TableCell className="font-medium">{row.propertyName}</TableCell>
                  <TableCell>{row.unitNumber}</TableCell>
                  <TableCell>{row.landlordName}</TableCell>
                  <TableCell>{row.city}, {row.state}</TableCell>
                  <TableCell className="text-right">{row.bedrooms}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.rent)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.status === "OCCUPIED"
                          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/20"
                          : "bg-blue-500/15 text-blue-500 border-blue-500/20"
                      }
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.listingEnabled ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    {row.applicationsEnabled ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
