import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";

interface Props {
  title: string;
  onBack?: () => void;
  /** "back" shows an arrow (drill-down); "close" shows an x (modal). */
  variant?: "back" | "close";
  /** Optional right-side action; a spacer is rendered when absent to keep the title centred. */
  right?: React.ReactNode;
}

/**
 * Shared screen header so back button, title and spacing are identical across
 * screens. Previously each screen rolled its own — circular button vs bare icon,
 * arrow vs x, insets.top + 8 vs + 4 — which read as inconsistent chrome.
 */
export default function ScreenHeader({ title, onBack, variant = "back", right }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const s = styles(colors);

  return (
    <View style={[s.header, { paddingTop: Platform.OS === "web" ? 16 : insets.top + 8 }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          accessibilityLabel={variant === "close" ? "Close" : "Go back"}
          style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }]}
        >
          <Icon
            name={variant === "close" ? "x" : "arrow-left"}
            size={20}
            color={colors.foreground}
          />
        </Pressable>
      ) : (
        <View style={s.slot} />
      )}

      <Text style={s.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={s.rightSlot}>{right}</View>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 8,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    slot: { width: 38, height: 38 },
    title: {
      flex: 1,
      fontSize: 17,
      fontWeight: "800",
      color: colors.foreground,
      textAlign: "center",
      letterSpacing: -0.2,
    },
    // Matches the left button's footprint so the centred title stays centred.
    rightSlot: { minWidth: 38, height: 38, alignItems: "flex-end", justifyContent: "center" },
  });
