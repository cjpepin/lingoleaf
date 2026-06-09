import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import type { GardenFreshness, GardenStage } from '@/garden/model';
import { colors, spacing } from '@/theme';

interface Props {
  stage: GardenStage;
  freshness: GardenFreshness;
  compact?: boolean;
}

interface Palette {
  skyTop: string;
  skyBottom: string;
  haze: string;
  groundBack: string;
  groundFront: string;
  soil: string;
  stem: string;
  trunk: string;
  branch: string;
  leaf: string;
  leafAccent: string;
  blossom: string;
  fruit: string;
  seed: string;
  cloud: string;
  sun: string;
}

interface StageSpec {
  trunkHeight: number;
  trunkWidth: number;
  branchCount: number;
  leafCount: number;
  blossomCount: number;
  fruitCount: number;
}

function getPalette(freshness: GardenFreshness): Palette {
  if (freshness === 'dead') {
    return {
      skyTop: '#E8E2D8',
      skyBottom: '#DDD5C8',
      haze: '#F0EBE2',
      groundBack: '#C4B8A4',
      groundFront: '#B0A28C',
      soil: '#6E5A44',
      stem: '#8A7E6A',
      trunk: '#6B5544',
      branch: '#7A6650',
      leaf: '#B5A888',
      leafAccent: '#C8BC9E',
      blossom: '#C4B8A4',
      fruit: '#A89878',
      seed: '#6E5A44',
      cloud: '#F0EBE2',
      sun: '#D4C8A8',
    };
  }

  if (freshness === 'resting') {
    return {
      skyTop: '#EEF6EA',
      skyBottom: '#E2F0DF',
      haze: '#F5FAF3',
      groundBack: '#CDE2C5',
      groundFront: '#B9D6B0',
      soil: '#7C624A',
      stem: '#4E8E65',
      trunk: '#775D45',
      branch: '#846B53',
      leaf: '#6FAE86',
      leafAccent: '#94C6A3',
      blossom: '#F2D8DF',
      fruit: '#E5B35F',
      seed: '#6E5640',
      cloud: '#FAFFFA',
      sun: '#F2E6B5',
    };
  }

  return {
    skyTop: '#E8F6EE',
    skyBottom: '#D9F0E0',
    haze: '#F7FDF9',
    groundBack: '#C1DFC1',
    groundFront: '#A8D0AA',
    soil: '#72573F',
    stem: '#3E8F67',
    trunk: '#6C5038',
    branch: '#795D45',
    leaf: '#4BA975',
    leafAccent: '#78C496',
    blossom: '#FFDCE8',
    fruit: '#F2C35E',
    seed: '#5C4533',
    cloud: '#FCFFFD',
    sun: '#F8E6A6',
  };
}

function getStageSpec(stage: GardenStage, compact: boolean): StageSpec {
  const scale = compact ? 0.8 : 1;
  const trunkHeights: Record<GardenStage, number> = {
    seed: 0,
    sprout: 24,
    sapling: 38,
    young_tree: 50,
    mature_tree: 62,
    blooming_tree: 74,
    ancient_tree: 88,
  };
  const trunkWidths: Record<GardenStage, number> = {
    seed: 0,
    sprout: 3,
    sapling: 5,
    young_tree: 8,
    mature_tree: 10,
    blooming_tree: 12,
    ancient_tree: 14,
  };
  const branchCounts: Record<GardenStage, number> = {
    seed: 0,
    sprout: 0,
    sapling: 2,
    young_tree: 4,
    mature_tree: 6,
    blooming_tree: 8,
    ancient_tree: 10,
  };
  const leafCounts: Record<GardenStage, number> = {
    seed: 0,
    sprout: 5,
    sapling: 11,
    young_tree: 19,
    mature_tree: 27,
    blooming_tree: 35,
    ancient_tree: 43,
  };

  return {
    trunkHeight: Math.round(trunkHeights[stage] * scale),
    trunkWidth: Math.max(1, Math.round(trunkWidths[stage] * scale)),
    branchCount: branchCounts[stage],
    leafCount: leafCounts[stage],
    blossomCount:
      stage === 'young_tree'
        ? 2
        : stage === 'mature_tree'
          ? 5
          : stage === 'blooming_tree'
            ? 10
            : stage === 'ancient_tree'
              ? 12
              : 0,
    fruitCount: stage === 'mature_tree' ? 4 : stage === 'blooming_tree' ? 7 : stage === 'ancient_tree' ? 10 : 0,
  };
}

function Cloud({ left, top, scale, color }: { left: number; top: number; scale: number; color: string }) {
  return (
    <View style={{ position: 'absolute', left, top, transform: [{ scale }] }}>
      <View style={{ width: 26, height: 14, borderRadius: 14, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 8, top: -6, width: 16, height: 16, borderRadius: 16, backgroundColor: color }} />
      <View style={{ position: 'absolute', left: 18, top: -2, width: 12, height: 12, borderRadius: 12, backgroundColor: color }} />
    </View>
  );
}

