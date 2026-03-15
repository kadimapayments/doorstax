"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Search } from "lucide-react";

interface PropertyRow {
  id: string;
  name: string;
  landlordId: string;
  landlordName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  totalUnits: number;
  occupiedUnits: number;
  avgRent: number;
}

interface PropertiesTableProps {
  rows: PropertyRow[];
  landlords: { id: string; name: string }[];
  cities: string[];
}

const occupancyOptions = [
  { label: "All", value: "ALL" },
  { label: ">90%", value: "HIGH" },
  { label: "60-90%", value: "MID" },
  { label: "<60%", value: "LOW" },
];

export function PropertiesTable({ rows, landlords, cities }: PropertiesTableProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [landlordFilter, setLandlordFilter] = useState("ALL");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [occupancyFilter, setOccupancyFilter] = useState("ALL");

  const filtered = rows.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.name.toLowerCase().includes(q) &&
        !r.address.toLowerCase().includes(q)
      )
        return false;
    }
    if (landlordFilter !== "ALL" && r.landlordId !== landlordFilter) return false;
    if (cityFilter !== "ALL" && r.city !== cityFilter) return false;
    if (occupancyFilter !== "ALL") {
      const pct = r.totalUnits > 0 ? (r.occupiedUnits / r.totalUnits) * 100 : 0;
      if (occupancyFilter === "HIGH" && pct <= 90) return false;
      if (occupancyFilter === "MID" && (pct < 60 || pct > 90)) return false;
      if (occupancyFilter === "LOW" && pct >= 60) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or address..."
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
          {occupancyOptions.map((o) => (
            <Button
              key={o.value}
              variant={occupancyFilter === o.value ? "default" : "outline"}
              size="sm"
              onClick={() => setOccupancyFilter(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} propert{filtered.length !== 1 ? "ies" : "y"}
        </span>
      </div>

      <div className="rounded-lg border border-border card-glow">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Landlord</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Units</TableHead>
              <TableHead className="text-right">Occupancy</TableHead>
              <TableHead className="text-right">Avg Rent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No properties match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => {
                const occupancy = row.totalUnits > 0 ? Math.round((row.occupiedUnits / row.totalUnits) * 100) : 0;
                return (
                  <TableRow
                    key={row.id}
                    className="border-border cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/admin/properties/${row.id}`)}
                  >
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.landlordName}</TableCell>
                    <TableCell>{row.city}</TableCell>
                    <TableCell>{row.state}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {row.propertyType.toLowerCase().replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.occupiedUnits}/{row.totalUnits}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={occupancy >= 85 ? "text-emerald-500" : occupancy >= 60 ? "" : "text-destructive"}>
                        {occupancy}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.avgRent)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
