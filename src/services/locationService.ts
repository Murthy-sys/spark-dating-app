/**
 * locationService.ts
 *
 * Handles foreground + background location tracking and reports
 * each position update to the Node.js backend, which runs
 * MongoDB $geoNear queries server-side to detect crossings.
 */

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from './apiClient';
import { GeoPoint } from '../types';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

const LOCATION_UPDATE_INTERVAL = 30_000;  // ms
const LOCATION_UPDATE_DISTANCE = 50;       // meters

// ─── Background Task ──────────────────────────────────────────────────────────

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
  if (error) { console.error('[LocationTask]', error.message); return; }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const latest = locations[locations.length - 1];
    const { latitude, longitude } = latest.coords;

    const token = await AsyncStorage.getItem('authToken');
    if (!token) return;

    try {
      // POST to backend → updates MongoDB location + runs $geoNear crossing detection
      await apiClient.post('/crossings/location', { latitude, longitude });
    } catch (err) {
      console.error('[LocationTask] Failed to report location:', err);
    }
  }
});

// ─── Permission Request ───────────────────────────────────────────────────────

export async function requestLocationPermissions(): Promise<boolean> {
  const { status: fg } = await Location.requestForegroundPermissionsAsync();
  if (fg !== 'granted') return false;
  const { status: bg } = await Location.requestBackgroundPermissionsAsync();
  return bg === 'granted';
}

// ─── Start / Stop Tracking ────────────────────────────────────────────────────

export async function startLocationTracking(): Promise<void> {
  const hasPerms = await requestLocationPermissions();
  if (!hasPerms) return;

  const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (!isRunning) {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy:         Location.Accuracy.Balanced,
      timeInterval:     LOCATION_UPDATE_INTERVAL,
      distanceInterval: LOCATION_UPDATE_DISTANCE,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Spark is active',
        notificationBody:  'Finding people near you',
        notificationColor: '#FF4B6E',
      },
    });
  }
}

export async function stopLocationTracking(): Promise<void> {
  const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (isRunning) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}

// ─── Foreground Location Report ───────────────────────────────────────────────

export async function reportLocation(location: GeoPoint): Promise<void> {
  await apiClient.post('/crossings/location', {
    latitude:  location.latitude,
    longitude: location.longitude,
  });
}
