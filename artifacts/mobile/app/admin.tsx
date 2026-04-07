import { useAuth } from "@clerk/expo";
import { Icon } from "@/components/Icon";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

type VerificationRequest = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  requestedAccountType: "company" | "celebrity";
  status: "pending" | "approved" | "rejected";
  note: string | null;
  requestedAt: string;
  reviewedAt: string | null;
};

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();

  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/admin/verify-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 403) {
          Alert.alert("Access Denied", "You don't have admin privileges.");
          router.back();
          return;
        }
        throw new Error("Failed to load");
      }
      const data = await res.json();
      setRequests(data.requests ?? []);
    } catch (err: any) {
      Alert.alert("Error", "Could not load requests.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleAction(id: string, action: "approve" | "reject") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessing(id);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/admin/verify-requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed");
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: action === "approve" ? "approved" : "rejected", reviewedAt: new Date().toISOString() }
            : r
        )
      );
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not process request.");
    } finally {
      setProcessing(null);
    }
  }

  const filtered = requests.filter((r) => filter === "all" || r.status === filter);
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  const s = styles(colors, insets);

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 }]}>
        <Pressable
          style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }]}
          onPress={() => router.back()}
        >
          <Icon name="x" size={20} color={colors.mutedForeground} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Admin Panel</Text>
          {pendingCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
        <Pressable
          style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }]}
          onPress={() => { setRefreshing(true); fetchRequests(); }}
        >
          <Icon name="refresh-cw" size={18} color={colors.mutedForeground} />
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
            <Text style={[s.filterTabText, filter === f && s.filterTabTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchRequests(); }}
              tintColor={colors.primary}
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Icon name="inbox" size={40} color={colors.border} />
              <Text style={s.emptyText}>No {filter === "all" ? "" : filter} requests</Text>
            </View>
          ) : (
            filtered.map((req) => (
              <View key={req.id} style={s.card}>
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
                      <Text style={s.cardEmail} numberOfLines={1}>{req.userEmail}</Text>
                    </View>
                  </View>
                  <View style={[
                    s.typePill,
                    req.requestedAccountType === "celebrity" ? s.typeCeleb : s.typeCompany,
                  ]}>
                    <Icon
                      name={req.requestedAccountType === "celebrity" ? "star" : "briefcase"}
                      size={11}
                      color={req.requestedAccountType === "celebrity" ? colors.star : colors.primary}
                    />
                    <Text style={[
                      s.typePillText,
                      req.requestedAccountType === "celebrity" ? s.typePillTextCeleb : s.typePillTextCompany,
                    ]}>
                      {req.requestedAccountType === "celebrity" ? "Celebrity" : "Company"}
                    </Text>
                  </View>
                </View>

                {req.note ? (
                  <View style={s.noteBox}>
                    <Text style={s.noteText} numberOfLines={3}>{req.note}</Text>
                  </View>
                ) : null}

                <View style={s.cardBottom}>
                  <Text style={s.dateText}>
                    {new Date(req.requestedAt).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </Text>

                  {req.status === "pending" ? (
                    <View style={s.actionRow}>
                      <Pressable
                        style={({ pressed }) => [s.rejectBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => handleAction(req.id, "reject")}
                        disabled={processing === req.id}
                      >
                        {processing === req.id ? (
                          <ActivityIndicator size="small" color={colors.no} />
                        ) : (
                          <>
                            <Icon name="x" size={14} color={colors.no} />
                            <Text style={s.rejectBtnText}>Reject</Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [s.approveBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => handleAction(req.id, "approve")}
                        disabled={processing === req.id}
                      >
                        {processing === req.id ? (
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
                    <View style={[
                      s.statusChip,
                      req.status === "approved" ? s.statusApproved : s.statusRejected,
                    ]}>
                      <Icon
                        name={req.status === "approved" ? "check-circle" : "x-circle"}
                        size={12}
                        color={req.status === "approved" ? colors.yes : colors.no}
                      />
                      <Text style={[
                        s.statusChipText,
                        req.status === "approved" ? s.statusApprovedText : s.statusRejectedText,
                      ]}>
                        {req.status === "approved" ? "Approved" : "Rejected"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
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
    headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
    headerTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
    badge: {
      backgroundColor: colors.no, borderRadius: 10,
      paddingHorizontal: 7, paddingVertical: 2,
    },
    badgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },
    iconBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.muted, alignItems: "center", justifyContent: "center",
    },
    filterRow: {
      flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    filterTab: {
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: 20, backgroundColor: colors.muted,
    },
    filterTabActive: { backgroundColor: colors.primary },
    filterTabText: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground },
    filterTabTextActive: { color: "#fff" },
    scroll: { padding: 16, gap: 12, paddingBottom: insets.bottom + 40 },
    empty: { alignItems: "center", paddingTop: 60, gap: 10 },
    emptyText: { fontSize: 16, fontWeight: "600", color: colors.mutedForeground },
    card: {
      backgroundColor: colors.card, borderRadius: 16,
      borderWidth: 1, borderColor: colors.border,
      padding: 16, gap: 12,
    },
    cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    avatarCircle: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.primary + "33",
      alignItems: "center", justifyContent: "center",
    },
    avatarLetter: { fontSize: 16, fontWeight: "800", color: colors.primary },
    cardMeta: { flex: 1 },
    cardName: { fontSize: 14, fontWeight: "700", color: colors.foreground },
    cardEmail: { fontSize: 12, color: colors.mutedForeground },
    typePill: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100,
    },
    typeCompany: { backgroundColor: colors.primary + "22", borderWidth: 1, borderColor: colors.primary + "44" },
    typeCeleb: { backgroundColor: colors.starBg, borderWidth: 1, borderColor: colors.star + "44" },
    typePillText: { fontSize: 11, fontWeight: "700" },
    typePillTextCompany: { color: colors.primary },
    typePillTextCeleb: { color: colors.star },
    noteBox: {
      backgroundColor: colors.muted, borderRadius: 10, padding: 10,
    },
    noteText: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
    cardBottom: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    },
    dateText: { fontSize: 12, color: colors.mutedForeground },
    actionRow: { flexDirection: "row", gap: 8 },
    rejectBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: colors.noBg, paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 10, borderWidth: 1, borderColor: colors.no + "44",
    },
    rejectBtnText: { fontSize: 13, fontWeight: "700", color: colors.no },
    approveBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 10,
    },
    approveBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    statusChip: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    },
    statusApproved: { backgroundColor: colors.yesBg },
    statusRejected: { backgroundColor: colors.noBg },
    statusChipText: { fontSize: 12, fontWeight: "600" },
    statusApprovedText: { color: colors.yes },
    statusRejectedText: { color: colors.no },
  });
