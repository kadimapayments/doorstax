"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AddressComponents {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  fullAddress: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onSelect: (components: AddressComponents) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/**
 * AddressAutocomplete — Google Places-backed address picker.
 *
 * Loads the Maps JS SDK on demand (once per page) and attaches the
 * legacy `google.maps.places.Autocomplete` constructor to the input.
 *
 * Required env: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (browser-exposed; lock
 * the key down by HTTP referrer + API restriction in Google Cloud Console).
 *
 * Required Cloud Console APIs on the project that owns the key:
 *   - Maps JavaScript API
 *   - Places API
 *   - Places API (New)         ← required for keys minted ≥ 2025-03-01
 *
 * Failure modes we surface:
 *   - **No key** → render the input + a yellow banner asking an admin
 *     to set the env var. PM can still type the address by hand.
 *   - **Script load error** → red banner with the actual error so it's
 *     not just silent.
 *   - **Legacy constructor unavailable** (`places.Autocomplete` is
 *     undefined even though the SDK loaded) → most common cause is a
 *     post-2025-03-01 key without "Places API (New)" enabled, OR a key
 *     that's restricted by referrer/API in a way that excludes Places.
 *     We log a precise diagnostic to the console and switch the banner
 *     to "Places API access blocked — check Cloud Console restrictions."
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address...",
  className = "",
  disabled = false,
  id,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<
    null | "no-key" | "script-failed" | "places-unavailable"
  >(null);

  // Load Google Maps JS API once
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setError("no-key");
      return;
    }

    if (window.google?.maps?.places) {
      setLoaded(true);
      return;
    }

    // If the script tag is already on the page (another instance of
    // this component beat us to it), poll for `places` availability
    // instead of injecting a duplicate <script>.
    const existing = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    );
    if (existing) {
      const startedAt = Date.now();
      const check = setInterval(() => {
        if (window.google?.maps?.places) {
          setLoaded(true);
          clearInterval(check);
        } else if (Date.now() - startedAt > 8000) {
          // 8s without `places` showing up = the SDK loaded but the
          // Places library was rejected (key restriction, API not
          // enabled, etc.). Bail with a precise error so it's not a
          // silent permanent spinner.
          setError("places-unavailable");
          clearInterval(check);
        }
      }, 100);
      return () => clearInterval(check);
    }

    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(apiKey) +
      "&libraries=places";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // SDK loaded — but `places` may still be missing if the key
      // doesn't have Places API enabled / authorized. Re-check.
      if (window.google?.maps?.places) {
        setLoaded(true);
      } else {
        console.error(
          "[AddressAutocomplete] Maps SDK loaded but `places` is not " +
            "available. Most common causes:\n" +
            "  1. The API key was created on/after 2025-03-01 and the " +
            "Cloud project does NOT have 'Places API (New)' enabled.\n" +
            "  2. The key has API restrictions that exclude Places API.\n" +
            "  3. The key has HTTP referrer restrictions that block " +
            window.location.origin
        );
        setError("places-unavailable");
      }
    };
    script.onerror = () => {
      console.error(
        "[AddressAutocomplete] Failed to load Google Maps script — " +
          "check the network tab for the maps.googleapis.com request. " +
          "Likely causes: invalid API key, billing not enabled on the " +
          "Cloud project, or HTTP referrer restriction blocking " +
          window.location.origin
      );
      setError("script-failed");
    };
    document.head.appendChild(script);
  }, []);

  // Initialize autocomplete once the library is ready
  useEffect(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return;

    // Final guard: even though `loaded` is true, the legacy constructor
    // can be undefined on accounts that only have Places API (New)
    // enabled. Detect that here and degrade cleanly instead of throwing.
    if (typeof google.maps.places.Autocomplete !== "function") {
      console.error(
        "[AddressAutocomplete] `google.maps.places.Autocomplete` is not a " +
          "function. This is the legacy constructor — it was sunset for " +
          "new customers on 2025-03-01. If your API key is new, enable " +
          "the legacy 'Places API' alongside 'Places API (New)' in Cloud " +
          "Console, OR migrate this component to <gmp-place-autocomplete>."
      );
      setError("places-unavailable");
      return;
    }

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address", "geometry"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.address_components) return;

      const components: AddressComponents = {
        street: "",
        city: "",
        state: "",
        zip: "",
        country: "",
        fullAddress: place.formatted_address || "",
      };

      let streetNumber = "";
      let route = "";

      for (const component of place.address_components) {
        const type = component.types[0];
        switch (type) {
          case "street_number":
            streetNumber = component.long_name;
            break;
          case "route":
            route = component.long_name;
            break;
          case "locality":
          case "sublocality_level_1":
            if (!components.city) components.city = component.long_name;
            break;
          case "administrative_area_level_1":
            components.state = component.short_name;
            break;
          case "postal_code":
            components.zip = component.long_name;
            break;
          case "country":
            components.country = component.short_name;
            break;
        }
      }

      components.street = `${streetNumber} ${route}`.trim();
      onChange(components.street);
      onSelect(components);
    });

    autocompleteRef.current = autocomplete;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const showSpinner = !loaded && !error;
  const showStatusBanner = error !== null;

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className={
            "absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none " +
            (loaded ? "text-primary" : "text-muted-foreground")
          }
        />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            error
              ? "Type the address manually..."
              : loaded
                ? placeholder
                : "Loading address suggestions..."
          }
          disabled={disabled}
          // The component owns the left padding because it owns the
          // icon. Whatever className the consumer passes, force `pl-9`
          // last via tailwind-merge so it wins against any `px-*` /
          // `pl-*` they bring with them (e.g. the property wizard
          // ships `px-3` — without this the icon would sit behind the
          // placeholder text).
          className={cn(
            className ||
              "w-full rounded-lg border bg-background pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20",
            "pl-9"
          )}
          autoComplete="off"
        />
      </div>

      {showSpinner && (
        <p className="text-[10px] text-muted-foreground mt-1">
          Loading Google Places…
        </p>
      )}

      {showStatusBanner && (
        <div className="mt-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-[11px] text-amber-700 dark:text-amber-400 leading-snug">
            {error === "no-key" && (
              <>
                Address suggestions are off in this environment. Set{" "}
                <code className="font-mono text-[10px] bg-amber-500/10 rounded px-1">
                  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
                </code>{" "}
                in Vercel (Settings → Environment Variables → Production)
                and redeploy. Type the address manually for now.
              </>
            )}
            {error === "script-failed" && (
              <>
                Google Maps couldn&apos;t load — check the browser console
                for the exact reason (most often: invalid key, billing not
                enabled on the Cloud project, or HTTP referrer
                restriction blocking this domain). Type the address
                manually for now.
              </>
            )}
            {error === "places-unavailable" && (
              <>
                Google Maps loaded but Places API is blocked for this key.
                Open Cloud Console → Credentials → the API key, and:
                <ul className="list-disc ml-4 mt-0.5">
                  <li>
                    enable <em>Places API</em> AND <em>Places API (New)</em>
                  </li>
                  <li>
                    add this domain to HTTP referrer restrictions:{" "}
                    <code className="font-mono text-[10px]">
                      {typeof window !== "undefined"
                        ? window.location.origin
                        : "<your-domain>"}
                      /*
                    </code>
                  </li>
                </ul>
                Type the address manually for now.
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
