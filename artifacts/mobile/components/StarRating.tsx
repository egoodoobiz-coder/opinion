import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  value: number;
  onChange?: (val: number) => void;
  readonly?: boolean;
  size?: number;
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
        <Pressable
          key={star}
          disabled={readonly}
          onPress={() => {
            if (!readonly && onChange) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(star);
            }
          }}
          style={({ pressed }) => [pressed && { opacity: 0.6 }]}
        >
          <Feather
            name={star <= value ? "star" : "star"}
            size={size}
            color={star <= value ? colors.star : colors.border}
          />
        </Pressable>
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
