"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function ApplyPage() {
  const params = useParams<{ unitId: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: params.unitId,
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          employment: fd.get("employment"),
          employer: fd.get("employer") || undefined,
          income: Number(fd.get("income")),
          rentalHistory: fd.get("rentalHistory") || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to submit application");
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      toast.error("Something went wrong");
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4">
        <Card className="w-full max-w-md border-border text-center">
          <CardContent className="p-8">
            <div className="mb-4 text-4xl">&#10003;</div>
            <h2 className="text-xl font-bold">Application Submitted!</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The landlord will review your application and get back to you.
            </p>
            <Link href="/listings" className="mt-4 inline-block">
              <Button variant="outline">Back to Listings</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
          <Link href="/">
            <Image src="/logo-white.svg" alt="DoorStax" width={130} height={30} />
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-12">
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Rental Application</CardTitle>
            <CardDescription>Fill out your information to apply.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" type="tel" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employment">Employment Status</Label>
                  <Input id="employment" name="employment" placeholder="Employed, Self-employed..." required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employer">Employer (optional)</Label>
                  <Input id="employer" name="employer" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="income">Annual Income ($)</Label>
                <Input id="income" name="income" type="number" min="0" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rentalHistory">Rental History (optional)</Label>
                <Input id="rentalHistory" name="rentalHistory" placeholder="Previous landlord, duration..." />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Submitting..." : "Submit Application"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
