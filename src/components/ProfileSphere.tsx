/**
 * ProfileSphere — pseudo-3D rotatable sphere of profile avatars.
 *
 * Profiles are distributed on a unit sphere via a Fibonacci spiral (even
 * coverage, no clustering). The user drags to rotate the sphere; we rotate
 * each point in 3D, project to 2D, and scale/dim by depth so back-facing
 * profiles look further away. No three.js — pure RN transforms.
 *
 * Why PanResponder over PanGestureHandler:
 *   - Built-in, no GestureHandlerRootView wiring needed
 *   - "shouldSetPanResponder = movement-based" lets taps fall through to
 *     the inner TouchableOpacity, so a tap opens the profile while a drag
 *     rotates the sphere
 *
 * Inertia + idle auto-spin are handled by a single rAF loop.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import UserAvatar from './UserAvatar';
import { UserProfile } from '../types';

type Vec3 = { x: number; y: number; z: number };

export interface SphereItem {
  user: UserProfile;
  crossingCount: number;
  crossedAt: string;
}

interface Props {
  items: SphereItem[];
  onItemTap: (item: SphereItem) => void;
  /** Called whenever the front-most item changes (so HomeScreen can target action buttons at it). */
  onFrontItemChange?: (item: SphereItem | null) => void;
  /** Outer container size — sphere is centered inside this square. */
  size?: number;
}

const { width: SCREEN_W } = Dimensions.get('window');
const DEFAULT_SIZE = Math.min(SCREEN_W, 420);
const NODE_SIZE = 64;            // diameter of avatar bubble at z=0
const DRAG_SENSITIVITY = 0.005;  // radians per pixel
const FRICTION = 0.94;           // velocity decay per frame
const IDLE_SPIN = 0.0015;        // radians/frame yaw drift while user idle
const TAP_SLOP = 6;              // pixels — drags larger than this don't register as taps

/** Fibonacci sphere — evenly distributed points on unit sphere. */
function fibonacciPoints(n: number): Vec3[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0, y: 0, z: 1 }];
  const pts: Vec3[] = [];
  const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    pts.push({ x: Math.cos(theta) * r, y, z: Math.sin(theta) * r });
  }
  return pts;
}

/** Rotate point by yaw (Y-axis) then pitch (X-axis). */
function rotate(p: Vec3, yaw: number, pitch: number): Vec3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = p.x * cy + p.z * sy;
  const z1 = -p.x * sy + p.z * cy;
  const y1 = p.y;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y2 = y1 * cp - z1 * sp;
  const z2 = y1 * sp + z1 * cp;
  return { x: x1, y: y2, z: z2 };
}

