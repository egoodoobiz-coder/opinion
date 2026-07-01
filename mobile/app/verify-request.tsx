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
import { VOICE_CONFIG, ALL_VOICE_TYPES, type VoiceType } from "@/constants/voiceTypes";

type RequestStatus = "pending" | "approved" | "rejected";

interface VerifyRequest {
  id: string;
  status: RequestStatus;
  requestedVoiceType: VoiceType;
  requestedAt?: string;
  note?: string;
}

export default function VerifyRequestScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { getToken } = useAuth();

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

  const [voiceType, setVoiceType] = useState<VoiceType>("expert");
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
        if (data.requests?.length > 0) {
          setExistingRequest(data.requests[0] as VerifyRequest);
        }
      } else if (res.status === 401) {
        // Not signed in — show form
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
      Alert.alert("Unavailable", "The backend is not configured. Set EXPO_PUBLIC_API_URL to submit a request.");
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
          requestedVoiceType: voiceType,
          note: note.trim() || undefined,
        }),
      });

      let data: any = {};
      try { data = await res.json(); } catch {}

      if (res.status === 409) {
        if (data.status && data.requestedVoiceType) {
          setExistingRequest({ id: "", status: data.status as RequestStatus, requestedVoiceType: data.requestedVoiceType as VoiceType });
        } else {
          Alert.alert("Already submitted", "You already have a pending or approved request.");
        }
        return;
      }

      if (!res.ok) throw new Error(data.error ?? "Failed to submit");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setExistingRequest(
        data.request ?? { id: "", status: "pending" as RequestStatus, requestedVoiceType: voiceType, requestedAt: new Date().toISOString() }
      );
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not submit request. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleReapply() {
    setExistingRequest(null);
    setNote("");
  }

  const s = styles(colors, insets);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 }]}>
        <Pressable style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }]} onPress={() => router.back()}>
          <Icon name="x" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Text style={s.headerTitle}>Apply for a Voice</Text>
        <View style={{ width: 36 }} />
      </View>

      {apiUnavailable && !loading && (
        <View style={s.apiBanner}>
          <Icon name="alert-circle" size={14} color={colors.star} />
          <Text style={s.apiBannerText}>Backend offline — submissions unavailable</Text>
        </View>
      )}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : existingRequest ? (
        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.statusCard}>
            <View style={[s.statusIcon, existingRequest.status === "approved" && s.statusApproved, existingRequest.status === "rejected" && s.statusRejected, existingRequest.status === "pending" && s.statusPending]}>
              <Icon
                name={existingRequest.status === "approved" ? "check-circle" : existingRequest.status === "rejected" ? "x-circle" : "clock"}
                size={36}
                color={existingRequest.status === "approved" ? colors.yes : existingRequest.status === "rejected" ? colors.no : colors.star}
              />
            </View>

            <Text style={s.statusTitle}>
              {existingRequest.status === "approved" ? "Voice Granted!" : existingRequest.status === "rejected" ? "Request Rejected" : "Request Pending"}
            </Text>

            <Text style={s.statusSubtitle}>
              {existingRequest.status === "approved"
                ? "Your Voice badge is now active. Relaunch the app if you don't see it yet."
                : existingRequest.status === "rejected"
                ? "Your request was not approved at this time. You can apply again below."
                : "Your request is under review. We'll notify you once it's processed."}
            </Text>

            <View style={s.requestDetails}>
              {existingRequest.requestedVoiceType && (
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Voice type</Text>
                  <Text style={s.detailValue}>{VOICE_CONFIG[existingRequest.requestedVoiceType]?.label ?? existingRequest.requestedVoiceType}</Text>
                </View>
              )}
              {existingRequest.requestedAt && (
                <View style={s.detailRow}>
                  <Text style={s.detailLabel}>Submitted</Text>
                  <Text style={s.detailValue}>{new Date(existingRequest.requestedAt).toLocaleDateString()}</Text>
                </View>
              )}
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Status</Text>
                <View style={[s.statusPill, existingRequest.status === "approved" && s.pillApproved, existingRequest.status === "rejected" && s.pillRejected, existingRequest.status === "pending" && s.pillPending]}>
                  <Text style={[s.statusPillText, existingRequest.status === "approved" && s.pillTextApproved, existingRequest.status === "rejected" && s.pillTextRejected, existingRequest.status === "pending" && s.pillTextPending]}>
                    {existingRequest.status.charAt(0).toUpperCase() + existingRequest.status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>

            {existingRequest.status === "rejected" && (
              <Pressable style={({ pressed }) => [s.reapplyBtn, pressed && { opacity: 0.8 }]} onPress={handleReapply}>
                <Icon name="refresh-cw" size={15} color="#fff" />
                <Text style={s.reapplyBtnText}>Apply Again</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.intro}>
            Get a verified Voice badge to show your audience who you are. Choose the type that best describes your account.
          </Text>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Voice Type</Text>
            <View style={s.typeGrid}>
              {ALL_VOICE_TYPES.map((vt) => {
                const cfg = VOICE_CONFIG[vt];
                const isActive = voiceType === vt;
                return (
                  <Pressable
                    key={vt}
                    style={[s.typeCard, isActive && { borderColor: cfg.color, borderWidth: 2, backgroundColor: cfg.color + "11" }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setVoiceType(vt); }}
                  >
                    <Icon name={cfg.icon as any} size={22} color={isActive ? cfg.color : colors.mutedForeground} />
                    <Text style={[s.typeName, isActive && { color: cfg.color }]}>{cfg.label}</Text>
                    <Text style={s.typeDesc}>{cfg.description}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>Tell us about your account (optional)</Text>
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

          <View style={s.section}>
            <Text style={s.sectionLabel}>Submitting as</Text>
            <View style={s.accountInfo}>
              <Icon name="mail" size={15} color={colors.mutedForeground} />
              <Text style={s.accountEmail} numberOfLines={1}>{user?.emailAddresses?.[0]?.emailAddress}</Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [s.submitBtn, { backgroundColor: VOICE_CONFIG[voiceType].color }, apiUnavailable && s.submitBtnDisabled, pressed && !apiUnavailable && { opacity: 0.85 }]}
            onPress={handleSubmit}
            disabled={submitting || apiUnavailable}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name={apiUnavailable ? "wifi-off" : "send"} size={16} color="#fff" />
                <Text style={s.submitBtnText}>{apiUnavailable ? "Backend Offline" : "Submit Request"}</Text>
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
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 16, paddingBottom: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
    iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
    apiBanner: {
      flexDirection: "row", alignItems: "center", gap: 8,
      marginHorizontal: 16, marginTop: 12, marginBottom: 4,
      backgroundColor: colors.star + "22", borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 8,
      borderWidth: 1, borderColor: colors.star + "44",
    },
    apiBannerText: { fontSize: 12, color: colors.star, flex: 1 },
    scroll: { padding: 20, gap: 24, paddingBottom: insets.bottom + 40 },
    intro: { fontSize: 14, color: colors.mutedForeground, lineHeight: 21 },
    section: { gap: 8 },
    sectionLabel: { fontSize: 12, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 4 },
    typeGrid: { gap: 10 },
    typeCard: {
      backgroundColor: colors.card, borderRadius: 14,
      borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 4,
    },
    typeName: { fontSize: 15, fontWeight: "700", color: colors.mutedForeground },
    typeDesc: { fontSize: 12, color: colors.mutedForeground, lineHeight: 17 },
    card: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    noteInput: { color: colors.foreground, fontSize: 14, padding: 14, minHeight: 100 },
    charCount: { fontSize: 11, color: colors.mutedForeground, textAlign: "right", padding: 8, paddingTop: 0 },
    accountInfo: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: colors.card, borderRadius: 12,
      borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 14, paddingVertical: 12,
    },
    accountEmail: { flex: 1, fontSize: 14, color: colors.foreground },
    submitBtn: { borderRadius: 14, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    submitBtnDisabled: { backgroundColor: colors.muted },
    submitBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
    disclaimer: { fontSize: 12, color: colors.mutedForeground, textAlign: "center", lineHeight: 18 },
    statusCard: { backgroundColor: colors.card, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 28, alignItems: "center", gap: 14 },
    statusIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
    statusApproved: { backgroundColor: colors.yesBg },
    statusRejected: { backgroundColor: colors.noBg },
    statusPending: { backgroundColor: colors.starBg },
    statusTitle: { fontSize: 20, fontWeight: "800", color: colors.foreground },
    statusSubtitle: { fontSize: 14, color: colors.mutedForeground, textAlign: "center", lineHeight: 21 },
    requestDetails: { width: "100%", backgroundColor: colors.muted, borderRadius: 12, padding: 14, gap: 10 },
    detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    detailLabel: { fontSize: 13, color: colors.mutedForeground },
    detailValue: { fontSize: 13, fontWeight: "600", color: colors.foreground },
    statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
    pillApproved: { backgroundColor: colors.yesBg },
    pillRejected: { backgroundColor: colors.noBg },
    pillPending: { backgroundColor: colors.starBg },
    statusPillText: { fontSize: 12, fontWeight: "700" },
    pillTextApproved: { color: colors.yes },
    pillTextRejected: { color: colors.no },
    pillTextPending: { color: colors.star },
    reapplyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 24, width: "100%" },
    reapplyBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  });
