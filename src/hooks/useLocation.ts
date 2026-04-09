import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { GeoPoint } from '../types';
import {
  startLocationTracking,
  stopLocationTracking,
  reportLocation,
} from '../services/locationService';
import { useAuthStore } from '../store/authStore';

export function useLocation() {
  const token = useAuthStore((s) => s.token);
  const [currentLocation, setCurrentLocation] = useState<GeoPoint | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied');
          return;
        }
        setPermissionGranted(true);

        // Get initial position and report to backend
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const geo: GeoPoint = {
          latitude:  initial.coords.latitude,
          longitude: initial.coords.longitude,
        };
        setCurrentLocation(geo);
        await reportLocation(geo);

        // Watch foreground position
        subscription = await Location.watchPositionAsync(
          {
            accuracy:         Location.Accuracy.Balanced,
            timeInterval:     30_000,
            distanceInterval: 50,
          },
          async (loc) => {
            const updated: GeoPoint = {
              latitude:  loc.coords.latitude,
              longitude: loc.coords.longitude,
            };
            setCurrentLocation(updated);
            await reportLocation(updated);
          }
        );

        // Start background task
        await startLocationTracking();
      } catch (err: any) {
        setError(err.message);
      }
    })();

    return () => {
      subscription?.remove();
      stopLocationTracking();
    };
  }, [token]);

  return { currentLocation, permissionGranted, error };
}
