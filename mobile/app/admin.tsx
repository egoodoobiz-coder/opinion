import { useAuth } from "@clerk/expo";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

type RequestStatus = "pending" | "approved" | "rejected";
type FilterType = "pending" | "approved" | "rejected" | "all";

type VerificationRequest = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  requestedAccountType: "company" | "celebrity";
  status: RequestStatus;
  note: string | null;
  requestedAt: string;
  reviewedAt: string | null;
};

// Track which specific action is in progress per request
type ProcessingState = { id: string; action: "approve" | "reject" } | null;

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();

  // Read env var inside component so it's always fresh
  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("pending");
  const [processing, setProcessing] = useState<ProcessingState>(null);

  // Debounce ref so rapid refresh taps don't fire concurrent fetches
  const fetchingRef = useRef(false);

  const fetchRequests = useCallback(
    async (isRefresh = false) => {
      if (fetchingRef.current && !isRefresh) return;
      fetchingRef.current = true;
      setError(null);

      if (!API_URL) {
        setError("Backend not configured. Set EXPO_PUBLIC_API_URL to use the admin panel.");
        setLoading(false);
        setRefreshing(false);
        fetchingRef.current = false;
        return;
      }

      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/admin/verify-requests`, {
          headers: { Authorization: `Bearer ${token ?? ""}` },
        });

        if (!res.ok) {
          if (res.status === 403) {
            Alert.alert(
              "Access Denied",
              "You don't have admin privileges.",
              [{ text: "Go Back", onPress: () => router.back() }]
            );
            return;
          }
          throw new Error(`Server error (${res.status})`);
        }

        const data = await res.json();
        setRequests(data.requests ?? []);
      } catch (err: any) {
        setError(err.message ?? "Could not load requests.");
      } finally {
        setLoading(false);
        setRefreshing(false);
        fetchingRef.current = false;
      }
    },
    [getToken, API_URL]
  );

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  function confirmAction(id: string, action: "approve" | "reject") {
    const req = requests.find((r) => r.id === id);
    if (!req) return;

    const name = req.userName || req.userEmail.split("@")[0];
    const label = action === "approve" ? "Approve" : "Reject";
    const typeLabel =
      req.requestedAccountType === "celebrity" ? "Celebrity" : "Company";

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      `${label} request?`,
      `${label} ${typeLabel} verification for ${name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: label,
          style: action === "reject" ? "destructive" : "default",
          onPress: () => handleAction(id, action),
        },
      ]
    );
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    setProcessing({ id, action });
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/admin/verify-requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ action }),
      });

      let data: any = {};
      try { data = await res.json(); } catch {}

      if (!res.ok) {
        throw new Error(data.error ?? "Failed");
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const newStatus: RequestStatus =
        action === "approve" ? "approved" : "rejected";

      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: newStatus, reviewedAt: new Date().toISOString() }
            : r
        )
      );
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not process request.");
    } finally {
      setProcessing(null);
    }
  }

  const filtered = requests.filter(
    (r) => filter === "all" || r.status === filter
  );
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const s = styles(colors, insets);

  return (
    <View style={s.container}>
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

        <View style={s.headerCenter}>
          <Icon name="shield" size={16} color={colors.primary} />
          <Text style={s.headerTitle}>Admin Panel</Text>
          {pendingCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>

        <Pressable
          style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }]}
          onPress={() => {
            if (refreshing) return;
            setRefreshing(true);
            fetchRequests(true);
          }}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Icon name="refresh-cw" size={18} color={colors.mutedForeground} />
          )}
        </Pressable>
      </View>

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {(["pending", "all", "approved", "rejected"] as const).map((f) => (
          <Pressable
            key={f}
            style={[s.filterTab, filter === f && s.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                s.filterTabText,
                filter === f && s.filterTabTextActive,
              ]}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Body */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        // ── Error state ─────────────────────────────────────────
        <View style={s.center}>
          <Icon name="alert-circle" size={40} color={colors.no} />
          <Text style={s.errorTitle}>Something went wrong</Text>
          <Text style={s.errorSubtitle}>{error}</Text>
          <Pressable
            style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.8 }]}
            onPress={() => {
              setLoading(true);
              fetchRequests();
            }}
          >
            <Icon name="refresh-cw" size={14} color="#fff" />
            <Text style={s.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        // ── Request list ─────────────────────────────────────────
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchRequests(true);
              }}
              tintColor={colors.primary}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Icon name="inbox" size={40} color={colors.border} />
              <Text style={s.emptyTitle}>
                No {filter === "all" ? "" : filter} requests
              </Text>
              <Text style={s.emptySubtitle}>
                {filter === "pending"
                  ? "Nothing waiting for review right now"
                  : "Nothing to show for this filter"}
              </Text>
            </View>
          ) : (
            filtered.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                processing={processing}
                colors={colors}
                s={s}
                onAction={confirmAction}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Extracted card component ────────────────────────────────────────────────
function RequestCard({
  req,
  processing,
  colors,
  s,
  onAction,
}: {
  req: VerificationRequest;
  processing: ProcessingState;
  colors: ReturnType<typeof useColors>;
  s: ReturnType<typeof styles>;
  onAction: (id: string, action: "approve" | "reject") => void;
}) {
  const isApproving =
    processing?.id === req.id && processing.action === "approve";
  const isRejecting =
    processing?.id === req.id && processing.action === "reject";
  const isProcessing = isApproving || isRejecting;

  return (
    <View style={s.card}>
      {/* Top row: avatar + name + type pill */}
      <View style={s.cardTop}>
        <View style={s.cardLeft}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarLetter}>
              {(req.userName?.[0] ?? req.userEmail[0]).toUpperCase()}
            </Text>
          </View>
          <View style={s.cardMeta}>
            <Text style={s.cardName} numberOfLines={1}>
              {req.userName || req.userEmail.split("@")[0]}
            </Text>
            <Text style={s.cardEmail} numberOfLines={1}>
              {req.userEmail}
            </Text>
          </View>
        </View>
        <View
          style={[
            s.typePill,
            req.requestedAccountType === "celebrity"
              ? s.typeCeleb
              : s.typeCompany,
          ]}
        >
          <Icon
            name={
              req.requestedAccountType === "celebrity" ? "star" : "briefcase"
            }
            size={11}
            color={
              req.requestedAccountType === "celebrity"
                ? colors.star
                : colors.primary
            }
          />
          <Text
            style={[
              s.typePillText,
              req.requestedAccountType === "celebrity"
                ? s.typePillTextCeleb
                : s.typePillTextCompany,
            ]}
          >
            {req.requestedAccountType === "celebrity" ? "Celebrity" : "Company"}
          </Text>
        </View>
      </View>

      {/* Note */}
      {req.note ? (
        <View style={s.noteBox}>
          <Text style={s.noteText} numberOfLines={3}>
            {req.note}
          </Text>
        </View>
      ) : null}

      {/* Bottom row: date + actions */}
      <View style={s.cardBottom}>
        <Text style={s.dateText}>
          {new Date(req.requestedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Text>

        {req.status === "pending" ? (
          <View style={s.actionRow}>
            {/* Reject */}
            <Pressable
              style={({ pressed }) => [
                s.rejectBtn,
                isProcessing && s.actionBtnDisabled,
                pressed && !isProcessing && { opacity: 0.75 },
              ]}
              onPress={() => onAction(req.id, "reject")}
              disabled={isProcessing}
            >
              {isRejecting ? (
                <ActivityIndicator size="small" color={colors.no} />
              ) : (
                <>
                  <Icon name="x" size={14} color={colors.no} />
                  <Text style={s.rejectBtnText}>Reject</Text>
                </>
              )}
            </Pressable>

            {/* Approve */}
            <Pressable
              style={({ pressed }) => [
                s.approveBtn,
                isProcessing && s.approveBtnDisabled,
                pressed && !isProcessing && { opacity: 0.75 },
              ]}
              onPress={() => onAction(req.id, "approve")}
              disabled={isProcessing}
            >
              {isApproving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="check" size={14} color="#fff" />
                  <Text style={s.approveBtnText}>Approve</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              s.statusChip,
              req.status === "approved" ? s.statusApproved : s.statusRejected,
            ]}
          >
            <Icon
              name={req.status === "approved" ? "check-circle" : "x-circle"}
              size={12}
              color={req.status === "approved" ? colors.yes : colors.no}
            />
            <Text
              style={[
                s.statusChipText,
                req.status === "approved"
                  ? s.statusApprovedText
                  : s.statusRejectedText,
              ]}
            >
              {req.status === "approved" ? "Approved" : "Rejected"}
            </Text>
            {req.reviewedAt ? (
              <Text style={s.reviewedAt}>
                {new Date(req.reviewedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </Text>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 32,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
    badge: {
      backgroundColor: colors.no,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    badgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.muted,
      alignItems: "center",
      justifyContent: "center",
    },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    filterTab: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.muted,
    },
    filterTabActive: { backgroundColor: colors.primary },
    filterTabText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    filterTabTextActive: { color: "#fff" },
    scroll: {
      padding: 16,
      gap: 12,
      paddingBottom: insets.bottom + 40,
    },
    // Error state
    errorTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.foreground,
      textAlign: "center",
    },
    errorSubtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 19,
    },
    retryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 11,
      marginTop: 4,
    },
    retryBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    // Empty state
    empty: { alignItems: "center", paddingTop: 60, gap: 8 },
    emptyTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    emptySubtitle: {
      fontSize: 13,
      color: colors.border,
      textAlign: "center",
    },
    // Card
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 12,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cardLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    avatarCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + "33",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarLetter: { fontSize: 16, fontWeight: "800", color: colors.primary },
    cardMeta: { flex: 1 },
    cardName: { fontSize: 14, fontWeight: "700", color: colors.foreground },
    cardEmail: { fontSize: 12, color: colors.mutedForeground },
    typePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 100,
    },
    typeCompany: {
      backgroundColor: colors.primary + "22",
      borderWidth: 1,
      borderColor: colors.primary + "44",
    },
    typeCeleb: {
      backgroundColor: colors.starBg,
      borderWidth: 1,
      borderColor: colors.star + "44",
    },
    typePillText: { fontSize: 11, fontWeight: "700" },
    typePillTextCompany: { color: colors.primary },
    typePillTextCeleb: { color: colors.star },
    noteBox: {
      backgroundColor: colors.muted,
      borderRadius: 10,
      padding: 10,
    },
    noteText: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
    cardBottom: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    dateText: { fontSize: 12, color: colors.mutedForeground },
    actionRow: { flexDirection: "row", gap: 8 },
    rejectBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.noBg,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.no + "44",
      minWidth: 80,
      justifyContent: "center",
    },
    rejectBtnText: { fontSize: 13, fontWeight: "700", color: colors.no },
    approveBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      minWidth: 90,
      justifyContent: "center",
    },
    approveBtnDisabled: { backgroundColor: colors.primary + "66" },
    actionBtnDisabled: { opacity: 0.5 },
    approveBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 100,
    },
    statusApproved: { backgroundColor: colors.yesBg },
    statusRejected: { backgroundColor: colors.noBg },
    statusChipText: { fontSize: 12, fontWeight: "600" },
    statusApprovedText: { color: colors.yes },
    statusRejectedText: { color: colors.no },
    reviewedAt: { fontSize: 11, color: colors.mutedForeground, marginLeft: 2 },
  });
