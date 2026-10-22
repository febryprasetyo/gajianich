/**
 * Geofencing & Free Map Utilities for Mobile Attendance
 * Uses standard Haversine formula and OpenStreetMap / Google Maps direct URLs
 */

export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    lat1 === null || lat1 === undefined || isNaN(lat1) ||
    lon1 === null || lon1 === undefined || isNaN(lon1) ||
    lat2 === null || lat2 === undefined || isNaN(lat2) ||
    lon2 === null || lon2 === undefined || isNaN(lon2)
  ) {
    return Infinity;
  }

  const R = 6371000; // Radius of Earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function isWithinGeofence(
  employeeLat: number | null | undefined,
  employeeLon: number | null | undefined,
  officeLat: number,
  officeLon: number,
  radiusMeters = 100
): { isWithin: boolean; distanceMeters: number | null } {
  if (
    employeeLat === null || employeeLat === undefined || isNaN(employeeLat) ||
    employeeLon === null || employeeLon === undefined || isNaN(employeeLon)
  ) {
    return { isWithin: false, distanceMeters: null };
  }

  const distance = calculateHaversineDistance(employeeLat, employeeLon, officeLat, officeLon);
  if (!isFinite(distance)) {
    return { isWithin: false, distanceMeters: null };
  }

  return {
    isWithin: distance <= radiusMeters,
    distanceMeters: distance,
  };
}

export function buildMapLinks(latitude: number, longitude: number): {
  osmUrl: string;
  googleMapsUrl: string;
} {
  const osmUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
  const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
  return { osmUrl, googleMapsUrl };
}
