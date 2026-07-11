import { useAuth, useUser } from "@clerk/expo";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import ScreenHeader from "@/components/ScreenHeader";
import { useTheme, type ThemePreference } from "@/context/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { goBack } from "@/lib/nav";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: string; description: string }[] = [
  { value: "dark", label: "Dark", icon: "moon", description: "Always use the dark theme" },
  { value: "light", label: "Light", icon: "sun", description: "Always use the light theme" },
  { value: "system", label: "System", icon: "smartphone", description: "Follow your device setting" },
];

const SUPPORT_EMAIL = "akshay21790@gmail.com";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn, signOut } = useAuth();
  const { user } = useUser();
  const { preference, setPreference } = useTheme();

  const version = Constants.expoConfig?.version ?? "1.0.0";

  function selectTheme(p: ThemePreference) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPreference(p);
  }

  function handleSignOut() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    signOut();
    goBack(router, "/(tabs)/profile");
  }

  const s = styles(colors, insets);

  return (
    <View style={s.container}>
      <ScreenHeader
        title="Settings"
        variant="close"
        onBack={() => goBack(router, "/(tabs)/profile")}
      />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Appearance */}
        <Text style={s.sectionLabel}>Appearance</Text>
        <View style={s.card}>
          {THEME_OPTIONS.map((opt, i) => {
            const active = preference === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={({ pressed }) => [s.row, i > 0 && s.rowBorder, pressed && { opacity: 0.7 }]}
                onPress={() => selectTheme(opt.value)}
              >
                <View style={[s.rowIcon, active && { backgroundColor: colors.primary + "22" }]}>
                  <Icon name={opt.icon} size={16} color={active ? colors.primary : colors.mutedForeground} />
                </View>
                <View style={s.rowText}>
                  <Text style={[s.rowLabel, active && { color: colors.primary }]}>{opt.label}</Text>
                  <Text style={s.rowDesc}>{opt.description}</Text>
                </View>
                <View style={[s.radio, active && s.radioActive]}>
                  {active && <View style={s.radioDot} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Account */}
        {isSignedIn && (
          <>
            <Text style={s.sectionLabel}>Account</Text>
            <View style={s.card}>
              <View style={s.row}>
                <View style={s.rowIcon}>
                  <Icon name="mail" size={16} color={colors.mutedForeground} />
                </View>
                <View style={s.rowText}>
                  <Text style={s.rowLabel} numberOfLines={1}>
                    {user?.emailAddresses?.[0]?.emailAddress ?? "Signed in"}
                  </Text>
                  <Text style={s.rowDesc}>Signed in</Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [s.row, s.rowBorder, pressed && { opacity: 0.7 }]}
                onPress={handleSignOut}
              >
                <View style={[s.rowIcon, { backgroundColor: colors.noBg }]}>
                  <Icon name="log-out" size={16} color={colors.no} />
                </View>
                <View style={s.rowText}>
                  <Text style={[s.rowLabel, { color: colors.no }]}>Sign Out</Text>
                </View>
              </Pressable>
            </View>
          </>
        )}

        {/* About */}
        <Text style={s.sectionLabel}>About</Text>
        <View style={s.card}>
          <View style={s.row}>
            <View style={s.rowIcon}>
              <Icon name="info" size={16} color={colors.mutedForeground} />
            </View>
            <View style={s.rowText}>
              <Text style={s.rowLabel}>Version</Text>
            </View>
            <Text style={s.rowValue}>{version}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [s.row, s.rowBorder, pressed && { opacity: 0.7 }]}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Opinion app feedback`)}
          >
            <View style={s.rowIcon}>
              <Icon name="send" size={16} color={colors.mutedForeground} />
            </View>
            <View style={s.rowText}>
              <Text style={s.rowLabel}>Contact Support</Text>
              <Text style={s.rowDesc}>Report a problem or share feedback</Text>
            </View>
            <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: 16, paddingBottom: insets.bottom + 40 },
    sectionLabel: {
      fontSize: 11, fontWeight: "700", color: colors.mutedForeground,
      textTransform: "uppercase", letterSpacing: 0.8,
      marginBottom: 8, marginTop: 16, paddingHorizontal: 4,
    },
    card: {
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
      overflow: "hidden",
    },
    row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
    rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
    rowIcon: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: colors.muted,
      alignItems: "center", justifyContent: "center",
    },
    rowText: { flex: 1 },
    rowLabel: { fontSize: 15, fontWeight: "600", color: colors.foreground },
    rowDesc: { fontSize: 12, color: colors.mutedForeground, marginTop: 1 },
    rowValue: { fontSize: 14, color: colors.mutedForeground },
    radio: {
      width: 20, height: 20, borderRadius: 10, borderWidth: 2,
      borderColor: colors.border, alignItems: "center", justifyContent: "center",
    },
    radioActive: { borderColor: colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  });
