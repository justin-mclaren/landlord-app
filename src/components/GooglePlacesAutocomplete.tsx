"use client";

import { useEffect, useRef, useState } from "react";

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (address: string, fullAddress: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "gmp-basic-place-autocomplete": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "location-bias"?: string;
          "requested-result-types"?: string;
        },
        HTMLElement
      >;
    }
  }
}

export function GooglePlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter property address",
  disabled = false,
  className = "",
  id,
}: GooglePlacesAutocompleteProps) {
  const autocompleteRef = useRef<HTMLElement | null>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check if Google Maps API is loaded
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (typeof window !== "undefined" && (window as any).google?.maps) {
        setIsGoogleMapsLoaded(true);
      }
    };

    // Check immediately
    checkGoogleMaps();

    // Check periodically until loaded
    const interval = setInterval(() => {
      checkGoogleMaps();
      if (isGoogleMapsLoaded) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isGoogleMapsLoaded]);

  // Initialize the web component once Google Maps is loaded
  useEffect(() => {
    if (!isGoogleMapsLoaded || isInitialized) {
      return;
    }

    // Wait for the element to be available
    const checkElement = setInterval(() => {
      if (autocompleteRef.current) {
        clearInterval(checkElement);
        initializeComponent();
      }
    }, 100);

    let cleanup: (() => void) | null = null;

    const initializeComponent = () => {
      const element = autocompleteRef.current as any;
      if (!element) return;

      // Handle place selection
      const handleSelect = async (event: CustomEvent) => {
        const place = (event as any).detail?.place || (event as any).place;
        if (!place) return;

        // Get the formatted address from the place object
        let formattedAddress = "";
        
        // Try different properties that might contain the address
        if (place.formattedAddress) {
          formattedAddress = place.formattedAddress;
        } else if (place.formattedAddressText?.value) {
          formattedAddress = place.formattedAddressText.value;
        } else if (place.displayName) {
          formattedAddress = place.displayName;
        } else if (place.formattedAddressText) {
          formattedAddress = place.formattedAddressText;
        }

        // If we still don't have an address, try to get it from the input value
        if (!formattedAddress && element.value) {
          formattedAddress = element.value;
        }

        if (formattedAddress) {
          onChange(formattedAddress);
          if (onSelect) {
            onSelect(formattedAddress, formattedAddress);
          }
        }
      };

      // Add event listener
      element.addEventListener("gmp-select", handleSelect);

      // Set location bias to improve results (optional - can be configured)
      // You can set this based on user's detected country or other preferences
      if (typeof (window as any).google?.maps?.Circle !== "undefined") {
        // Default to US center, but this can be made dynamic
        const defaultCenter = { lat: 37.7749, lng: -122.4194 }; // San Francisco
        element.locationBias = new (window as any).google.maps.Circle({
          center: defaultCenter,
          radius: 50000, // 50km radius
        });
      }

      setIsInitialized(true);

      // Store cleanup function
      cleanup = () => {
        element.removeEventListener("gmp-select", handleSelect);
      };
    };

    return () => {
      clearInterval(checkElement);
      if (cleanup) {
        cleanup();
      }
    };
  }, [isGoogleMapsLoaded, isInitialized, onChange, onSelect]);

  // Handle input value changes (for controlled component behavior)
  useEffect(() => {
    if (autocompleteRef.current && value) {
      const element = autocompleteRef.current as any;
      // Update the input value if needed
      // Note: The web component manages its own input, so we mainly sync on selection
    }
  }, [value]);

  return (
    <div className={`relative w-full ${className}`}>
      {/* Search icon - positioned on the left */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
        <svg
          className="h-5 w-5 text-[#1E1E1E]/40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Google Places UI Kit Web Component */}
      {isGoogleMapsLoaded ? (
        <div style={{ position: "relative", width: "100%" }}>
          <gmp-basic-place-autocomplete
            ref={autocompleteRef}
            id={id}
            placeholder={placeholder}
            disabled={disabled}
            requested-result-types="address"
            style={{
              width: "100%",
              minHeight: "56px",
              paddingLeft: "48px",
              paddingRight: "24px",
              borderRadius: "1rem",
              border: "2px solid rgba(30, 30, 30, 0.2)",
              backgroundColor: "white",
              fontSize: "1rem",
              color: "#1E1E1E",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      ) : (
        // Fallback input while Google Maps loads
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          id={id}
          className="w-full rounded-2xl border-2 border-[#1E1E1E]/20 bg-white px-6 py-4 pl-12 pr-12 text-base text-[#1E1E1E] placeholder-[#1E1E1E]/50 focus:border-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20"
        />
      )}
    </div>
  );
}

