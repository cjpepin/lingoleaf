/**
 * Portfolio web demo chrome — centers the app in a modern iPhone-style frame.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { isEmbedMode, isWebDemo } from '@/demo/config';
import { colors, spacing, typography } from '@/theme';

const BASE_WIDTH = 393;
const BASE_HEIGHT = 852;
const BEZEL = 14;
const OUTER_RADIUS = 56;
const SCREEN_RADIUS = 44;

interface Props {
  children: React.ReactNode;
}

function nativeFrameMetrics() {
  return {
    frameWidth: BASE_WIDTH,
    frameHeight: BASE_HEIGHT,
    screenWidth: BASE_WIDTH - BEZEL * 2,
    screenHeight: BASE_HEIGHT - BEZEL * 2,
    islandWidth: 126,
    islandHeight: 37,
    islandTop: 12,
    homeWidth: 134,
    homeHeight: 5,
  };
}

function useFrameSize(embed: boolean) {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    if (embed) {
      return nativeFrameMetrics();
    }

    const maxWidth = Math.min(BASE_WIDTH, width - spacing.xl * 2);
    const maxHeight = height - 180;
    let frameWidth = maxWidth;
    let frameHeight = frameWidth * (BASE_HEIGHT / BASE_WIDTH);

    if (frameHeight > maxHeight) {
      frameHeight = maxHeight;
      frameWidth = frameHeight * (BASE_WIDTH / BASE_HEIGHT);
    }

    const scale = frameWidth / BASE_WIDTH;
    return {
      frameWidth,
      frameHeight,
      screenWidth: frameWidth - BEZEL * 2,
      screenHeight: frameHeight - BEZEL * 2,
      islandWidth: 126 * scale,
      islandHeight: 37 * scale,
      islandTop: 12 * scale,
      homeWidth: 134 * scale,
      homeHeight: 5 * scale,
    };
  }, [embed, height, width]);
}

function DeviceFrame({ frame, children }: { frame: ReturnType<typeof nativeFrameMetrics>; children: React.ReactNode }) {
  return (
    <View
      style={[
        styles.device,
        {
          width: frame.frameWidth,
          height: frame.frameHeight,
          borderRadius: OUTER_RADIUS,
        },
      ]}
    >
      <View style={styles.sideButtonLeft} />
      <View style={styles.sideButtonRightTop} />
      <View style={styles.sideButtonRightBottom} />

      <View
        style={[
          styles.screenShell,
          {
            width: frame.screenWidth,
            height: frame.screenHeight,
            borderRadius: SCREEN_RADIUS,
          },
        ]}
      >
        <View style={[styles.islandRow, { top: frame.islandTop }]}>
          <View
            style={[
              styles.dynamicIsland,
              {
                width: frame.islandWidth,
                height: frame.islandHeight,
                borderRadius: frame.islandHeight / 2,
              },
            ]}
          />
        </View>
        <View style={styles.appViewport}>{children}</View>
        <View style={styles.homeRow}>
          <View
            style={[
              styles.homeIndicator,
              {
                width: frame.homeWidth,
                height: frame.homeHeight,
                borderRadius: frame.homeHeight / 2,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

export function WebDemoDeviceFrame({ children }: Props) {
  const embed = isEmbedMode();
  const frame = useFrameSize(embed);

  if (!isWebDemo()) {
    return <>{children}</>;
  }

  if (embed) {
    return <View style={styles.embedBare}>{children}</View>;
  }

  return (
    <View style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>LingoLeaf</Text>
        <Text style={styles.subtitle}>Language learning through reading — live demo</Text>
      </View>

      <DeviceFrame frame={frame}>{children}</DeviceFrame>

      <Text style={styles.footer}>
        Shared demo backend · rate-limited · best experienced on desktop
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  embedPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: '#E7ECE8',
    backgroundImage: 'linear-gradient(180deg, #EEF3EF 0%, #D8E4DC 100%)',
  } as Record<string, unknown>,
  embedBare: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  page: {
    flex: 1,
    minHeight: '100vh' as unknown as number,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: '#E7ECE8',
    backgroundImage: 'linear-gradient(180deg, #EEF3EF 0%, #D8E4DC 100%)',
  } as Record<string, unknown>,
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    maxWidth: 520,
  },
  title: {
    ...typography.h1,
    color: colors.primaryDark,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  device: {
    backgroundColor: '#151516',
    padding: BEZEL,
    position: 'relative',
    boxShadow: '0 28px 80px rgba(0, 0, 0, 0.28), 0 8px 24px rgba(0, 0, 0, 0.18)',
  } as Record<string, unknown>,
  sideButtonLeft: {
    position: 'absolute',
    left: -3,
    top: '22%',
    width: 3,
    height: 54,
    borderRadius: 2,
    backgroundColor: '#2A2A2C',
  },
  sideButtonRightTop: {
    position: 'absolute',
    right: -3,
    top: '18%',
    width: 3,
    height: 34,
    borderRadius: 2,
    backgroundColor: '#2A2A2C',
  },
  sideButtonRightBottom: {
    position: 'absolute',
    right: -3,
    top: '28%',
    width: 3,
    height: 56,
    borderRadius: 2,
    backgroundColor: '#2A2A2C',
  },
  screenShell: {
    backgroundColor: colors.background,
    overflow: 'hidden',
    position: 'relative',
  },
  islandRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  dynamicIsland: {
    backgroundColor: '#000000',
  },
  appViewport: {
    flex: 1,
    overflow: 'hidden',
    paddingTop: 52,
    paddingBottom: 18,
  },
  homeRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 8,
    alignItems: 'center',
  },
  homeIndicator: {
    backgroundColor: '#111111',
    opacity: 0.28,
  },
  footer: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    maxWidth: 420,
  },
});
