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

export function GooglePlacesAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter property address",
  disabled = false,
  className = "",
  id,
}: GooglePlacesAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);

  // Check if Google Maps API is loaded
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (
        typeof window !== "undefined" &&
        (window as any).google?.maps?.places?.Autocomplete
      ) {
        setIsGoogleMapsLoaded(true);
      }
    };

    checkGoogleMaps();
    const interval = setInterval(() => {
      checkGoogleMaps();
      if (isGoogleMapsLoaded) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isGoogleMapsLoaded]);

  // Initialize Autocomplete once Google Maps is loaded
  useEffect(() => {
    if (!isGoogleMapsLoaded || !inputRef.current || autocompleteRef.current) {
      return;
    }

    const input = inputRef.current;
    const google = (window as any).google;

    // Create Autocomplete instance
    const autocomplete = new google.maps.places.Autocomplete(input, {
      types: ["address"],
      fields: ["formatted_address", "address_components", "geometry"],
    });

    autocompleteRef.current = autocomplete;

    // Handle place selection
    const handlePlaceChanged = () => {
      const place = autocomplete.getPlace();
      
      if (!place) return;

      const formattedAddress = place.formatted_address || "";
      
      if (formattedAddress) {
        onChange(formattedAddress);
        if (onSelect) {
          onSelect(formattedAddress, formattedAddress);
        }
      }
    };

    // Listen for place selection
    autocomplete.addListener("place_changed", handlePlaceChanged);

    // Style the autocomplete dropdown to match Places UI Kit
    const styleAutocompleteDropdown = () => {
      // Find the pac-container (Google's autocomplete dropdown)
      const pacContainer = document.querySelector('.pac-container');
      if (pacContainer) {
        const container = pacContainer as HTMLElement;
        container.style.borderRadius = '0.5rem';
        container.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
        container.style.border = '1px solid rgba(0, 0, 0, 0.1)';
        container.style.marginTop = '4px';
        container.style.overflow = 'hidden';

        // Style the items
        const items = container.querySelectorAll('.pac-item');
        items.forEach((item: Element) => {
          const el = item as HTMLElement;
          el.style.padding = '12px 16px';
          el.style.cursor = 'pointer';
          el.style.borderBottom = '1px solid rgba(0, 0, 0, 0.05)';
          el.style.fontSize = '0.9375rem';
          
          // Hover state
          el.addEventListener('mouseenter', () => {
            el.style.backgroundColor = 'rgba(0, 0, 0, 0.03)';
          });
          el.addEventListener('mouseleave', () => {
            el.style.backgroundColor = 'transparent';
          });
        });

        // Remove last item border
        if (items.length > 0) {
          const lastItem = items[items.length - 1] as HTMLElement;
          lastItem.style.borderBottom = 'none';
        }
      }
    };

    // Apply styling when dropdown appears
    const observer = new MutationObserver(styleAutocompleteDropdown);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Apply immediately in case dropdown already exists
    styleAutocompleteDropdown();

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
      observer.disconnect();
    };
  }, [isGoogleMapsLoaded, onChange, onSelect]);

  // Handle input value changes (for controlled component behavior)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="relative w-full">
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

      {/* Input field */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        id={id}
        className={`w-full rounded-2xl border-2 border-[#1E1E1E]/20 bg-white px-6 py-4 pl-12 pr-12 text-base text-[#1E1E1E] placeholder:text-[#1E1E1E]/50 focus:border-[#DC2626] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      />
    </div>
  );
}
