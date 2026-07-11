import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

interface Props extends Omit<PressableProps, "style"> {
  /** Visual style for the button surface (padding, background, radius…). */
  style?: StyleProp<ViewStyle>;
  /** Layout style for the outer pressable (e.g. flex: 1). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Scale at full press. Default 0.96. */
  scaleTo?: number;
  children?: React.ReactNode;
}

/**
 * Drop-in Pressable that springs down slightly while pressed, giving taps a
 * physical feel. Scale runs on the native driver (transform-only), so it stays
 * smooth on device and still works on react-native-web.
 */
export default function PressableScale({
  style,
  containerStyle,
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const spring = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) spring(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        spring(1);
        onPressOut?.(e);
      }}
      style={containerStyle}
      {...rest}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
