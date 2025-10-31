"use client";

import { useEffect, useRef, useState } from "react";
import type { AugmentJSON } from "@/types/augment";

interface PropertyMapProps {
  lat: number;
  lon: number;
  address: string;
  locationInsights?: AugmentJSON["location_insights"];
  noise?: AugmentJSON["noise"];
}

export function PropertyMap({
  lat,
  lon,
  address,
  locationInsights,
  noise,
}: PropertyMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Check if Google Maps API is loaded
  useEffect(() => {
    const checkGoogleMaps = () => {
      if (
        typeof window !== "undefined" &&
        (window as any).google?.maps?.Map
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

  // Initialize map
  useEffect(() => {
    if (!isGoogleMapsLoaded || !mapRef.current || mapInstanceRef.current) {
      return;
    }

    try {
      const google = (window as any).google;

      // Custom map style to match design system (light, clean aesthetic)
      // Enhanced to highlight highways when noise is high
      const mapStyle: google.maps.MapTypeStyle[] = [
        {
          featureType: "all",
          elementType: "geometry",
          stylers: [{ color: "#f8f8f8" }],
        },
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#e8e8e8" }],
        },
        {
          featureType: "road",
          elementType: "geometry",
          stylers: [{ color: "#ffffff" }],
        },
        {
          featureType: "road",
          elementType: "labels.text.fill",
          stylers: [{ color: "#1E1E1E" }],
        },
        // Highlight highways when noise is high
        ...(noise && (noise.level === "high" || noise.level === "medium")
          ? [
              {
                featureType: "road.highway",
                elementType: "geometry",
                stylers: [
                  { color: "#F59E0B" },
                  { visibility: "on" },
                ],
              },
              {
                featureType: "road.highway",
                elementType: "geometry.stroke",
                stylers: [
                  { color: "#F59E0B" },
                  { weight: 3 },
                ],
              },
              {
                featureType: "road.highway",
                elementType: "labels.text.fill",
                stylers: [{ color: "#1E1E1E" }],
              },
            ]
          : []),
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "poi.business",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
      ];

      // Create map
      const map = new google.maps.Map(mapRef.current, {
        center: { lat, lng: lon },
        zoom: 14,
        styles: mapStyle,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
        zoomControlOptions: {
          position: google.maps.ControlPosition.RIGHT_CENTER,
        },
      });

      mapInstanceRef.current = map;

      // Add radius circles (1 mile and 2 miles)
      const mileInMeters = 1609.34; // 1 mile in meters

      // 2-mile circle (outer, lighter)
      const circle2mi = new google.maps.Circle({
        strokeColor: "#DC2626",
        strokeOpacity: 0.15,
        strokeWeight: 1,
        fillColor: "#DC2626",
        fillOpacity: 0.02,
        map,
        center: { lat, lng: lon },
        radius: mileInMeters * 2,
      });

      // 1-mile circle (inner, more visible)
      const circle1mi = new google.maps.Circle({
        strokeColor: "#DC2626",
        strokeOpacity: 0.3,
        strokeWeight: 2,
        fillColor: "#DC2626",
        fillOpacity: 0.05,
        map,
        center: { lat, lng: lon },
        radius: mileInMeters,
      });

      circlesRef.current = [circle1mi, circle2mi];

      // Property marker (custom red pin with shadow effect)
      const propertyMarker = new google.maps.Marker({
        position: { lat, lng: lon },
        map,
        title: address,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: "#DC2626",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 3,
        },
        zIndex: 1000,
      });

      markersRef.current.push(propertyMarker);

      // Add markers for noise sources if noise level is high/medium
      if (noise && (noise.level === "high" || noise.level === "medium")) {
        const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        
        if (googleMapsApiKey) {
          // Find nearby highways/freeways - always show marker if noise is high/medium
          if (noise.motorway_distance_m !== undefined && noise.motorway_distance_m < 2000) {
            // Always create a marker - use calculated position from distance
            const offset = noise.motorway_distance_m || 500; // meters
            // Convert meters to degrees (rough approximation: 1 degree ≈ 111km)
            const offsetDegrees = offset / 111000;
            // Place marker north of property (could be adjusted based on actual highway direction)
            const highwayLat = lat + offsetDegrees;
            const highwayLng = lon;
            
            const highwayMarker = new google.maps.Marker({
              position: { lat: highwayLat, lng: highwayLng },
              map,
              title: "Nearby Highway",
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 7,
                fillColor: "#F59E0B",
                fillOpacity: 0.9,
                strokeColor: "#FFFFFF",
                strokeWeight: 2,
                rotation: 90,
              },
              zIndex: 600,
            });

            markersRef.current.push(highwayMarker);

            const highwayInfoWindow = new google.maps.InfoWindow({
              content: `
                <div style="padding: 8px; font-family: system-ui, sans-serif;">
                  <div style="font-weight: 600; color: #1E1E1E; margin-bottom: 4px;">
                    🛣️ Nearby Highway
                  </div>
                  <div style="color: #1E1E1E; font-size: 12px;">
                    ${noise.motorway_distance_m ? `~${Math.round(noise.motorway_distance_m)}m away` : "Nearby"}
                  </div>
                  <div style="color: #DC2626; font-size: 11px; margin-top: 4px;">
                    ⚠️ High noise source
                  </div>
                </div>
              `,
            });

            highwayMarker.addListener("click", () => {
              highwayInfoWindow.open(map, highwayMarker);
            });

            // Try to find actual highway names via Places API (optional enhancement)
            if (googleMapsApiKey) {
              const highwaysUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${Math.min(2000, noise.motorway_distance_m * 2)}&type=route&key=${googleMapsApiKey}`;
              
              fetch(highwaysUrl)
                .then((res) => res.json())
                .then((data) => {
                  if (data.results && data.results.length > 0) {
                    const highways = data.results
                      .filter((place: any) => {
                        const name = (place.name || "").toLowerCase();
                        const types = place.types || [];
                        return (
                          types.includes("route") ||
                          name.includes("highway") ||
                          name.includes("freeway") ||
                          name.includes("interstate") ||
                          name.includes("i-") ||
                          name.includes("us-") ||
                          name.includes("state route")
                        );
                      })
                      .slice(0, 1); // Just update the first marker with actual name
                    
                    if (highways.length > 0) {
                      const place = highways[0];
                      const placeLat = place.geometry.location.lat;
                      const placeLng = place.geometry.location.lng;
                      
                      // Update existing marker position and title
                      highwayMarker.setPosition({ lat: placeLat, lng: placeLng });
                      highwayMarker.setTitle(place.name || "Highway");
                      
                      // Update info window
                      const updatedInfoWindow = new google.maps.InfoWindow({
                        content: `
                          <div style="padding: 8px; font-family: system-ui, sans-serif;">
                            <div style="font-weight: 600; color: #1E1E1E; margin-bottom: 4px;">
                              🛣️ ${place.name || "Highway"}
                            </div>
                            <div style="color: #1E1E1E; font-size: 12px;">
                              ${noise.motorway_distance_m ? `~${Math.round(noise.motorway_distance_m)}m away` : "Nearby"}
                            </div>
                            <div style="color: #DC2626; font-size: 11px; margin-top: 4px;">
                              ⚠️ High noise source
                            </div>
                          </div>
                        `,
                      });
                      
                      // Update click listener
                      google.maps.event.clearListeners(highwayMarker, "click");
                      highwayMarker.addListener("click", () => {
                        updatedInfoWindow.open(map, highwayMarker);
                      });
                    }
                  }
                })
                .catch((error) => {
                  console.error("Error fetching highway details:", error);
                  // Keep the fallback marker
                });
            }
          }

          // Find nearby airports
          if (noise.airport_distance_m !== undefined && noise.airport_distance_m < 10000) {
            const airportsUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=10000&type=airport&key=${googleMapsApiKey}`;
            
            fetch(airportsUrl)
              .then((res) => res.json())
              .then((data) => {
                if (data.results && data.results.length > 0) {
                  // Show up to 2 nearest airports
                  data.results.slice(0, 2).forEach((place: any) => {
                    const placeLat = place.geometry.location.lat;
                    const placeLng = place.geometry.location.lng;

                    const airportMarker = new google.maps.Marker({
                      position: { lat: placeLat, lng: placeLng },
                      map,
                      title: place.name,
                      icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: "#EF4444",
                        fillOpacity: 0.9,
                        strokeColor: "#FFFFFF",
                        strokeWeight: 2,
                      },
                      zIndex: 700,
                    });

                    markersRef.current.push(airportMarker);

                    const airportInfoWindow = new google.maps.InfoWindow({
                      content: `
                        <div style="padding: 8px; font-family: system-ui, sans-serif;">
                          <div style="font-weight: 600; color: #1E1E1E; margin-bottom: 4px;">
                            ✈️ ${place.name}
                          </div>
                          <div style="color: #1E1E1E; font-size: 12px;">
                            ${noise.airport_distance_m ? `~${Math.round(noise.airport_distance_m / 1000)}km away` : "Nearby"}
                          </div>
                          <div style="color: #DC2626; font-size: 11px; margin-top: 4px;">
                            ⚠️ High noise source
                          </div>
                        </div>
                      `,
                    });

                    airportMarker.addListener("click", () => {
                      airportInfoWindow.open(map, airportMarker);
                    });
                  });
                }
              })
              .catch((error) => {
                console.error("Error fetching airports:", error);
              });
          }
        }
      }

      // Add info window for property
      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="padding: 8px; font-family: system-ui, sans-serif; max-width: 250px;">
            <div style="font-weight: 600; color: #1E1E1E; margin-bottom: 4px; font-size: 14px;">📍 Property Location</div>
            <div style="color: #1E1E1E; font-size: 13px;">${address}</div>
            ${locationInsights?.sex_offenders?.count_1mi !== undefined ? `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e5e5;">
                <div style="font-size: 12px; color: #DC2626; font-weight: 600;">
                  ⚠️ ${locationInsights.sex_offenders.count_1mi} registered sex offenders within 1 mile
                </div>
              </div>
            ` : ""}
          </div>
        `,
      });

      propertyMarker.addListener("click", () => {
        infoWindow.open(map, propertyMarker);
      });

      // Auto-open info window on load
      setTimeout(() => {
        infoWindow.open(map, propertyMarker);
      }, 500);
    } catch (error) {
      console.error("Error initializing map:", error);
      setMapError("Failed to load map");
    }

    // Cleanup
    return () => {
      markersRef.current.forEach((marker) => marker.setMap(null));
      circlesRef.current.forEach((circle) => circle.setMap(null));
      markersRef.current = [];
      circlesRef.current = [];
    };
  }, [isGoogleMapsLoaded, lat, lon, address, locationInsights, noise]);

  if (!isGoogleMapsLoaded) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-[#1E1E1E]/10 bg-gray-100">
        <div className="text-center">
          <div className="mb-2 text-sm text-[#1E1E1E]/60">Loading map...</div>
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-[#1E1E1E]/10 bg-gray-100">
        <div className="text-center">
          <div className="mb-2 text-sm text-[#DC2626]">{mapError}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className="h-[400px] w-full rounded-xl border border-[#1E1E1E]/10 overflow-hidden shadow-sm"
      />
      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#1E1E1E]/70">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#DC2626] border-2 border-white shadow-sm"></div>
          <span className="font-medium">Property Location</span>
        </div>
        {(locationInsights?.sex_offenders?.count_1mi !== undefined ||
          locationInsights?.sex_offenders?.count_2mi !== undefined) && (
          <>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full border-2 border-[#DC2626] bg-[#DC2626]/5"></div>
              <span>1-mile radius</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full border border-[#DC2626] bg-[#DC2626]/2"></div>
              <span>2-mile radius</span>
            </div>
          </>
        )}
        {noise && (noise.level === "high" || noise.level === "medium") && (
          <>
            {noise.motorway_distance_m !== undefined && noise.motorway_distance_m < 2000 && (
              <div className="flex items-center gap-2">
                <div className="flex h-3 w-3 items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
                    <path
                      d="M4 12L2 13L4 14L6 13L4 12ZM10 12L8 13L10 14L12 13L10 12ZM16 12L14 13L16 14L18 13L16 12ZM22 12L20 13L22 14L24 13L22 12Z"
                      fill="#F59E0B"
                      stroke="#FFFFFF"
                      strokeWidth="0.5"
                    />
                  </svg>
                </div>
                <span>🛣️ Nearby highway</span>
              </div>
            )}
            {noise.airport_distance_m !== undefined && noise.airport_distance_m < 10000 && (
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#EF4444] border border-white"></div>
                <span>✈️ Nearby airport</span>
              </div>
            )}
          </>
        )}
        {locationInsights?.nearby_amenities && (
          <div className="ml-auto flex items-center gap-3 text-xs">
            {locationInsights.nearby_amenities.grocery_stores !== undefined && (
              <span>🛒 {locationInsights.nearby_amenities.grocery_stores} grocery stores</span>
            )}
            {locationInsights.nearby_amenities.restaurants !== undefined && (
              <span>🍽️ {locationInsights.nearby_amenities.restaurants} restaurants</span>
            )}
            {locationInsights.nearby_amenities.parks !== undefined && (
              <span>🌳 {locationInsights.nearby_amenities.parks} parks</span>
            )}
            {locationInsights.nearby_amenities.schools !== undefined && (
              <span>🏫 {locationInsights.nearby_amenities.schools} schools</span>
            )}
            {locationInsights.nearby_amenities.transit_stations !== undefined && (
              <span>🚇 {locationInsights.nearby_amenities.transit_stations} transit</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

