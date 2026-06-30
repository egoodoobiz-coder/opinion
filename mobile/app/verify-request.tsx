import { useUser, useAuth } from "@clerk/expo";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

type AccountType = "company" | "celebrity";
type RequestStatus = "pending" | "approved" | "rejected";

interface VerifyRequest {
  id: string;
  status: RequestStatus;
  requestedAccountType: AccountType;
  requestedAt?: string;
  note?: string;
}

export default function VerifyRequestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();

  // Read env var inside the component so it's always fresh
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

  const [accountType, setAccountType] = useState<AccountType>("company");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingRequest, setExistingRequest] = useState<VerifyRequest | null>(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);

  const fetchMyRequest = useCallback(async () => {
    if (!API_URL) {
      setApiUnavailable(true);
      setLoading(false);
      return;
    }
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/admin/verify-requests/me`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (res.ok) {
        const data = await res.json();
        // API returns desc order — index 0 is the most recent
        if (data.requests?.length > 0) {
          setExistingRequest(data.requests[0] as VerifyRequest);
        }
      } else if (res.status === 401) {
        // Not signed in — let the form show
      } else {
        setApiUnavailable(true);
      }
    } catch {
      setApiUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [getToken, API_URL]);

  useEffect(() => {
    fetchMyRequest();
  }, [fetchMyRequest]);

  async function handleSubmit() {
    if (!user) return;

    if (!API_URL) {
      Alert.alert(
        "Unavailable",
        "The backend is not configured. Set EXPO_PUBLIC_API_URL to submit a request."
      );
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/admin/verify-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({
          userEmail: user.emailAddresses[0]?.emailAddress,
          userName: [user.firstName, user.lastName].filter(Boolean).join(" "),
          requestedAccountType: accountType,
          note: note.trim() || undefined,
        }),
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {}

      if (res.status === 409) {
        // Already have a request — show it instead of an Alert
        if (data.status && data.requestedAccountType) {
          setExistingRequest({
            id: "",
            status: data.status as RequestStatus,
            requestedAccountType: data.requestedAccountType as AccountType,
          });
        } else {
          Alert.alert(
            "Already submitted",
            "You already have a pending or approved request."
          );
        }
        return;
      }

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to submit");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Use the returned request object from the server
      setExistingRequest(
        data.request ?? {
          id: "",
          status: "pending" as RequestStatus,
          requestedAccountType: accountType,
          requestedAt: new Date().toISOString(),
        }
      );
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not submit request. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Allow resubmission after rejection
  function handleReapply() {
    setExistingRequest(null);
    setNote("");
  }

  const s = styles(colors, insets);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={[
          s.header,
          { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 },
        ]}
      >
        <Pressable
          style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
        >
          <Icon name="x" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Text style={s.headerTitle}>Apply for Verification</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* API unavailable banner */}
      {apiUnavailable && !loading && (
        <View style={s.apiBanner}>
          <Icon name="alert-circle" size={14} color={colors.star} />
          <Text style={s.apiBannerText}>
            Backend offline — verification submissions unavailable
          </Text>
        </View>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : existingRequest ? (
        // ── Status view ──────────────────────────────────────────
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.statusCard}>
            <View
              style={[
                s.statusIcon,
                existingRequest.status === "approved" && s.statusApproved,
                existingRequest.status === "rejected" && s.statusRejected,
                existingRequest.status === "pending" && s.statusPending,
              ]}
            >
              <Icon
                name={
                  existingRequest.status === "approved"
                    ? "check-circle"
                    : existingRequest.status === "rejected"
                    ? "x-circle"
                    : "clock"
                }
                size={36}
                color={
                  existingRequest.status === "approved"
                    ? colors.yes
                    : existingRequest.status === "rejected"
                    ? colors.no
                    : colors.star
                }
              />
            </View>

            <Text style={s.statusTitle}>
              {existingRequest.status === "approved"
                ? "Request Approved!"
                : existingRequest.status === "rejected"
                ? "Request Rejected"
                : "Request Pending"}
            </Text>

            <Text style={s.statusSubtitle}>
              {existingRequest.status === "approved"
                ? "Your verified badge is active. Relaunch the app if you don't see it yet."
                : existingRequest.status === "rejected"
                ? "Your request was not approved at this time. You can apply again below."
                : "Your request is under review. You'll be notified once it's processed."}
            </Text>

            <View style={s.requestDetails}>
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Account type</Text>
                <Text style={s.detailValue}>
                  {existingRequest.requestedAccountType === "celebrity"
                    ? "Celebrity"
                    : "Company"}
                </Text>
              </View>
              {existingRequest.requestedAt ? (
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Submitted</Text>
                  <Text style={s.detailValue}>
                    {new Date(existingRequest.requestedAt).toLocaleDateString()}
                  </Text>
                </View>
              ) : null}
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Status</Text>
                <View
                  style={[
                    s.statusPill,
                    existingRequest.status === "approved" && s.pillApproved,
                    existingRequest.status === "rejected" && s.pillRejected,
                    existingRequest.status === "pending" && s.pillPending,
                  ]}
                >
                  <Text
                    style={[
                      s.statusPillText,
                      existingRequest.status === "approved" && s.pillTextApproved,
                      existingRequest.status === "rejected" && s.pillTextRejected,
                      existingRequest.status === "pending" && s.pillTextPending,
                    ]}
                  >
                    {existingRequest.status.charAt(0).toUpperCase() +
                      existingRequest.status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Allow reapplication after rejection */}
            {existingRequest.status === "rejected" && (
              <Pressable
                style={({ pressed }) => [
                  s.reapplyBtn,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={handleReapply}
              >
                <Icon name="refresh-cw" size={15} color="#fff" />
                <Text style={s.reapplyBtnText}>Apply Again</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      ) : (
        // ── Application form ──────────────────────────────────────
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.intro}>
            Apply for a verified badge to show your audience you're an official
            account. Select your account type and tell us a bit about yourself.
          </Text>

          {/* Account type selector */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Account type</Text>
            <View style={s.typeRow}>
              <Pressable
                style={[
                  s.typeCard,
                  accountType === "company" && s.typeCardActive,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAccountType("company");
                }}
              >
                <Icon
                  name="briefcase"
                  size={22}
                  color={
                    accountType === "company"
                      ? colors.primary
                      : colors.mutedForeground
                  }
                />
                <Text
                  style={[
                    s.typeName,
                    accountType === "company" && s.typeNameActive,
                  ]}
                >
                  Company
                </Text>
                <Text style={s.typeDesc}>Brand, business, or organization</Text>
              </Pressable>

              <Pressable
                style={[
                  s.typeCard,
                  accountType === "celebrity" && s.typeCardActiveCeleb,
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setAccountType("celebrity");
                }}
              >
                <Icon
                  name="star"
                  size={22}
                  color={
                    accountType === "celebrity"
                      ? colors.star
                      : colors.mutedForeground
                  }
                />
                <Text
                  style={[
                    s.typeName,
                    accountType === "celebrity" && s.typeNameActiveCeleb,
                  ]}
                >
                  Celebrity
                </Text>
                <Text style={s.typeDesc}>Public figure, artist, or influencer</Text>
              </Pressable>
            </View>
          </View>

          {/* Note field */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>
              Tell us about your account (optional)
            </Text>
            <View style={s.card}>
              <ThemedInput
                style={s.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="e.g. We are a registered business operating in…"
                placeholderTextColor={colors.mutedForeground}
                multiline
                maxLength={300}
                textAlignVertical="top"
              />
              <Text style={s.charCount}>{note.length}/300</Text>
            </View>
          </View>

          {/* Submitting as */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Submitting as</Text>
            <View style={s.accountInfo}>
              <Icon name="mail" size={15} color={colors.mutedForeground} />
              <Text style={s.accountEmail} numberOfLines={1}>
                {user?.emailAddresses?.[0]?.emailAddress}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              s.submitBtn,
              apiUnavailable && s.submitBtnDisabled,
              pressed && !apiUnavailable && { opacity: 0.85 },
            ]}
            onPress={handleSubmit}
            disabled={submitting || apiUnavailable}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon
                  name={apiUnavailable ? "wifi-off" : "send"}
                  size={16}
                  color="#fff"
                />
                <Text style={s.submitBtnText}>
                  {apiUnavailable ? "Backend Offline" : "Submit Request"}
                </Text>
              </>
            )}
          </Pressable>

          <Text style={s.disclaimer}>
            Requests are reviewed by our team. Submitting a false claim may
            result in account suspension.
          </Text>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.foreground,
    },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
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
    scroll: {
      padding: 20,
      gap: 24,
      paddingBottom: insets.bottom + 40,
    },
    intro: { fontSize: 14, color: colors.mutedForeground, lineHeight: 21 },
    section: { gap: 8 },
    sectionLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 4,
    },
    typeRow: { flexDirection: "row", gap: 12 },
    typeCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 6,
      alignItems: "center",
    },
    typeCardActive: { borderColor: colors.primary, borderWidth: 2 },
    typeCardActiveCeleb: { borderColor: colors.star, borderWidth: 2 },
    typeName: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.mutedForeground,
    },
    typeNameActive: { color: colors.primary },
    typeNameActiveCeleb: { color: colors.star },
    typeDesc: {
      fontSize: 11,
      color: colors.mutedForeground,
      textAlign: "center",
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    noteInput: {
      color: colors.foreground,
      fontSize: 14,
      padding: 14,
      minHeight: 100,
    },
    charCount: {
      fontSize: 11,
      color: colors.mutedForeground,
      textAlign: "right",
      padding: 8,
      paddingTop: 0,
    },
    accountInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    accountEmail: { flex: 1, fontSize: 14, color: colors.foreground },
    submitBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    submitBtnDisabled: {
      backgroundColor: colors.muted,
    },
    submitBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    disclaimer: {
      fontSize: 12,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 18,
    },
    // ── Status card ───────────────────────────────────────────────
    statusCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 28,
      alignItems: "center",
      gap: 14,
    },
    statusIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    statusApproved: { backgroundColor: colors.yesBg },
    statusRejected: { backgroundColor: colors.noBg },
    statusPending: { backgroundColor: colors.starBg },
    statusTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.foreground,
    },
    statusSubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 21,
    },
    requestDetails: {
      width: "100%",
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: 14,
      gap: 10,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    detailLabel: { fontSize: 13, color: colors.mutedForeground },
    detailValue: { fontSize: 13, fontWeight: "600", color: colors.foreground },
    // Status pill
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 20,
    },
    pillApproved: { backgroundColor: colors.yesBg },
    pillRejected: { backgroundColor: colors.noBg },
    pillPending: { backgroundColor: colors.starBg },
    statusPillText: { fontSize: 12, fontWeight: "700" },
    pillTextApproved: { color: colors.yes },
    pillTextRejected: { color: colors.no },
    pillTextPending: { color: colors.star },
    // Reapply button
    reapplyBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 24,
      width: "100%",
    },
    reapplyBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  });
