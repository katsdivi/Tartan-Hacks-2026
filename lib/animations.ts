import { useEffect, useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';

// ============================================
// TIMING CONFIGURATIONS
// ============================================

export const TIMING_CONFIGS = {
  // Standard ease-in-out for most animations
  standard: {
    duration: 300,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },
  // Faster for micro-interactions
  fast: {
    duration: 150,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },
  // Slower for emphasis
  slow: {
    duration: 500,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },
  // Count-up numbers
  countUp: {
    duration: 800,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  },
  // Graph draw animation
  graphDraw: {
    duration: 1000,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  },
};

export const SPRING_CONFIGS = {
  // Gentle spring for slides
  gentle: {
    damping: 20,
    stiffness: 200,
    mass: 1,
  },
  // Snappy for buttons/micro-interactions
  snappy: {
    damping: 15,
    stiffness: 400,
    mass: 0.8,
  },
  // Bouncy for emphasis
  bouncy: {
    damping: 12,
    stiffness: 180,
    mass: 1,
  },
};

// ============================================
// COUNT-UP ANIMATION HOOK
// ============================================

/**
 * Animated count-up hook for numbers
 * @param targetValue - The final value to count to
 * @param duration - Animation duration in ms (default 800)
 * @param trigger - Dependency to re-trigger animation (e.g., tab focus)
 */
export function useCountUp(
  targetValue: number,
  duration: number = 800,
  trigger?: any
): number {
  const animatedValue = useSharedValue(0);
  const displayValue = useSharedValue(0);

  useEffect(() => {
    // Reset and animate
    animatedValue.value = 0;
    animatedValue.value = withTiming(targetValue, {
      duration,
      easing: TIMING_CONFIGS.countUp.easing,
    });
  }, [targetValue, trigger]);

  // For JS thread access, we'll use a workaround
  // In practice, use useAnimatedReaction or useDerivedValue
  return targetValue; // Placeholder - actual implementation uses Animated Text
}

// ============================================
// FADE SLIDE ANIMATION HOOK
// ============================================

/**
 * Creates fade + slide animation for entry effects
 * @param delay - Delay before animation starts
 * @param direction - 'up' | 'down' | 'left' | 'right'
 */
export function useFadeSlide(
  delay: number = 0,
  direction: 'up' | 'down' | 'left' | 'right' = 'up'
) {
  const progress = useSharedValue(0);

  const animate = useCallback(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withSpring(1, SPRING_CONFIGS.gentle)
    );
  }, [delay]);

  const reset = useCallback(() => {
    progress.value = 0;
  }, []);

  const getTranslation = (dir: string) => {
    switch (dir) {
      case 'up': return { x: 0, y: 20 };
      case 'down': return { x: 0, y: -20 };
      case 'left': return { x: 20, y: 0 };
      case 'right': return { x: -20, y: 0 };
      default: return { x: 0, y: 20 };
    }
  };

  const translation = getTranslation(direction);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [translation.x, 0]) },
      { translateY: interpolate(progress.value, [0, 1], [translation.y, 0]) },
    ],
  }));

  return { animatedStyle, animate, reset, progress };
}

// ============================================
// GRAPH DRAW ANIMATION
// ============================================

/**
 * Animated stroke dashoffset for SVG path drawing effect
 */
export function useGraphDraw(pathLength: number, trigger?: any) {
  const strokeProgress = useSharedValue(0);

  useEffect(() => {
    strokeProgress.value = 0;
    strokeProgress.value = withTiming(1, TIMING_CONFIGS.graphDraw);
  }, [pathLength, trigger]);

  const strokeDashoffset = useSharedValue(pathLength);

  useEffect(() => {
    strokeDashoffset.value = pathLength;
    strokeDashoffset.value = withTiming(0, TIMING_CONFIGS.graphDraw);
  }, [pathLength, trigger]);

  return { strokeProgress, strokeDashoffset };
}

// ============================================
// STAGGERED LIST ANIMATION
// ============================================

/**
 * Creates staggered fade-in effect for list items
 * @param itemCount - Number of items in the list
 * @param staggerDelay - Delay between each item (default 50ms)
 */
export function useStaggeredList(itemCount: number, staggerDelay: number = 50) {
  const getItemDelay = useCallback((index: number) => {
    return index * staggerDelay;
  }, [staggerDelay]);

  const getItemAnimation = useCallback((index: number) => {
    return useFadeSlide(getItemDelay(index), 'up');
  }, [getItemDelay]);

  return { getItemDelay, getItemAnimation };
}

// ============================================
// PROGRESS BAR ANIMATION
// ============================================

/**
 * Animated progress bar fill
 */
export function useProgressAnimation(targetPercent: number, trigger?: any) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      100,
      withTiming(targetPercent, {
        duration: 600,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      })
    );
  }, [targetPercent, trigger]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${Math.min(progress.value, 100)}%`,
  }));

  return { progress, animatedStyle };
}

// ============================================
// SCALE PULSE (MICRO-INTERACTION)
// ============================================

export function useScalePulse() {
  const scale = useSharedValue(1);

  const onPressIn = useCallback(() => {
    scale.value = withSpring(0.96, SPRING_CONFIGS.snappy);
  }, []);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIGS.snappy);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, onPressIn, onPressOut };
}

// ============================================
// QUESTION SLIDE TRANSITION
// ============================================

export function useQuestionTransition() {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);

  const slideOut = useCallback((direction: 'left' | 'right', onComplete?: () => void) => {
    const target = direction === 'left' ? -300 : 300;
    opacity.value = withTiming(0, { duration: 150 });
    translateX.value = withTiming(target, { duration: 200 }, () => {
      if (onComplete) runOnJS(onComplete)();
    });
  }, []);

  const slideIn = useCallback((fromDirection: 'left' | 'right') => {
    const start = fromDirection === 'left' ? -300 : 300;
    translateX.value = start;
    opacity.value = 0;
    translateX.value = withSpring(0, SPRING_CONFIGS.gentle);
    opacity.value = withTiming(1, { duration: 200 });
  }, []);

  const reset = useCallback(() => {
    translateX.value = 0;
    opacity.value = 1;
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return { animatedStyle, slideOut, slideIn, reset };
}
