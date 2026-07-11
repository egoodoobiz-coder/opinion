import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { useColors } from "@/hooks/useColors";
import { ONBOARDING_KEY } from "@/lib/onboarding";

interface Panel {
  icon: string;
  accent: (c: ReturnType<typeof useColors>) => string;
  title: string;
  body: string;
}

const PANELS: Panel[] = [
  {
    icon: "message-circle",
    accent: (c) => c.primary,
    title: "Ask anything",
    body: "Post a question and let people weigh in — yes or no, star ratings, rankings, or rate-every-aspect polls.",
  },
  {
    icon: "thumbs-up",
    accent: (c) => c.yes,
    title: "Vote in a tap",
    body: "Share your take in seconds and watch the results fill in live as everyone weighs in.",
  },
  {
    icon: "bar-chart-2",
    accent: (c) => c.star,
    title: "See what the world thinks",
    body: "Browse opinions by category, follow the voices you trust, and track the pulse in real time.",
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [width, setWidth] = useState(Dimensions.get("window").width);
  const [index, setIndex] = useState(0);

  const isLast = index === PANELS.length - 1;

  async function finish() {
    try {
      await AsyncStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // Non-fatal: worst case the intro shows again next launch.
    }
    router.replace("/(tabs)");
  }

  function next() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isLast) {
      finish();
      return;
    }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    setIndex((i) => i + 1);
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  }

  const s = styles(colors, insets);

  return (
    <View
      style={s.container}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== width) setWidth(w);
      }}
    >
      <View style={s.topBar}>
        {!isLast ? (
          <Pressable onPress={finish} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Text style={s.skip}>Skip</Text>
          </Pressable>
        ) : (
          <View style={{ height: 20 }} />
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        scrollEventThrottle={16}
      >
        {PANELS.map((p) => {
          const accent = p.accent(colors);
          return (
            <View key={p.title} style={[s.panel, { width }]}>
              <View style={[s.iconDisc, { backgroundColor: accent + "1f" }]}>
                <Icon name={p.icon} size={52} color={accent} />
              </View>
              <Text style={s.title}>{p.title}</Text>
              <Text style={s.body}>{p.body}</Text>
            </View>
          );
        })}
      </ScrollView>

      <View style={s.footer}>
        <View style={s.dots}>
          {PANELS.map((_, i) => (
            <View
              key={i}
              style={[
                s.dot,
                i === index ? { backgroundColor: colors.primary, width: 22 } : { backgroundColor: colors.border },
              ]}
            />
          ))}
        </View>

        <Pressable onPress={next} style={({ pressed }) => [s.cta, pressed && { opacity: 0.9 }]}>
          <Text style={s.ctaText}>{isLast ? "Get started" : "Next"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      height: 44,
      paddingTop: Platform.OS === "web" ? 12 : insets.top + 6,
      paddingHorizontal: 20,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    skip: { fontSize: 15, fontWeight: "600", color: colors.mutedForeground },
    panel: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 36,
      gap: 8,
    },
    iconDisc: {
      width: 132,
      height: 132,
      borderRadius: 66,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 28,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.foreground,
      textAlign: "center",
      letterSpacing: -0.5,
    },
    body: {
      fontSize: 15,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 22,
      maxWidth: 340,
    },
    footer: {
      paddingHorizontal: 24,
      paddingBottom: Platform.OS === "web" ? 28 : insets.bottom + 20,
      gap: 22,
    },
    dots: { flexDirection: "row", justifyContent: "center", gap: 7 },
    dot: { width: 7, height: 7, borderRadius: 4 },
    cta: {
      backgroundColor: colors.primary,
      borderRadius: 100,
      paddingVertical: 16,
      alignItems: "center",
    },
    ctaText: { fontSize: 16, fontWeight: "800", color: colors.primaryForeground },
  });
