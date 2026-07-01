import { useAuth, useUser } from "@clerk/expo";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ThemedInput from "@/components/ThemedInput";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import { VOICE_CONFIG } from "@/constants/voiceTypes";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isSignedIn, isLoaded, signOut, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { topics, userVotes, userId } = useApp();

  const isPremium = (user?.unsafeMetadata as any)?.isPremium === true;
  const voiceType = (user?.unsafeMetadata as any)?.voiceType as string | undefined;
  const voiceCfg = voiceType ? VOICE_CONFIG[voiceType as keyof typeof VOICE_CONFIG] : null;

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminCode, setAdminCode] = useState("");
  const [claimingAdmin, setClaimingAdmin] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);

  // Fetch admin status and check verification on mount
  const fetchStatus = useCallback(async () => {
    if (!isSignedIn || !user) return;
    if (!API_URL) {
      setApiUnavailable(true);
      return;
    }
    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token ?? ""}`,
        "X-Clerk-User-Id": user?.id ?? "",
      };

      // Check admin status
      const adminRes = await fetch(`${API_URL}/api/admin/is-admin`, {
        headers,
      });
      if (adminRes.ok) {
        const adminData = await adminRes.json();
        setIsAdmin(adminData.isAdmin === true);
      }

      // Auto-activate premium if verification approved
      if (!isPremium) {
        const verifyRes = await fetch(
          `${API_URL}/api/admin/verify-requests/me`,
          { headers }
        );
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json();
          const approved = (verifyData.requests ?? []).find(
            (r: any) => r.status === "approved"
          );
          if (approved) {
            await user!.update({
              unsafeMetadata: {
                ...(user!.unsafeMetadata as any),
                isPremium: true,
                accountType: approved.requestedAccountType,
              },
            });
          }
        }
      }
    } catch {
      setApiUnavailable(true);
    }
  }, [isSignedIn, user?.id, isPremium, getToken, API_URL]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleAdminClaim() {
    if (!adminCode.trim() || !user) return;
    if (!API_URL) {
      Alert.alert(
        "Unavailable",
        "API server is not configured. Set EXPO_PUBLIC_API_URL to use admin features."
      );
      return;
    }
    setClaimingAdmin(true);
    try {
      const token = await getToken();
      if (!token) {
        Alert.alert(
          "Session Error",
          "Could not get auth token. Please sign out and sign in again."
        );
        return;
      }
      const res = await fetch(`${API_URL}/api/admin/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          secret: adminCode.trim(),
          userEmail: user.emailAddresses?.[0]?.emailAddress,
          clerkUserId: user.id,
        }),
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {}
      if (res.ok) {
        setIsAdmin(true);
        setShowAdminModal(false);
        setAdminCode("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Access Granted", "You are now the master admin.");
      } else {
        Alert.alert(
          "Failed",
          `Status ${res.status}: ${data.error ?? "Unknown error"}`
        );
      }
    } catch (e: any) {
      Alert.alert(
        "Network Error",
        e?.message ?? "Could not connect. Check your connection."
      );
    } finally {
      setClaimingAdmin(false);
    }
  }

  const clerkUserId = user?.id ?? userId;

  const myTopics = useMemo(
    () =>
      topics
        .filter((t) => t.createdBy === clerkUserId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [topics, clerkUserId]
  );

  const totalVotes = Object.keys(userVotes).length;
  const totalReceived = myTopics.reduce((sum, t) => {
    const base = t.yesCount + t.noCount + t.ratingCount;
    const aspectTotal = t.aspectVotes
      ? Object.values(t.aspectVotes).reduce((s, v) => s + v.up + v.down, 0)
      : 0;
    const rankingTotal = Object.values(t.rankingVotes ?? {}).reduce(
      (s, arr) => s + arr.length,
      0
    );
    return sum + base + aspectTotal + rankingTotal;
  }, 0);


  const s = styles(colors, insets);

  if (!isLoaded) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!isSignedIn) {
    return (
      <View style={s.container}>
        <View
          style={[
            s.header,
            { paddingTop: Platform.OS === "web" ? 16 : insets.top + 4 },
          ]}
        >
          <Text style={s.title}>Profile</Text>
        </View>
        <View style={s.signInPrompt}>
          <Icon name="user" size={56} color={colors.border} />
          <Text style={s.signInTitle}>Join Opinion</Text>
          <Text style={s.signInSubtitle}>
            Create an account to vote, post topics, and unlock premium features
          </Text>
          <Pressable
            style={({ pressed }) => [s.signInBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/(auth)/sign-in")}
          >
            <Text style={s.signInBtnText}>Sign In</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [s.signUpBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/(auth)/sign-up")}
          >
            <Text style={s.signUpBtnText}>Create Account</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingBottom: Platform.OS === "web" ? 68 : insets.bottom + 56 },
        ]}
      >
        {/* Header */}
        <View
          style={[
            s.header,
            { paddingTop: Platform.OS === "web" ? 16 : insets.top + 4 },
          ]}
        >
          <Text style={s.title}>Profile</Text>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              signOut();
            }}
            style={({ pressed }) => [s.signOutBtn, pressed && { opacity: 0.6 }]}
          >
            <Icon name="log-out" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* API unavailable banner */}
        {apiUnavailable && (
          <View style={s.apiBanner}>
            <Icon name="alert-circle" size={14} color={colors.star} />
            <Text style={s.apiBannerText}>
              Backend offline — admin & verification features unavailable
            </Text>
          </View>
        )}

        {/* User info card */}
        <Pressable
          style={({ pressed }) => [s.userCard, pressed && { opacity: 0.85 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push("/edit-profile");
          }}
        >
          <View style={s.avatarContainer}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {(
                  (user?.firstName?.[0] ?? "") +
                    (user?.lastName?.[0] ?? "") ||
                  (user?.emailAddresses?.[0]?.emailAddress ?? "U")[0]
                ).toUpperCase()}
              </Text>
            </View>
            {isPremium && (
              <View style={s.premiumBadgeOnAvatar}>
                <Icon name="check" size={10} color="#fff" />
              </View>
            )}
          </View>
          <View style={s.userInfo}>
            <View style={s.nameRow}>
              <Text style={s.userName} numberOfLines={1}>
                {[user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
                  user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
                  "You"}
              </Text>
              {isPremium && voiceCfg && (
                <View style={[s.badge, { backgroundColor: voiceCfg.color + "22", borderWidth: 1, borderColor: voiceCfg.color + "55" }]}>
                  <Icon name={voiceCfg.icon} size={11} color={voiceCfg.color} />
                  <Text style={[s.badgeText, { color: voiceCfg.color }]}>{voiceCfg.label}</Text>
                </View>
              )}
            </View>
            <Text style={s.userEmail} numberOfLines={1}>
              {user?.emailAddresses?.[0]?.emailAddress ?? ""}
            </Text>
          </View>
          <View style={s.editIconWrap}>
            <Icon name="edit-2" size={14} color={colors.mutedForeground} />
          </View>
        </Pressable>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statNum}>{myTopics.length}</Text>
            <Text style={s.statLabel}>Created</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statNum}>{totalVotes}</Text>
            <Text style={s.statLabel}>Voted</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statNum}>{totalReceived.toLocaleString()}</Text>
            <Text style={s.statLabel}>Received</Text>
          </View>
        </View>

        {/* Admin panel button */}
        {isAdmin && (
          <Pressable
            style={({ pressed }) => [s.adminBtn, pressed && { opacity: 0.8 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push("/admin");
            }}
          >
            <Icon name="shield" size={16} color={colors.primary} />
            <Text style={s.adminBtnText}>Admin Panel</Text>
            <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}

        {/* Voice / verify prompt */}
        {!isPremium && (
          <View style={s.premiumCard}>
            <View style={s.premiumHeader}>
              <Icon name="award" size={18} color={colors.star} />
              <Text style={s.premiumTitle}>Get a Voice</Text>
            </View>
            <Text style={s.premiumSubtitle}>
              Apply as an Expert, Brand, Public Figure, or Creator to get a verified Voice badge and unlock analytics.
            </Text>
            <Pressable
              style={({ pressed }) => [s.upgradeBtn, s.upgradeBtnVerify, pressed && { opacity: 0.8 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/verify-request");
              }}
            >
              <Icon name="shield" size={15} color="#fff" />
              <Text style={s.upgradeBtnText}>Apply for a Voice</Text>
            </Pressable>
          </View>
        )}

        {/* Analytics button for voice users */}
        {isPremium && (
          <Pressable
            style={({ pressed }) => [s.analyticsBtn, pressed && { opacity: 0.8 }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push("/analytics");
            }}
          >
            <Icon name="bar-chart-2" size={16} color={colors.primary} />
            <Text style={s.analyticsBtnText}>View Analytics</Text>
            <Icon name="chevron-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}

        {/* Admin setup link — subtle, bottom of page */}
        {!isAdmin && (
          <Pressable
            style={({ pressed }) => [
              s.adminSetupLink,
              pressed && { opacity: 0.5 },
            ]}
            onPress={() => setShowAdminModal(true)}
          >
            <Text style={s.adminSetupLinkText}>Admin setup</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Admin claim modal */}
      <Modal
        visible={showAdminModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowAdminModal(false);
          setAdminCode("");
        }}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
        >
          <Pressable
            style={s.modalBackdrop}
            onPress={() => {
              setShowAdminModal(false);
              setAdminCode("");
            }}
          />
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Icon name="shield" size={20} color={colors.primary} />
              <Text style={s.modalTitle}>Admin Access</Text>
            </View>
            <Text style={s.modalSubtitle}>
              Enter the admin secret code to claim master admin access.
            </Text>
            <ThemedInput
              style={s.modalInput}
              value={adminCode}
              onChangeText={setAdminCode}
              placeholder="Enter secret code"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleAdminClaim}
            />
            <View style={s.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  s.modalCancelBtn,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => {
                  setShowAdminModal(false);
                  setAdminCode("");
                }}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  s.modalConfirmBtn,
                  !adminCode.trim() && s.modalConfirmDisabled,
                  pressed && adminCode.trim() && { opacity: 0.8 },
                ]}
                onPress={handleAdminClaim}
                disabled={!adminCode.trim() || claimingAdmin}
              >
                {claimingAdmin ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.modalConfirmText}>Claim Access</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    signOutBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    apiBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 4,
      backgroundColor: colors.star + "22",
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.star + "44",
    },
    apiBannerText: {
      fontSize: 12,
      color: colors.star,
      flex: 1,
    },
    userCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      margin: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarContainer: { position: "relative" },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary + "33",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.primary,
    },
    premiumBadgeOnAvatar: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: colors.star,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: colors.card,
    },
    userInfo: { flex: 1 },
    editIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    userName: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 100,
    },
    badgeText: { fontSize: 10, fontWeight: "700" },
    userEmail: { fontSize: 12, color: colors.mutedForeground, marginTop: 2 },
    statsRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
      marginHorizontal: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statBox: { flex: 1, alignItems: "center", gap: 2 },
    statNum: { fontSize: 22, fontWeight: "800", color: colors.primary },
    statLabel: { fontSize: 11, color: colors.mutedForeground, fontWeight: "500" },
    statDivider: { width: 1, height: 32, backgroundColor: colors.border },
    adminBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.primary + "44",
    },
    adminBtnText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    premiumCard: {
      margin: 16,
      marginTop: 0,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.star + "55",
      gap: 10,
    },
    premiumHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    premiumTitle: { fontSize: 16, fontWeight: "800", color: colors.star },
    premiumSubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      lineHeight: 18,
    },
    upgradeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: 12,
    },
    upgradeBtnVerify: { backgroundColor: colors.yes },
    upgradeBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    analyticsBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.primary + "44",
    },
    analyticsBtnText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    signInPrompt: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      gap: 12,
    },
    signInTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.foreground,
      marginTop: 16,
    },
    signInSubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
    },
    signInBtn: {
      width: "100%",
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 8,
    },
    signInBtnText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.primaryForeground,
    },
    signUpBtn: {
      width: "100%",
      backgroundColor: colors.muted,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    signUpBtnText: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.foreground,
    },
    adminSetupLink: {
      alignSelf: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginTop: 8,
      marginBottom: 4,
    },
    adminSetupLinkText: {
      fontSize: 12,
      color: colors.border,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    modalBackdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0,0,0,0.75)",
    },
    modalCard: {
      width: "100%",
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      gap: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    modalTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground },
    modalSubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      lineHeight: 19,
    },
    modalInput: {
      backgroundColor: colors.muted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 15,
      color: colors.foreground,
    },
    modalActions: { flexDirection: "row", gap: 10 },
    modalCancelBtn: {
      flex: 1,
      backgroundColor: colors.muted,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    modalCancelText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    modalConfirmBtn: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    modalConfirmDisabled: { backgroundColor: colors.muted },
    modalConfirmText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  });
