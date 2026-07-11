import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  value: number;
  onChange?: (val: number) => void;
  readonly?: boolean;
  size?: number;
}

function AnimatedStar({
  index,
  filled,
  size,
  color,
  disabled,
  onPress,
}: {
  index: number;
  filled: boolean;
  size: number;
  color: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const wasFilled = useRef(filled);

  useEffect(() => {
    // Pop only when a star newly becomes filled. Stagger by index so filling
    // several at once ripples across the row instead of popping in unison.
    if (filled && !wasFilled.current) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: index * 55, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1.4, useNativeDriver: true, speed: 50, bounciness: 14 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 8 }),
      ]).start();
    }
    wasFilled.current = filled;
  }, [filled, index, scale]);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [pressed && !disabled && { opacity: 0.7 }]}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon name="star" size={size} color={color} />
      </Animated.View>
    </Pressable>
  );
}

export default function StarRating({
  value,
  onChange,
  readonly = false,
  size = 28,
}: Props) {
  const colors = useColors();

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <AnimatedStar
          key={star}
          index={star - 1}
          filled={star <= value}
          size={size}
          color={star <= value ? colors.star : colors.border}
          disabled={readonly}
          onPress={() => {
            if (!readonly && onChange) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(star);
            }
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
  },
});
