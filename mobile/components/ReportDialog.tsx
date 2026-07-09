import { useAuth } from "@clerk/expo";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icon } from "@/components/Icon";
import ThemedInput from "@/components/ThemedInput";
import { useColors } from "@/hooks/useColors";

const DETAILS_MAX_LENGTH = 1000;

// Must stay in sync with REPORT_REASONS in artifacts/api-server/src/routes/reports.ts.
// Child safety is listed first, as Google's child safety standards policy requires it
// to be an explicit and prominent reporting option.
const REASONS: { value: string; label: string; hint: string }[] = [
  { value: "child_safety", label: "Child safety", hint: "Content that endangers or sexualises a minor" },
  { value: "sexual_content", label: "Sexual content", hint: "Nudity or sexually explicit material" },
  { value: "harassment", label: "Harassment or bullying", hint: "Targeted abuse or threats" },
  { value: "hate_speech", label: "Hate speech", hint: "Attacks based on identity" },
  { value: "violence", label: "Violence", hint: "Graphic violence or incitement" },
  { value: "spam", label: "Spam or scam", hint: "Misleading, repetitive, or fraudulent" },
  { value: "other", label: "Something else", hint: "Tell us what's wrong below" },
];

export interface ReportTarget {
  contentType: "topic" | "comment";
  contentId: string;
  topicId?: string;
  contentSnapshot?: string;
  authorName?: string;
}

interface Props {
  target: ReportTarget | null;
  onClose: () => void;
  /** Called after a report is filed so the caller can hide the content locally. */
  onReported: (contentId: string) => void;
}

export default function ReportDialog({ target, onClose, onReported }: Props) {
  const colors = useColors();
  const { getToken } = useAuth();
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function reset() {
    setReason(null);
    setDetails("");
    setSubmitting(false);
    setError(null);
    setDone(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit() {
    if (!reason || !target) return;
    setSubmitting(true);
    setError(null);
    try {
      // Reporting works signed-out: send the token only when there is one.
      let token: string | null = null;
      try {
        token = await getToken();
      } catch {
        token = null;
      }

      const res = await fetch(`${API_URL}/api/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          contentType: target.contentType,
          contentId: target.contentId,
          topicId: target.topicId,
          reason,
          details: details.trim() || undefined,
          contentSnapshot: target.contentSnapshot?.slice(0, 2000),
          authorName: target.authorName,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Could not send report (HTTP ${res.status})`);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onReported(target.contentId);
      setDone(true);
    } catch (err: any) {
      setError(err?.message ?? "Could not send report. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  const s = styles(colors);
  const isComment = target?.contentType === "comment";

  return (
    <Modal
      visible={!!target}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <View style={s.backdrop}>
        <View style={s.sheet}>
          {done ? (
            <View style={s.doneWrap}>
              <View style={s.doneIcon}>
                <Icon name="check-circle" size={34} color={colors.yes} />
              </View>
              <Text style={s.doneTitle}>Report sent</Text>
              <Text style={s.doneText}>
                Thanks — we've hidden this {isComment ? "comment" : "poll"} from your feed and our
                moderators will review it. Child safety reports are reviewed first.
              </Text>
              <Pressable
                style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.85 }]}
                onPress={close}
              >
                <Text style={s.primaryBtnText}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={s.header}>
                <Icon name="flag" size={17} color={colors.no} />
                <Text style={s.title}>Report {isComment ? "comment" : "poll"}</Text>
                <Pressable
                  onPress={close}
                  style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.6 }]}
                  hitSlop={8}
                >
                  <Icon name="x" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>

              <ScrollView
                style={s.body}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={s.prompt}>Why are you reporting this?</Text>

                {REASONS.map((r) => {
                  const active = reason === r.value;
                  const severe = r.value === "child_safety";
                  return (
                    <Pressable
                      key={r.value}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setReason(r.value);
                      }}
                      style={({ pressed }) => [
                        s.reasonRow,
                        active && { borderColor: colors.primary, backgroundColor: colors.primary + "14" },
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <View style={s.radioOuter}>
                        {active && <View style={s.radioInner} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.reasonLabel, severe && { color: colors.no }]}>{r.label}</Text>
                        <Text style={s.reasonHint}>{r.hint}</Text>
                      </View>
                    </Pressable>
                  );
                })}

                <Text style={s.detailsLabel}>Additional details (optional)</Text>
                <ThemedInput
                  style={s.detailsInput}
                  placeholder="Anything else our moderators should know?"
                  placeholderTextColor={colors.mutedForeground}
                  value={details}
                  onChangeText={setDetails}
                  multiline
                  maxLength={DETAILS_MAX_LENGTH}
                />

                {!!error && (
                  <View style={s.errorBox}>
                    <Icon name="alert-circle" size={14} color={colors.no} />
                    <Text style={s.errorText}>{error}</Text>
                  </View>
                )}
              </ScrollView>

              <View style={s.actions}>
                <Pressable
                  style={({ pressed }) => [s.secondaryBtn, pressed && { opacity: 0.7 }]}
                  onPress={close}
                  disabled={submitting}
                >
                  <Text style={s.secondaryBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    s.submitBtn,
                    (!reason || submitting) && { opacity: 0.45 },
                    pressed && reason && !submitting && { opacity: 0.85 },
                  ]}
                  onPress={submit}
                  disabled={!reason || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={s.submitBtnText}>Submit report</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = (colors: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    sheet: {
      width: "100%",
      maxWidth: 480,
      maxHeight: "85%",
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { flex: 1, fontSize: 16, fontWeight: "700", color: colors.foreground },
    closeBtn: { padding: 2 },
    body: { paddingHorizontal: 16, paddingTop: 12 },
    prompt: { fontSize: 13, color: colors.mutedForeground, marginBottom: 4 },
    reasonRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
    },
    radioOuter: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      borderColor: colors.mutedForeground,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1,
    },
    radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    reasonLabel: { fontSize: 14, fontWeight: "600", color: colors.foreground },
    reasonHint: { fontSize: 11.5, color: colors.mutedForeground, marginTop: 2 },
    detailsLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginTop: 8,
    },
    detailsInput: {
      backgroundColor: colors.muted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      fontSize: 14,
      color: colors.foreground,
      minHeight: 72,
      textAlignVertical: "top",
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.no + "18",
      borderRadius: 10,
      padding: 10,
    },
    errorText: { flex: 1, fontSize: 12.5, color: colors.no },
    actions: {
      flexDirection: "row",
      gap: 10,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: colors.muted,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryBtnText: { fontSize: 14, fontWeight: "600", color: colors.foreground },
    submitBtn: {
      flex: 1.4,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.no,
    },
    submitBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    doneWrap: { padding: 24, alignItems: "center", gap: 10 },
    doneIcon: { marginBottom: 2 },
    doneTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground },
    doneText: {
      fontSize: 13.5,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
    },
    primaryBtn: {
      marginTop: 8,
      alignSelf: "stretch",
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 13,
      alignItems: "center",
    },
    primaryBtnText: { fontSize: 14, fontWeight: "700", color: colors.primaryForeground },
  });
