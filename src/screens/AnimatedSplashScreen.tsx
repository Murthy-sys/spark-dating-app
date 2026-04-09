/**
 * AnimatedSplashScreen.tsx  — UX-improved
 *
 * Design principles applied:
 *  • Uses the real logo PNG (brand-consistent, not CSS triangles / emoji)
 *  • All timing driven by Animated.sequence / callbacks — no setTimeout drift
 *  • Pulse-ring shockwaves (not emoji fists) feel premium and platform-safe
 *  • Total duration ≤ 3 s  (UX best practice — users hate long splashes)
 *  • Respects prefers-reduced-motion via AccessibilityInfo
 *  • Status bar restoration is guaranteed via cleanup
 *
 * Sequence  (total ≈ 2.9 s):
 *  0 ms   Dark bg + logo at scale 0, opacity 0
 *  300 ms Logo springs in (scale 0 → 1) with slight overshoot
 *  700 ms 3 staggered pulse rings expand outward + fade
 *  900 ms "SPARK" text rises up 24 px and fades in
 *  1150 ms Tagline fades in
 *  2400 ms Screen fades to black
 *  2900 ms onFinish()
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Animated,
  StyleSheet,
  Dimensions,
  StatusBar,
  Easing,
  AccessibilityInfo,
} from 'react-native';

const { width } = Dimensions.get('window');

const BG     = '#0A0818';
const PINK   = '#FF4B7E';
const HOT    = '#FF1464';

const LOGO = require('../../assets/logo/icon-transparent.png');

// Three pulse rings, each delayed 120 ms from the previous
const RINGS = [0, 120, 240];

interface Props {
  onFinish: () => void;
}

export default function AnimatedSplashScreen({ onFinish }: Props) {
  // Logo entrance
  const logoScale   = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  // Pulse rings
  const rings = useRef(
    RINGS.map(() => ({
      scale:   new Animated.Value(0.5),
      opacity: new Animated.Value(0),
    }))
  ).current;

  // Text
  const titleY       = useRef(new Animated.Value(24)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const tagOpacity   = useRef(new Animated.Value(0)).current;

  // Screen exit
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let reducedMotion = false;
    StatusBar.setHidden(true, 'fade');

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      reducedMotion = reduced;
      runSequence(reduced);
    });

    return () => {
      // Guarantee status bar is restored even if component unmounts early
      StatusBar.setHidden(false, 'fade');
    };
  }, []);

  function runSequence(fast: boolean) {
    if (fast) {
      // Skip animation for users with reduced-motion enabled
      logoOpacity.setValue(1);
      logoScale.setValue(1);
      titleOpacity.setValue(1);
      titleY.setValue(0);
      tagOpacity.setValue(1);
      setTimeout(() => {
        StatusBar.setHidden(false, 'fade');
        onFinish();
      }, 800);
      return;
    }

    Animated.sequence([
      // ── Phase 1: Logo springs in ──────────────────────────────────────────
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue:  1,
          friction: 7,      // slight overshoot for energy
          tension:  100,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue:  1,
          duration: 250,
          easing:   Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      // ── Phase 2: Pulse rings + text (parallel, start immediately) ─────────
      Animated.parallel([
        // Three staggered rings
        ...rings.map((ring, i) =>
          Animated.sequence([
            Animated.delay(i * 120),
            Animated.parallel([
              Animated.timing(ring.opacity, {
                toValue:  0.7,
                duration: 80,
                useNativeDriver: true,
              }),
              Animated.timing(ring.scale, {
                toValue:  2.6,
                duration: 700,
                easing:   Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.sequence([
                Animated.delay(200),
                Animated.timing(ring.opacity, {
                  toValue:  0,
                  duration: 500,
                  easing:   Easing.in(Easing.quad),
                  useNativeDriver: true,
                }),
              ]),
            ]),
          ])
        ),

        // "SPARK" title rises up
        Animated.sequence([
          Animated.delay(200),
          Animated.parallel([
            Animated.timing(titleY, {
              toValue:  0,
              duration: 500,
              easing:   Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(titleOpacity, {
              toValue:  1,
              duration: 500,
              easing:   Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),

        // Tagline fades in after title
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(tagOpacity, {
            toValue:  1,
            duration: 400,
            easing:   Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),

      // ── Phase 3: Dwell ────────────────────────────────────────────────────
      Animated.delay(900),

      // ── Phase 4: Screen fades to black ────────────────────────────────────
      Animated.timing(screenOpacity, {
        toValue:  0,
        duration: 500,
        easing:   Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      StatusBar.setHidden(false, 'fade');
      onFinish();
    });
  }

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      {/* Pulse rings — behind the logo */}
      {rings.map((ring, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.ring,
            {
              opacity:   ring.opacity,
              transform: [{ scale: ring.scale }],
            },
          ]}
        />
      ))}

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoWrapper,
          {
            opacity:   logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        <Image source={LOGO} style={styles.logo} />
      </Animated.View>

      {/* App name */}
      <Animated.Text
        style={[
          styles.appName,
          {
            opacity:   titleOpacity,
            transform: [{ translateY: titleY }],
          },
        ]}
      >
        SPARK
      </Animated.Text>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: tagOpacity }]}>
        Cross paths. Make a spark.
      </Animated.Text>
    </Animated.View>
  );
}

const LOGO_SIZE  = width * 0.52;
const RING_SIZE  = LOGO_SIZE * 0.82;   // ring starts slightly inside logo

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Pulse rings ─────────────────────────────────────────────────────────────
  ring: {
    position:     'absolute',
    width:        RING_SIZE,
    height:       RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth:  2,
    borderColor:  PINK,
  },

  // ── Logo ────────────────────────────────────────────────────────────────────
  logoWrapper: {
    marginBottom: 32,
    // Subtle drop shadow so logo "lifts" off the dark bg
    shadowColor:   HOT,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius:  40,
    elevation:     20,
  },
  logo: {
    width:      LOGO_SIZE,
    height:     LOGO_SIZE,
    resizeMode: 'contain',
  },

  // ── Text ────────────────────────────────────────────────────────────────────
  appName: {
    fontSize:      38,
    fontWeight:    '900',
    color:         '#FFFFFF',
    letterSpacing: 10,
    marginBottom:  10,
  },
  tagline: {
    fontSize:      13,
    fontWeight:    '400',
    color:         'rgba(255,255,255,0.40)',
    letterSpacing: 2,
  },
});
