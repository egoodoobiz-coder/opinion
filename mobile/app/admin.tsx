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
import ThemedInput from "@/components/ThemedInput";
import { useColors } from "@/hooks/useColors";
import { VOICE_CONFIG } from "@/constants/voiceTypes";

type RequestStatus = "pending" | "approved" | "rejected";
type Tab = "requests" | "admins";

interface VerifyReq {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  requestedVoiceType: string;
  status: RequestStatus;
  note: string | null;
  requestedAt: string | null;
  reviewedAt: string | null;
}

interface AdminRow {
  userId: string;
  userEmail: string | null;
  grantedAt: string | null;
}

export default function AdminScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getToken } = useAuth();

  const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

  const [tab, setTab] = useState<Tab>("requests");
  const [requests, setRequests] = useState<VerifyReq[]>([]);
  const [adminList, setAdminList] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [grantEmail, setGrantEmail] = useState("");
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const authHeaders = useCallback(async () => {
    const token = await getToken();
    return { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` };
  }, [getToken]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const h = await authHeaders();
      const [reqRes, admRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/verify-requests`, { headers: h }),
        fetch(`${API_URL}/api/admin/admins`, { headers: h }),
      ]);
      if (reqRes.status === 403) {
        Alert.alert("Access Denied", "You don't have admin privileges.", [{ text: "Go Back", onPress: () => router.back() }]);
        return;
      }
      if (reqRes.ok) { const d = await reqRes.json(); setRequests(d.requests ?? []); }
      if (admRes.ok) { const d = await admRes.json(); setAdminList(d.admins ?? []); }
    } catch {
      Alert.alert("Error", "Could not load data. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_URL, authHeaders]);

  useEffect(() => { load(); }, [load]);

  function confirmAction(id: string, action: "approve" | "reject") {
    const req = requests.find((r) => r.id === id);
    if (!req) return;
    const name = req.userName || req.userEmail.split("@")[0];
    const cfg = VOICE_CONFIG[req.requestedVoiceType as keyof typeof VOICE_CONFIG];
    const typeLabel = cfg?.label ?? req.requestedVoiceType;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      `${action === "approve" ? "Approve" : "Reject"} request?`,
      `${action === "approve" ? "Approve" : "Reject"} ${typeLabel} voice for ${name}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: action === "approve" ? "Approve" : "Reject", style: action === "reject" ? "destructive" : "default", onPress: () => handleAction(id, action) },
      ]
    );
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    setActionId(id);
    try {
      const h = await authHeaders();
      const res = await fetch(`${API_URL}/api/admin/verify-requests/${id}`, {
        method: "PATCH", headers: h, body: JSON.stringify({ action }),
      });
      let data: any = {}; try { data = await res.json(); } catch {}
      if (!res.ok) throw new Error(data.error ?? "Failed");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setRequests((prev) => prev.map((r) => r.id === id ? { ...r, status: action === "approve" ? "approved" : "rejected", reviewedAt: new Date().toISOString() } : r));
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Could not process request.");
    } finally {
      setActionId(null);
    }
  }

  async function handleGrant() {
    const email = grantEmail.trim();
    if (!email) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGranting(true);
    try {
      const h = await authHeaders();
      const res = await fetch(`${API_URL}/api/admin/grant`, { method: "POST", headers: h, body: JSON.stringify({ userEmail: email }) });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setGrantEmail("");
        load(true);
        Alert.alert("Done", `Admin access granted to ${email}`);
      } else {
        Alert.alert("Error", d.error ?? "Failed to grant access");
      }
    } catch {
      Alert.alert("Error", "Network error");
    } finally {
      setGranting(false);
    }
  }

  function confirmRevoke(targetId: string, email: string | null) {
    Alert.alert(
      "Revoke Admin",
      `Remove admin access from ${email ?? targetId}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Revoke", style: "destructive", onPress: () => doRevoke(targetId) },
      ]
    );
  }

  async function doRevoke(targetId: string) {
    setRevoking(targetId);
    try {
      const h = await authHeaders();
      const res = await fetch(`${API_URL}/api/admin/revoke/${targetId}`, { method: "DELETE", headers: h });
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAdminList((prev) => prev.filter((a) => a.userId !== targetId));
      } else {
        const d = await res.json().catch(() => ({}));
        Alert.alert("Error", d.error ?? "Failed");
      }
    } catch {
      Alert.alert("Error", "Network error");
    } finally {
      setRevoking(null);
    }
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const displayed = filter === "pending" ? requests.filter((r) => r.status === "pending") : requests;

  const s = styles(colors, insets);

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 8 }]}>
        <Pressable style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }]} onPress={() => router.back()}>
          <Icon name="arrow-left" size={20} color={colors.mutedForeground} />
        </Pressable>
        <View style={s.headerCenter}>
          <Icon name="shield" size={16} color={colors.primary} />
          <Text style={s.headerTitle}>Admin Panel</Text>
          {pendingCount > 0 && <View style={s.pendingBadge}><Text style={s.pendingBadgeText}>{pendingCount}</Text></View>}
        </View>
        <Pressable style={({ pressed }) => [s.iconBtn, pressed && { opacity: 0.6 }]} onPress={() => { setRefreshing(true); load(true); }}>
          {refreshing ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="refresh-cw" size={18} color={colors.mutedForeground} />}
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <Pressable style={[s.tab, tab === "requests" && s.tabActive]} onPress={() => setTab("requests")}>
          <Text style={[s.tabText, tab === "requests" && s.tabTextActive]}>
            Requests{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Text>
        </Pressable>
        <Pressable style={[s.tab, tab === "admins" && s.tabActive]} onPress={() => setTab("admins")}>
          <Text style={[s.tabText, tab === "admins" && s.tabTextActive]}>
            Admins ({adminList.length})
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
        >
          {/* ── REQUESTS TAB ── */}
          {tab === "requests" && (
            <>
              {/* Filter */}
              <View style={s.filterRow}>
                {(["pending", "all"] as const).map((f) => (
                  <Pressable key={f} style={[s.filterChip, filter === f && s.filterChipActive]} onPress={() => setFilter(f)}>
                    <Text style={[s.filterChipText, filter === f && s.filterChipTextActive]}>
                      {f === "pending" ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}` : "All"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {displayed.length === 0 ? (
                <View style={s.empty}>
                  <Icon name="inbox" size={40} color={colors.border} />
                  <Text style={s.emptyText}>{filter === "pending" ? "No pending requests" : "No requests yet"}</Text>
                </View>
              ) : (
                displayed.map((req) => (
                  <RequestCard key={req.id} req={req} actionId={actionId} onAction={confirmAction} colors={colors} s={s} />
                ))
              )}
            </>
          )}

          {/* ── ADMINS TAB ── */}
          {tab === "admins" && (
            <>
              {/* Grant new admin */}
              <View style={s.grantCard}>
                <View style={s.grantTitleRow}>
                  <Icon name="user-plus" size={16} color={colors.primary} />
                  <Text style={s.grantTitle}>Grant Admin Access</Text>
                </View>
                <Text style={s.grantSub}>Enter the email of a user who has signed in at least once.</Text>
                <View style={s.grantRow}>
                  <ThemedInput
                    style={s.grantInput}
                    value={grantEmail}
                    onChangeText={setGrantEmail}
                    placeholder="user@email.com"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    returnKeyType="done"
                    onSubmitEditing={handleGrant}
                  />
                  <Pressable
                    style={({ pressed }) => [s.grantBtn, (!grantEmail.trim() || granting) && s.grantBtnDisabled, pressed && !!grantEmail.trim() && { opacity: 0.8 }]}
                    onPress={handleGrant}
                    disabled={!grantEmail.trim() || granting}
                  >
                    {granting ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="check" size={18} color="#fff" />}
                  </Pressable>
                </View>
              </View>

              <Text style={s.sectionLabel}>Current Admins</Text>
              {adminList.length === 0 ? (
                <View style={s.empty}><Text style={s.emptyText}>No admins yet</Text></View>
              ) : (
                adminList.map((a) => (
                  <View key={a.userId} style={s.adminRow}>
                    <View style={s.adminAvatar}>
                      <Text style={s.adminAvatarText}>{(a.userEmail?.[0] ?? "?").toUpperCase()}</Text>
                    </View>
                    <View style={s.adminInfo}>
                      <Text style={s.adminEmail} numberOfLines={1}>{a.userEmail ?? a.userId}</Text>
                      {a.grantedAt && <Text style={s.adminDate}>Admin since {new Date(a.grantedAt).toLocaleDateString()}</Text>}
                    </View>
                    <Pressable
                      style={({ pressed }) => [s.revokeBtn, pressed && { opacity: 0.7 }]}
                      onPress={() => confirmRevoke(a.userId, a.userEmail)}
                      disabled={revoking === a.userId}
                    >
                      {revoking === a.userId
                        ? <ActivityIndicator size="small" color={colors.no} />
                        : <Icon name="user-x" size={16} color={colors.no} />}
                    </Pressable>
                  </View>
                ))
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function RequestCard({ req, actionId, onAction, colors, s }: {
  req: VerifyReq;
  actionId: string | null;
  onAction: (id: string, action: "approve" | "reject") => void;
  colors: any;
  s: any;
}) {
  const cfg = VOICE_CONFIG[req.requestedVoiceType as keyof typeof VOICE_CONFIG];
  const isProcessing = actionId === req.id;

  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.cardLeft}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarLetter}>{(req.userName?.[0] ?? req.userEmail[0]).toUpperCase()}</Text>
          </View>
          <View style={s.cardMeta}>
            <Text style={s.cardName} numberOfLines={1}>{req.userName || req.userEmail.split("@")[0]}</Text>
            <Text style={s.cardEmail} numberOfLines={1}>{req.userEmail}</Text>
          </View>
        </View>

        {cfg ? (
          <View style={[s.voicePill, { backgroundColor: cfg.color + "22", borderColor: cfg.color + "55" }]}>
            <Icon name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[s.voicePillText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        ) : (
          <View style={s.voicePill}>
            <Text style={s.voicePillText}>{req.requestedVoiceType}</Text>
          </View>
        )}
      </View>

      {req.note ? (
        <View style={s.noteBox}><Text style={s.noteText} numberOfLines={3}>{req.note}</Text></View>
      ) : null}

      <View style={s.cardBottom}>
        <Text style={s.dateText}>
          {req.requestedAt ? new Date(req.requestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
        </Text>

        {req.status === "pending" ? (
          <View style={s.actionRow}>
            <Pressable
              style={({ pressed }) => [s.rejectBtn, isProcessing && { opacity: 0.5 }, pressed && !isProcessing && { opacity: 0.75 }]}
              onPress={() => onAction(req.id, "reject")}
              disabled={isProcessing}
            >
              {isProcessing ? <ActivityIndicator size="small" color={colors.no} /> : <><Icon name="x" size={14} color={colors.no} /><Text style={s.rejectBtnText}>Reject</Text></>}
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.approveBtn, isProcessing && { opacity: 0.6 }, pressed && !isProcessing && { opacity: 0.75 }]}
              onPress={() => onAction(req.id, "approve")}
              disabled={isProcessing}
            >
              {isProcessing ? <ActivityIndicator size="small" color="#fff" /> : <><Icon name="check" size={14} color="#fff" /><Text style={s.approveBtnText}>Approve</Text></>}
            </Pressable>
          </View>
        ) : (
          <View style={[s.statusChip, req.status === "approved" ? s.statusApproved : s.statusRejected]}>
            <Icon name={req.status === "approved" ? "check-circle" : "x-circle"} size={12} color={req.status === "approved" ? colors.yes : colors.no} />
            <Text style={[s.statusChipText, req.status === "approved" ? s.statusApprovedText : s.statusRejectedText]}>
              {req.status === "approved" ? "Approved" : "Rejected"}
            </Text>
            {req.reviewedAt ? <Text style={s.reviewedAt}>{new Date(req.reviewedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</Text> : null}
          </View>
        )}
      </View>
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
    pendingBadge: { backgroundColor: colors.no, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
    pendingBadgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },
    iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" },
    tabs: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
    tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
    tabText: { fontSize: 14, fontWeight: "600", color: colors.mutedForeground },
    tabTextActive: { color: colors.primary },
    scroll: { padding: 16, gap: 12, paddingBottom: insets.bottom + 40 },
    filterRow: { flexDirection: "row", gap: 8 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.muted },
    filterChipActive: { backgroundColor: colors.primary },
    filterChipText: { fontSize: 12, fontWeight: "600", color: colors.mutedForeground },
    filterChipTextActive: { color: "#fff" },
    empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
    emptyText: { fontSize: 14, color: colors.mutedForeground },
    sectionLabel: { fontSize: 11, fontWeight: "700", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8 },
    // Grant card
    grantCard: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.primary + "44", padding: 14, gap: 8 },
    grantTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    grantTitle: { fontSize: 14, fontWeight: "700", color: colors.foreground },
    grantSub: { fontSize: 12, color: colors.mutedForeground },
    grantRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    grantInput: {
      flex: 1, backgroundColor: colors.muted,
      borderRadius: 10, borderWidth: 1, borderColor: colors.border,
      paddingHorizontal: 12, paddingVertical: Platform.OS === "web" ? 10 : 11,
      fontSize: 14, color: colors.foreground,
    },
    grantBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
    grantBtnDisabled: { backgroundColor: colors.muted },
    // Admin rows
    adminRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12 },
    adminAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + "33", alignItems: "center", justifyContent: "center" },
    adminAvatarText: { fontSize: 16, fontWeight: "800", color: colors.primary },
    adminInfo: { flex: 1 },
    adminEmail: { fontSize: 13, fontWeight: "600", color: colors.foreground },
    adminDate: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
    revokeBtn: { padding: 8 },
    // Request cards
    card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12 },
    cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + "33", alignItems: "center", justifyContent: "center" },
    avatarLetter: { fontSize: 16, fontWeight: "800", color: colors.primary },
    cardMeta: { flex: 1 },
    cardName: { fontSize: 14, fontWeight: "700", color: colors.foreground },
    cardEmail: { fontSize: 12, color: colors.mutedForeground },
    voicePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.muted },
    voicePillText: { fontSize: 11, fontWeight: "700", color: colors.mutedForeground },
    noteBox: { backgroundColor: colors.muted, borderRadius: 10, padding: 10 },
    noteText: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
    cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    dateText: { fontSize: 12, color: colors.mutedForeground },
    actionRow: { flexDirection: "row", gap: 8 },
    rejectBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.noBg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.no + "44", minWidth: 80, justifyContent: "center" },
    rejectBtnText: { fontSize: 13, fontWeight: "700", color: colors.no },
    approveBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, minWidth: 90, justifyContent: "center" },
    approveBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    statusChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
    statusApproved: { backgroundColor: colors.yesBg },
    statusRejected: { backgroundColor: colors.noBg },
    statusChipText: { fontSize: 12, fontWeight: "600" },
    statusApprovedText: { color: colors.yes },
    statusRejectedText: { color: colors.no },
    reviewedAt: { fontSize: 11, color: colors.mutedForeground, marginLeft: 2 },
  });