export default function ProfileSphere({
  items,
  onItemTap,
  onFrontItemChange,
  size = DEFAULT_SIZE,
}: Props) {
  const radius = size / 2 - NODE_SIZE / 2;
  const basePoints = useMemo(() => fibonacciPoints(items.length), [items.length]);

  // Rotation state — kept in refs for the rAF loop, mirrored to React state for render.
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const velYawRef = useRef(0);
  const velPitchRef = useRef(0);
  const draggingRef = useRef(false);
  const [, setTick] = useState(0);

  // Ref tracking the front item so we don't fire onFrontItemChange every frame.
  const lastFrontIdRef = useRef<string | null>(null);

  useEffect(() => {
    let raf: number;
    const tickFn = () => {
      // Apply velocity / inertia. While idle (no drag, ~zero velocity), gentle auto-spin.
      if (!draggingRef.current) {
        if (Math.abs(velYawRef.current) < 0.0005 && Math.abs(velPitchRef.current) < 0.0005) {
          yawRef.current += IDLE_SPIN;
        } else {
          yawRef.current += velYawRef.current;
          pitchRef.current += velPitchRef.current;
          velYawRef.current *= FRICTION;
          velPitchRef.current *= FRICTION;
        }
        // Clamp pitch so the sphere can't flip upside down (feels disorienting).
        const max = Math.PI / 2 - 0.05;
        if (pitchRef.current > max) pitchRef.current = max;
        if (pitchRef.current < -max) pitchRef.current = -max;
      }
      setTick((t) => (t + 1) % 1_000_000);
      raf = requestAnimationFrame(tickFn);
    };
    raf = requestAnimationFrame(tickFn);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Reset rotation if the item count changes underneath us (avoids a transient mismatch).
  useEffect(() => {
    velYawRef.current = 0;
    velPitchRef.current = 0;
  }, [items.length]);

  // Per-pan-session scratch — tracks cumulative dx/dy from the *previous* move event
  // so each frame's delta = current cumulative - previous cumulative.
  const panState = useRef({ lastYaw: 0, lastPitch: 0 });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Only claim the gesture once the user actually drags — taps pass through
        // to TouchableOpacity below.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > TAP_SLOP || Math.abs(g.dy) > TAP_SLOP,
        onPanResponderGrant: () => {
          draggingRef.current = true;
          velYawRef.current = 0;
          velPitchRef.current = 0;
          panState.current.lastYaw = 0;
          panState.current.lastPitch = 0;
        },
        onPanResponderMove: (_e, g) => {
          // PanResponder gives cumulative dx/dy since gesture start — derive per-frame
          // delta by subtracting the previous cumulative value.
          const newYaw = g.dx * DRAG_SENSITIVITY;
          const newPitch = -g.dy * DRAG_SENSITIVITY;
          const dYaw = newYaw - panState.current.lastYaw;
          const dPitch = newPitch - panState.current.lastPitch;
          velYawRef.current = dYaw;
          velPitchRef.current = dPitch;
          yawRef.current += dYaw;
          pitchRef.current += dPitch;
          panState.current.lastYaw = newYaw;
          panState.current.lastPitch = newPitch;
        },
        onPanResponderRelease: () => {
          draggingRef.current = false;
        },
        onPanResponderTerminate: () => {
          draggingRef.current = false;
        },
      }),
    [],
  );

  // Compute current projected positions. Sort back-to-front so front nodes render on top.
  const yaw = yawRef.current;
  const pitch = pitchRef.current;
  const projected = items.map((item, i) => {
    const p = rotate(basePoints[i] ?? { x: 0, y: 0, z: 1 }, yaw, pitch);
    return { item, p, i };
  });
  projected.sort((a, b) => a.p.z - b.p.z); // small z = far → drawn first

  // Front-most = largest z. Notify parent if it changed.
  const front = projected[projected.length - 1] ?? null;
  const frontId = front?.item.user._id ?? null;
  useEffect(() => {
    if (frontId !== lastFrontIdRef.current) {
      lastFrontIdRef.current = frontId;
      onFrontItemChange?.(front?.item ?? null);
    }
  }, [frontId, front, onFrontItemChange]);

  const handleTap = useCallback(
    (item: SphereItem) => {
      // Hand off to parent; the parent decides what to do (open detail, etc.)
      onItemTap(item);
    },
    [onItemTap],
  );

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      {...panResponder.panHandlers}
    >
      {projected.map(({ item, p }) => {
        // Project: x,y onto screen; scale by depth so closer = bigger.
        // z ranges [-1, 1]. Map to scale [0.45, 1.05] and opacity [0.25, 1].
        const depth = (p.z + 1) / 2; // 0..1
        const isFocused = item.user._id === frontId;
        // Focused profile gets an extra scale punch + always-full opacity so it
        // visually pops above the depth-based smoothing.
        const baseScale = 0.45 + depth * 0.6;
        const scale = isFocused ? baseScale * 1.35 : baseScale;
        const opacity = isFocused ? 1 : 0.25 + depth * 0.75;
        const left = size / 2 + p.x * radius - NODE_SIZE / 2;
        const top = size / 2 + p.y * radius - NODE_SIZE / 2;

        return (
          <TouchableOpacity
            key={item.user._id}
            activeOpacity={0.8}
            onPress={() => handleTap(item)}
            style={[
              styles.node,
              isFocused && styles.nodeFocused,
              {
                left,
                top,
                width: NODE_SIZE,
                height: NODE_SIZE,
                opacity,
                transform: [{ scale }],
                // Bring closer nodes above further ones — focused gets an extra bump
                // so its glow ring isn't clipped by neighbors.
                zIndex: Math.round(depth * 1000) + (isFocused ? 2000 : 0),
              },
            ]}
          >
            <UserAvatar
              user={item.user}
              style={styles.avatar}
              avatarSize={200}
            />
            {/* Ring: focused overrides gender ring with a thicker pink one. */}
            {isFocused ? (
              <View style={styles.ringFocused} pointerEvents="none" />
            ) : item.user.gender === 'female' ? (
              <View style={styles.ringFemale} pointerEvents="none" />
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    position: 'relative',
  },
  node: {
    position: 'absolute',
    borderRadius: NODE_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  avatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  ringFemale: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(255,75,110,0.55)',
  },
  // Focused (front-most) profile — solid bright ring + pink glow shadow.
  nodeFocused: {
    backgroundColor: '#fff',
    shadowColor: '#FF4B6E',
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  ringFocused: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: NODE_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FF4B6E',
  },
});
