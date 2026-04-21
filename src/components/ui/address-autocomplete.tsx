"use client";

import { useEffect, useRef, useState } from "react";

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

  // Load Google Maps JS API once
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn(
        "[AddressAutocomplete] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set — autocomplete disabled"
      );
      return;
    }

    if (window.google?.maps?.places) {
      setLoaded(true);
      return;
    }

    // If the script is already in the document, just wait for it
    const existing = document.querySelector(
      'script[src*="maps.googleapis.com"]'
    );
    if (existing) {
      const check = setInterval(() => {
        if (window.google?.maps?.places) {
          setLoaded(true);
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
    script.onload = () => setLoaded(true);
    script.onerror = () => {
      console.error("[AddressAutocomplete] Failed to load Google Maps script");
    };
    document.head.appendChild(script);
  }, []);

  // Initialize autocomplete once the library is ready
  useEffect(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return;

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

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={loaded ? placeholder : "Enter address manually..."}
        disabled={disabled}
        className={
          className ||
          "w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        }
        autoComplete="off"
      />
      {!loaded && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Loading address suggestions...
        </p>
      )}
      {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <p className="text-[10px] text-amber-600 mt-0.5">
          Address autocomplete is off in this environment. Ask an admin to
          set <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable Google
          Places suggestions — or type the address manually.
        </p>
      )}
    </div>
  );
}
