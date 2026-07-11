import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

interface Props {
  icon: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Shared empty-state block: an icon in a soft circle, a title, an optional
 * subtitle and call-to-action. Replaces the earlier pattern of a faint
 * border-coloured icon over two grey lines. Fades and rises in on mount so an
 * empty screen doesn't feel dead.
 */
export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }: Props) {
  const colors = useColors();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);

  const s = styles(colors);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <Animated.View style={[s.wrap, { opacity: anim, transform: [{ translateY }] }]}>
      <View style={s.iconCircle}>
        <Icon name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={s.title}>{title}</Text>
      {!!subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
      {!!actionLabel && !!onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [s.action, pressed && { opacity: 0.85 }]}
        >
          <Text style={s.actionText}>{actionLabel}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    wrap: { alignItems: "center", paddingTop: 72, paddingHorizontal: 32, gap: 6 },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      // A brand-tinted disc: a coloured (hued) fill reads on the pure-black bg
      // where a low-opacity grey would vanish, and ties the empty state to the
      // app accent. Works on the white light bg too.
      backgroundColor: colors.primary + "1f",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    title: { fontSize: 17, fontWeight: "800", color: colors.foreground, textAlign: "center" },
    subtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
      maxWidth: 300,
    },
    action: {
      marginTop: 16,
      backgroundColor: colors.primary,
      borderRadius: 100,
      paddingHorizontal: 22,
      paddingVertical: 11,
    },
    actionText: { fontSize: 14, fontWeight: "700", color: colors.primaryForeground },
  });