function StageLayer({
  stage,
  freshness,
  compact,
  exposeTestIds,
}: {
  stage: GardenStage;
  freshness: GardenFreshness;
  compact: boolean;
  exposeTestIds: boolean;
}) {
  const palette = useMemo(() => getPalette(freshness), [freshness]);
  const spec = useMemo(() => getStageSpec(stage, compact), [stage, compact]);
  const height = compact ? 84 : stage === 'ancient_tree' ? 138 : stage === 'blooming_tree' ? 128 : 116;
  const baseBottom = compact ? 12 : 16;

  // Order points from center-out so early stages stay centered and vertically balanced on trunk top.
  const canopyPoints = [
    { x: 0, y: 0 },
    { x: -9, y: 4 },
    { x: 9, y: 4 },
    { x: -18, y: 8 },
    { x: 18, y: 8 },
    { x: 0, y: 10 },
    { x: -27, y: 12 },
    { x: 27, y: 12 },
    { x: -12, y: 16 },
    { x: 12, y: 16 },
    { x: -35, y: 20 },
    { x: 35, y: 20 },
    { x: -20, y: 24 },
    { x: 20, y: 24 },
    { x: 0, y: 26 },
    { x: -30, y: 30 },
    { x: 30, y: 30 },
    { x: -10, y: 32 },
    { x: 10, y: 32 },
    { x: -38, y: 28 },
    { x: 38, y: 28 },
    { x: -24, y: 36 },
    { x: 24, y: 36 },
    { x: 0, y: 38 },
    { x: -16, y: 40 },
    { x: 16, y: 40 },
    { x: 0, y: 42 },
  ];

  const branchOffsets = [-1, 1, -1, 1, -1, 1];

  return (
    <View style={[styles.scene, { height }]}> 
      <View style={[styles.skyTop, { backgroundColor: palette.skyTop }]} />
      <View style={[styles.skyBottom, { backgroundColor: palette.skyBottom }]} />
      <View style={[styles.haze, { backgroundColor: palette.haze }]} />

      <View style={[styles.sun, { backgroundColor: palette.sun, opacity: freshness === 'dead' ? 0.3 : 0.9 }]} />
      <Cloud left={14} top={compact ? 14 : 18} scale={compact ? 0.85 : 1} color={palette.cloud} />
      <Cloud left={compact ? 92 : 132} top={compact ? 10 : 14} scale={compact ? 0.75 : 0.92} color={palette.cloud} />

      <View style={[styles.hillBack, { backgroundColor: palette.groundBack }]} />
      <View style={[styles.hillFront, { backgroundColor: palette.groundFront }]} />

      <View
        style={[
          styles.plantGroup,
          {
            bottom: baseBottom,
            transform: [{ scale: compact ? 0.85 : 1 }],
          },
        ]}
      >
        <View style={[styles.soil, { backgroundColor: palette.soil }]} />

        {stage === 'seed' ? (
          <View
            testID={exposeTestIds ? 'garden-seed' : undefined}
            style={[styles.seed, { backgroundColor: palette.seed }]}
          />
        ) : null}

        {spec.trunkHeight > 0 ? (
          <View
            testID={exposeTestIds ? 'garden-trunk' : undefined}
            style={{
              position: 'absolute',
              bottom: 7,
              left: -spec.trunkWidth / 2,
              width: spec.trunkWidth,
              height: spec.trunkHeight,
              borderRadius: spec.trunkWidth,
              backgroundColor: stage === 'sprout' || stage === 'sapling' ? palette.stem : palette.trunk,
            }}
          />
        ) : null}

        {Array.from({ length: spec.branchCount }).map((_, index) => {
          const offset = branchOffsets[index] ?? 1;
          const topRatio = 0.42 + index * 0.1;
          return (
            <View
              key={`branch-${index}`}
              style={{
                position: 'absolute',
                left: offset > 0 ? 1 : -10,
                bottom: Math.max(12, Math.round(spec.trunkHeight * topRatio)),
                width: compact ? 12 : 16,
                height: compact ? 3 : 4,
                borderRadius: 6,
                backgroundColor: palette.branch,
                transform: [{ rotate: `${offset > 0 ? -22 : 22}deg` }],
              }}
            />
          );
        })}

        {canopyPoints.slice(0, spec.leafCount).map((point, index) => {
          const leafSize =
            stage === 'sprout'
              ? 10
              : stage === 'sapling'
                ? 12
                : stage === 'young_tree'
                  ? 14
                  : stage === 'mature_tree'
                    ? 16
                    : stage === 'blooming_tree'
                      ? 17
                      : 18;
          const leafColor = index % 2 === 0 ? palette.leaf : palette.leafAccent;
          const canopyBaseY = Math.max(10, spec.trunkHeight - 2);
          const canopyScaleY =
            stage === 'ancient_tree'
              ? 0.7
              : stage === 'blooming_tree'
                ? 0.74
                : stage === 'mature_tree'
              ? 0.8
              : stage === 'young_tree'
                ? 0.88
                : stage === 'sapling'
                  ? 0.95
                  : 1;
          const y = canopyBaseY + point.y * canopyScaleY;
          return (
            <View
              key={`leaf-${index}`}
              testID={exposeTestIds ? 'garden-canopy-leaf' : undefined}
              style={{
                position: 'absolute',
                left: point.x - leafSize / 2,
                bottom: y,
                width: leafSize,
                height: leafSize,
                borderRadius: leafSize,
                backgroundColor: leafColor,
              }}
            />
          );
        })}

        {Array.from({ length: spec.blossomCount }).map((_, index) => {
          const anchor = canopyPoints[(index * 3 + 2) % canopyPoints.length];
          return (
            <View
              key={`blossom-${index}`}
              style={{
                position: 'absolute',
                left: anchor.x - 3,
                bottom: spec.trunkHeight * 0.4 + anchor.y + 2,
                width: 6,
                height: 6,
                borderRadius: 6,
                backgroundColor: palette.blossom,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(0,0,0,0.12)',
              }}
            />
          );
        })}

        {Array.from({ length: spec.fruitCount }).map((_, index) => {
          const anchor = canopyPoints[(index * 4 + 1) % canopyPoints.length];
          return (
            <View
              key={`fruit-${index}`}
              testID={exposeTestIds && index === 0 ? 'garden-fruit' : undefined}
              style={{
                position: 'absolute',
                left: anchor.x - 3,
                bottom: spec.trunkHeight * 0.45 + anchor.y - 3,
                width: 7,
                height: 7,
                borderRadius: 7,
                backgroundColor: palette.fruit,
              }}
            />
          );
        })}
      </View>

      <View style={[styles.frame, { borderColor: colors.border }]} pointerEvents="none" />
    </View>
  );
}

