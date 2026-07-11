import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View, type ViewStyle } from "react-native";

interface Props {
  /** Fill amount, 0–100. */
  percent: number;
  /** Fill colour. */
  color: string;
  /** Track (unfilled) colour. */
  trackColor: string;
  height?: number;
  radius?: number;
  /** Delay before the fill animates in, ms. Lets stacked bars cascade. */
  delay?: number;
  style?: ViewStyle;
}

/**
 * A horizontal progress/result bar whose fill animates whenever `percent`
 * changes — and sweeps up from empty on first mount. Uses the built-in
 * Animated API (no reanimated/worklets) with useNativeDriver: false, since
 * width is a layout prop; this also keeps it working on react-native-web.
 */
export default function AnimatedBar({
  percent,
  color,
  trackColor,
  height = 6,
  radius,
  delay = 0,
  style,
}: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const anim = useRef(new Animated.Value(0)).current;
  const br = radius ?? height / 2;

  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue: clamped,
      duration: 550,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [clamped, delay, anim]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.track, { height, borderRadius: br, backgroundColor: trackColor }, style]}>
      <Animated.View style={{ width, height: "100%", borderRadius: br, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  // No fixed width: in a column parent it stretches full-width; in a row, the
  // caller passes style={{ flex: 1 }}.
  track: { overflow: "hidden", alignSelf: "stretch" },
});
