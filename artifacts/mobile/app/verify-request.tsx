import { useUser, useAuth } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type AccountType = "company" | "celebrity";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export default function VerifyRequestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();

  const [accountType, setAccountType] = useState<AccountType>("company");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingRequest, setExistingRequest] = useState<any>(null);

  useEffect(() => {
    fetchMyRequest();
  }, []);

  async function fetchMyRequest() {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/verify-requests/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.requests?.length > 0) {
          setExistingRequest(data.requests[0]);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!user) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/admin/verify-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userEmail: user.emailAddresses[0]?.emailAddress,
          userName: [user.firstName, user.lastName].filter(Boolean).join(" "),
          requestedAccountType: accountType,
          note: note.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          Alert.alert("Already submitted", "You already have a pending or approved request.");
          return;
        }
        throw new Error(data.error ?? "Failed to submit");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExistingRequest({ ...data.request, status: "pending" });
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not submit request. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const s = styles(colors, insets);

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 }]}>
        <Pressable
          style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
        >
          <Feather name="x" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Text style={s.headerTitle}>Apply for Verification</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : existingRequest ? (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.statusCard}>
            <View style={[
              s.statusIcon,
              existingRequest.status === "approved" && s.statusApproved,
              existingRequest.status === "rejected" && s.statusRejected,
              existingRequest.status === "pending" && s.statusPending,
            ]}>
              <Feather
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
                ? "Your request was not approved at this time. Contact support for more info."
                : "Your request is under review. You'll be notified once it's processed."}
            </Text>
            <View style={s.requestDetails}>
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Account type</Text>
                <Text style={s.detailValue}>
                  {existingRequest.requestedAccountType === "celebrity" ? "Celebrity" : "Company"}
                </Text>
              </View>
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Submitted</Text>
                <Text style={s.detailValue}>
                  {existingRequest.requestedAt
                    ? new Date(existingRequest.requestedAt).toLocaleDateString()
                    : "—"}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.intro}>
            Apply for a verified badge to show your audience you're an official account. Select your account type and tell us a bit about yourself.
          </Text>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Account type</Text>
            <View style={s.typeRow}>
              <Pressable
                style={[s.typeCard, accountType === "company" && s.typeCardActive]}
                onPress={() => setAccountType("company")}
              >
                <Feather
                  name="briefcase"
                  size={22}
                  color={accountType === "company" ? colors.primary : colors.mutedForeground}
                />
                <Text style={[s.typeName, accountType === "company" && s.typeNameActive]}>
                  Company
                </Text>
                <Text style={s.typeDesc}>Brand, business, or organization</Text>
              </Pressable>
              <Pressable
                style={[s.typeCard, accountType === "celebrity" && s.typeCardActive]}
                onPress={() => setAccountType("celebrity")}
              >
                <Feather
                  name="star"
                  size={22}
                  color={accountType === "celebrity" ? colors.star : colors.mutedForeground}
                />
                <Text style={[s.typeName, accountType === "celebrity" && s.typeNameActiveCeleb]}>
                  Celebrity
                </Text>
                <Text style={s.typeDesc}>Public figure, artist, or influencer</Text>
              </Pressable>
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Tell us about your account (optional)</Text>
            <View style={s.card}>
              <TextInput
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

          <View style={s.section}>
            <Text style={s.sectionLabel}>Submitting as</Text>
            <View style={s.accountInfo}>
              <Feather name="mail" size={15} color={colors.mutedForeground} />
              <Text style={s.accountEmail} numberOfLines={1}>
                {user?.emailAddresses?.[0]?.emailAddress}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [s.submitBtn, pressed && { opacity: 0.85 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="send" size={16} color="#fff" />
                <Text style={s.submitBtnText}>Submit Request</Text>
              </>
            )}
          </Pressable>

          <Text style={s.disclaimer}>
            Requests are reviewed by our team. Submitting a false claim may result in account suspension.
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
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
    iconBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.muted, alignItems: "center", justifyContent: "center",
    },
    scroll: { padding: 20, gap: 24, paddingBottom: insets.bottom + 40 },
    intro: { fontSize: 14, color: colors.mutedForeground, lineHeight: 21 },
    section: { gap: 8 },
    sectionLabel: {
      fontSize: 12, fontWeight: "700", color: colors.mutedForeground,
      textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 4,
    },
    typeRow: { flexDirection: "row", gap: 12 },
    typeCard: {
      flex: 1, backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 6, alignItems: "center",
    },
    typeCardActive: { borderColor: colors.primary, borderWidth: 2 },
    typeName: { fontSize: 15, fontWeight: "700", color: colors.mutedForeground },
    typeNameActive: { color: colors.primary },
    typeNameActiveCeleb: { color: colors.star },
    typeDesc: { fontSize: 11, color: colors.mutedForeground, textAlign: "center" },
    card: {
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    },
    noteInput: {
      color: colors.foreground, fontSize: 14, padding: 14,
      minHeight: 100,
    },
    charCount: {
      fontSize: 11, color: colors.mutedForeground,
      textAlign: "right", padding: 8, paddingTop: 0,
    },
    accountInfo: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.card, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    accountEmail: { flex: 1, fontSize: 14, color: colors.foreground },
    submitBtn: {
      backgroundColor: colors.primary, borderRadius: 14,
      paddingVertical: 15, flexDirection: "row",
      alignItems: "center", justifyContent: "center", gap: 8,
    },
    submitBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    disclaimer: { fontSize: 12, color: colors.mutedForeground, textAlign: "center", lineHeight: 18 },
    // Status card
    statusCard: {
      backgroundColor: colors.card, borderRadius: 20,
      borderWidth: 1, borderColor: colors.border,
      padding: 28, alignItems: "center", gap: 14,
    },
    statusIcon: {
      width: 72, height: 72, borderRadius: 36,
      alignItems: "center", justifyContent: "center",
    },
    statusApproved: { backgroundColor: colors.yesBg },
    statusRejected: { backgroundColor: colors.noBg },
    statusPending: { backgroundColor: colors.starBg },
    statusTitle: { fontSize: 20, fontWeight: "800", color: colors.foreground },
    statusSubtitle: {
      fontSize: 14, color: colors.mutedForeground, textAlign: "center", lineHeight: 21,
    },
    requestDetails: {
      width: "100%", backgroundColor: colors.muted, borderRadius: 12, padding: 14, gap: 8,
    },
    detailRow: { flexDirection: "row", justifyContent: "space-between" },
    detailLabel: { fontSize: 13, color: colors.mutedForeground },
    detailValue: { fontSize: 13, fontWeight: "600", color: colors.foreground },
  });