export function GardenStageVisual({ stage, freshness, compact = false }: Props) {
  const [currentStage, setCurrentStage] = useState<GardenStage>(stage);
  const [previousStage, setPreviousStage] = useState<GardenStage | null>(null);

  const incomingOpacity = useRef(new Animated.Value(1)).current;
  const incomingScale = useRef(new Animated.Value(1)).current;
  const incomingLift = useRef(new Animated.Value(0)).current;
  const outgoingOpacity = useRef(new Animated.Value(0)).current;
  const outgoingScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (stage === currentStage) return;

    setPreviousStage(currentStage);
    setCurrentStage(stage);

    incomingOpacity.setValue(0);
    incomingScale.setValue(0.96);
    incomingLift.setValue(8);
    outgoingOpacity.setValue(1);
    outgoingScale.setValue(1);

    Animated.parallel([
      Animated.timing(incomingOpacity, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(incomingScale, {
        toValue: 1,
        damping: 12,
        mass: 0.75,
        stiffness: 145,
        useNativeDriver: true,
      }),
      Animated.timing(incomingLift, {
        toValue: 0,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(outgoingOpacity, {
        toValue: 0,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(outgoingScale, {
        toValue: 1.03,
        duration: 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setPreviousStage(null);
      }
    });
  }, [currentStage, incomingLift, incomingOpacity, incomingScale, outgoingOpacity, outgoingScale, stage]);

  return (
    <View testID={`garden-visual-${stage}`} style={styles.root}>
      {previousStage ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: outgoingOpacity,
              transform: [{ scale: outgoingScale }],
            },
          ]}
        >
          <StageLayer stage={previousStage} freshness={freshness} compact={compact} exposeTestIds={false} />
        </Animated.View>
      ) : null}

      <Animated.View
        style={{
          opacity: incomingOpacity,
          transform: [{ scale: incomingScale }, { translateY: incomingLift }],
        }}
      >
        <StageLayer stage={currentStage} freshness={freshness} compact={compact} exposeTestIds />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    borderRadius: 14,
    overflow: 'hidden',
  },
  scene: {
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  skyTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '55%',
  },
  skyBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  haze: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 14,
    height: 26,
    borderRadius: 999,
    opacity: 0.55,
  },
  sun: {
    position: 'absolute',
    right: 20,
    top: 10,
    width: 20,
    height: 20,
    borderRadius: 20,
  },
  hillBack: {
    position: 'absolute',
    left: -20,
    right: 40,
    bottom: 10,
    height: 34,
    borderTopLeftRadius: 70,
    borderTopRightRadius: 90,
  },
  hillFront: {
    position: 'absolute',
    left: 30,
    right: -20,
    bottom: 0,
    height: 30,
    borderTopLeftRadius: 60,
    borderTopRightRadius: 70,
  },
  plantGroup: {
    position: 'absolute',
    left: '50%',
    width: 0,
    height: 0,
  },
  soil: {
    position: 'absolute',
    left: -22,
    bottom: -2,
    width: 44,
    height: 13,
    borderRadius: 999,
    opacity: 0.94,
  },
  seed: {
    position: 'absolute',
    left: -5,
    bottom: 8,
    width: 10,
    height: 7,
    borderRadius: 8,
    transform: [{ rotate: '-16deg' }],
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderRadius: 14,
    opacity: 0.5,
  },
});
