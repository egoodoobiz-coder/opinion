import { useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ThemedInput from "@/components/ThemedInput";
import { useColors } from "@/hooks/useColors";

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();

  const isPremium = (user?.unsafeMetadata as any)?.isPremium === true;
  const accountType: string = (user?.unsafeMetadata as any)?.accountType ?? "regular";

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [saving, setSaving] = useState(false);

  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : "Unknown";

  const initials = ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() ||
    email[0]?.toUpperCase() || "U";

  const hasChanges =
    firstName.trim() !== (user?.firstName ?? "") ||
    lastName.trim() !== (user?.lastName ?? "");

  async function handleSave() {
    if (!hasChanges || !user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSaving(true);
    try {
      await user.update({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err?.errors?.[0]?.message ?? "Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const s = styles(colors, insets);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 }]}>
        <Pressable
          style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
        >
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Text style={s.headerTitle}>Edit Profile</Text>
        <Pressable
          style={({ pressed }) => [
            s.saveBtn,
            !hasChanges && s.saveBtnDisabled,
            pressed && hasChanges && { opacity: 0.8 },
          ]}
          onPress={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={[s.saveBtnText, !hasChanges && s.saveBtnTextDisabled]}>
              Save
            </Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.scroll}
      >
        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatarWrap}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            {isPremium && (
              <View style={[s.premiumRing, accountType === "celebrity" ? s.ringCelebrity : s.ringCompany]}>
                <Feather name="check" size={10} color="#fff" />
              </View>
            )}
          </View>
          {isPremium && (
            <View style={[s.accountBadge, accountType === "celebrity" ? s.badgeCelebrity : s.badgeCompany]}>
              <Feather name="check-circle" size={12} color="#fff" />
              <Text style={s.accountBadgeText}>
                {accountType === "celebrity" ? "Verified Celebrity" : "Verified Company"}
              </Text>
            </View>
          )}
        </View>

        {/* Name fields */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Name</Text>
          <View style={s.card}>
            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>First name</Text>
              <ThemedInput
                style={s.fieldInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
            <View style={s.divider} />
            <View style={s.fieldRow}>
              <Text style={s.fieldLabel}>Last name</Text>
              <ThemedInput
                style={s.fieldInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>
          </View>
        </View>

        {/* Account details */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>Account</Text>
          <View style={s.card}>
            <View style={s.detailRow}>
              <View style={s.detailIconWrap}>
                <Feather name="mail" size={15} color={colors.mutedForeground} />
              </View>
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>Email</Text>
                <Text style={s.detailValue} numberOfLines={1}>{email}</Text>
              </View>
              <View style={s.verifiedChip}>
                <Feather name="check" size={10} color={colors.primary} />
                <Text style={s.verifiedText}>Verified</Text>
              </View>
            </View>
            <View style={s.divider} />
            <View style={s.detailRow}>
              <View style={s.detailIconWrap}>
                <Feather name="shield" size={15} color={colors.mutedForeground} />
              </View>
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>Account type</Text>
                <Text style={s.detailValue}>
                  {isPremium
                    ? accountType === "celebrity"
                      ? "Celebrity (Premium)"
                      : "Company (Premium)"
                    : "Standard"}
                </Text>
              </View>
              {!isPremium && (
                <Pressable
                  style={({ pressed }) => [s.upgradeChip, pressed && { opacity: 0.7 }]}
                  onPress={() => router.push("/upgrade")}
                >
                  <Text style={s.upgradeChipText}>Upgrade</Text>
                </Pressable>
              )}
            </View>
            <View style={s.divider} />
            <View style={s.detailRow}>
              <View style={s.detailIconWrap}>
                <Feather name="calendar" size={15} color={colors.mutedForeground} />
              </View>
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>Member since</Text>
                <Text style={s.detailValue}>{memberSince}</Text>
              </View>
            </View>
            <View style={s.divider} />
            <View style={s.detailRow}>
              <View style={s.detailIconWrap}>
                <Feather name="hash" size={15} color={colors.mutedForeground} />
              </View>
              <View style={s.detailContent}>
                <Text style={s.detailLabel}>User ID</Text>
                <Text style={s.detailValue} numberOfLines={1}>
                  {user?.id?.slice(0, 20)}…
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Connected accounts */}
        {(user?.externalAccounts?.length ?? 0) > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>Connected accounts</Text>
            <View style={s.card}>
              {user?.externalAccounts?.map((acct, i) => (
                <React.Fragment key={acct.id}>
                  {i > 0 && <View style={s.divider} />}
                  <View style={s.detailRow}>
                    <View style={s.detailIconWrap}>
                      <Feather name="link" size={15} color={colors.mutedForeground} />
                    </View>
                    <View style={s.detailContent}>
                      <Text style={s.detailLabel}>
                        {acct.provider.charAt(0).toUpperCase() + acct.provider.slice(1)}
                      </Text>
                      <Text style={s.detailValue} numberOfLines={1}>
                        {acct.emailAddress ?? acct.username ?? "Connected"}
                      </Text>
                    </View>
                    <View style={s.verifiedChip}>
                      <Feather name="check" size={10} color={colors.primary} />
                      <Text style={s.verifiedText}>Linked</Text>
                    </View>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: 10,
      minWidth: 60,
      alignItems: "center",
    },
    saveBtnDisabled: { backgroundColor: colors.muted },
    saveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    saveBtnTextDisabled: { color: colors.mutedForeground },
    scroll: {
      padding: 16,
      paddingBottom: insets.bottom + 32,
      gap: 24,
    },
    avatarSection: { alignItems: "center", gap: 12, paddingVertical: 8 },
    avatarWrap: { position: "relative" },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary + "33",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { fontSize: 32, fontWeight: "800", color: colors.primary },
    premiumRing: {
      position: "absolute",
      bottom: 2,
      right: 2,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.background,
    },
    ringCompany: { backgroundColor: colors.primary },
    ringCelebrity: { backgroundColor: "#f59e0b" },
    accountBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 100,
    },
    badgeCompany: { backgroundColor: colors.primary + "22", borderWidth: 1, borderColor: colors.primary + "55" },
    badgeCelebrity: { backgroundColor: "#f59e0b22", borderWidth: 1, borderColor: "#f59e0b55" },
    accountBadgeText: { fontSize: 12, fontWeight: "700", color: colors.foreground },
    section: { gap: 8 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 4,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },
    fieldRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    fieldLabel: {
      fontSize: 14,
      color: colors.mutedForeground,
      width: 90,
    },
    fieldInput: {
      flex: 1,
      fontSize: 15,
      fontWeight: "500",
      color: colors.foreground,
      textAlign: "right",
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    detailIconWrap: {
      width: 28,
      alignItems: "center",
    },
    detailContent: { flex: 1 },
    detailLabel: { fontSize: 12, color: colors.mutedForeground, marginBottom: 2 },
    detailValue: { fontSize: 14, fontWeight: "500", color: colors.foreground },
    verifiedChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.primary + "22",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 100,
    },
    verifiedText: { fontSize: 11, fontWeight: "600", color: colors.primary },
    upgradeChip: {
      backgroundColor: "#f59e0b22",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: "#f59e0b55",
    },
    upgradeChipText: { fontSize: 11, fontWeight: "700", color: "#f59e0b" },
  });
