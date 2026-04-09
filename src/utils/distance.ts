import { GeoPoint } from '../types';

/** Haversine formula — returns distance in meters between two geo points */
export function getDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude  - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const haversine =
    sinDLat * sinDLat +
    Math.cos(toRad(a.latitude)) *
    Math.cos(toRad(b.latitude)) *
    sinDLon * sinDLon;

  return R * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

/** Returns human-readable distance string */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m away`;
  return `${(meters / 1000).toFixed(1)} km away`;
}

/** Returns distance in km between two geo points */
export function getDistanceKm(a: GeoPoint, b: GeoPoint): number {
  return getDistanceMeters(a, b) / 1000;
}
