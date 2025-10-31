"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface AddressSuggestion {
  place_name: string;
  center: [number, number]; // [longitude, latitude]
  context?: Array<{
    id: string;
    text: string;
  }>;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (address: string, fullAddress: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Enter property address",
  disabled = false,
  className = "",
  id,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Detect user's country on mount
  useEffect(() => {
    // Try to detect country from browser locale first
    try {
      const locale = navigator.language || (navigator as any).userLanguage;
      // Extract country code from locale (e.g., "en-US" -> "US")
      const localeCountry = locale.split('-')[1]?.toUpperCase();
      if (localeCountry && localeCountry.length === 2) {
        setCountryCode(localeCountry);
        return;
      }
    } catch (e) {
      // Fallback to IP geolocation
    }

    // Fallback: Try to detect country via IP geolocation (free service)
    fetch('https://ipapi.co/json/')
      .then((res) => res.json())
      .then((data) => {
        if (data.country_code) {
          setCountryCode(data.country_code.toUpperCase());
        }
      })
      .catch((err) => {
        console.log('Could not detect country:', err);
        // Default to US if detection fails
        setCountryCode('US');
      });
  }, []);

  // Debounced search function
  const searchAddresses = useCallback(
    async (query: string) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery || trimmedQuery.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);
      console.log("Searching addresses for:", trimmedQuery);

      try {
        // Call our API route for address autocomplete
        // Include country code if available to filter results
        const countryParam = countryCode ? `&country=${countryCode}` : '';
        const apiUrl = `/api/geocode/autocomplete?q=${encodeURIComponent(trimmedQuery)}${countryParam}`;
        console.log("Fetching from:", apiUrl, "country:", countryCode);
        
        const response = await fetch(apiUrl);

        console.log("API response status:", response.status, response.ok);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Autocomplete API error:", response.status, errorData);
          
          // Don't throw - just show empty results
          setSuggestions([]);
          setShowSuggestions(false);
          setIsLoading(false);
          return;
        }

        const data = await response.json();
        const suggestionsList = data.suggestions || [];
        
        console.log("Autocomplete response data:", data);
        console.log("Suggestions received:", suggestionsList.length, suggestionsList);
        
        setSuggestions(suggestionsList);
        setShowSuggestions(suggestionsList.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.error("Address autocomplete error:", error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoading(false);
      }
    },
    [countryCode]
  );

  // Handle input change with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer for debounced search
    debounceTimerRef.current = setTimeout(() => {
      console.log("Debounce timer fired, calling searchAddresses with:", newValue);
      if (newValue.trim().length >= 2) {
        searchAddresses(newValue);
      }
    }, 200); // 200ms debounce (reduced for faster response)
  };

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
    const address = suggestion.place_name;
    onChange(address);
    setShowSuggestions(false);
    setSuggestions([]);
    if (onSelect) {
      onSelect(address, address);
    }
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        return;
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        } else if (suggestions.length > 0) {
          handleSelectSuggestion(suggestions[0]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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

      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          // If we have suggestions, show them
          if (suggestions.length > 0) {
            setShowSuggestions(true);
          }
          // If we have a value but no suggestions, trigger a search
          else if (value.trim().length >= 2) {
            console.log("Input focused with value, triggering search");
            searchAddresses(value);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        aria-controls={showSuggestions ? "address-suggestions" : undefined}
      />

      {/* Loading indicator - shows only when loading, positioned on the right */}
      {isLoading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
          <svg
            className="h-5 w-5 animate-spin text-[#1E1E1E]/40"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}


      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          id="address-suggestions"
          className="absolute left-0 right-0 z-[100] mt-1 max-h-60 w-full overflow-auto rounded-xl border-2 border-[#1E1E1E]/20 bg-white shadow-xl"
          role="listbox"
          style={{ top: "calc(100% + 4px)" }}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.place_name}-${index}`}
              type="button"
              onClick={() => handleSelectSuggestion(suggestion)}
              className={`w-full px-4 py-3 text-left text-sm text-[#1E1E1E] transition-colors hover:bg-[#DC2626]/10 focus:bg-[#DC2626]/10 focus:outline-none ${
                index === selectedIndex ? "bg-[#DC2626]/10" : ""
              } ${index === 0 ? "rounded-t-xl" : ""} ${
                index === suggestions.length - 1 ? "rounded-b-xl" : ""
              }`}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <div className="font-medium">{suggestion.place_name}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

