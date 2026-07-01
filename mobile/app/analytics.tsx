import { useUser } from "@clerk/expo";
import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp, type VotingType } from "@/context/AppContext";
import { VOICE_CONFIG } from "@/constants/voiceTypes";
import { useColors } from "@/hooks/useColors";

const VOTE_TYPE_LABELS: Record<VotingType, string> = {
  yesno: "Yes / No",
  rating: "Rating",
  ranking: "Ranking",
  aspects: "Aspects",
};

const DEMO_COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

function topicEngagement(t: { yesCount: number; noCount: number; ratingCount: number; aspectVotes?: Record<string, { up: number; down: number }>; rankingVotes: Record<string, number[]> }) {
  const base = t.yesCount + t.noCount + t.ratingCount;
  const aspects = t.aspectVotes ? Object.values(t.aspectVotes).reduce((s, v) => s + v.up + v.down, 0) : 0;
  const ranking = Object.values(t.rankingVotes ?? {}).reduce((s, arr) => s + arr.length, 0);
  return base + aspects + ranking;
}

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { topics, followedAccounts } = useApp();

  const isPremium = (user?.unsafeMetadata as any)?.isPremium === true;
  const voiceType = (user?.unsafeMetadata as any)?.voiceType as string | undefined;
  const voiceCfg = voiceType ? VOICE_CONFIG[voiceType as keyof typeof VOICE_CONFIG] : null;
  const clerkUserId = user?.id ?? "";

  const myTopics = useMemo(
    () => topics.filter((t) => t.createdBy === clerkUserId).sort((a, b) => b.createdAt - a.createdAt),
    [topics, clerkUserId]
  );

  const stats = useMemo(() => {
    const totalEngagement = myTopics.reduce((s, t) => s + topicEngagement(t), 0);
    const avgEngagement = myTopics.length > 0 ? (totalEngagement / myTopics.length) : 0;
    const totalComments = myTopics.reduce((s, t) => s + (t.comments?.length ?? 0), 0);

    const byType: Record<VotingType, { count: number; totalEng: number }> = {
      yesno: { count: 0, totalEng: 0 },
      rating: { count: 0, totalEng: 0 },
      ranking: { count: 0, totalEng: 0 },
      aspects: { count: 0, totalEng: 0 },
    };
    myTopics.forEach((t) => {
      byType[t.votingType].count++;
      byType[t.votingType].totalEng += topicEngagement(t);
    });

    const topTopics = [...myTopics].sort((a, b) => topicEngagement(b) - topicEngagement(a)).slice(0, 5);

    // Aggregate demographics across all posts
    const ageTotals: Record<string, number> = {};
    const genderTotals: Record<string, number> = {};
    const occupationTotals: Record<string, number> = {};
    myTopics.forEach((t) => {
      const db = t.demoBreakdown ?? {};
      Object.entries(db.ageRange ?? {}).forEach(([k, v]) => { ageTotals[k] = (ageTotals[k] ?? 0) + v; });
      Object.entries(db.gender ?? {}).forEach(([k, v]) => { genderTotals[k] = (genderTotals[k] ?? 0) + v; });
      Object.entries(db.occupation ?? {}).forEach(([k, v]) => { occupationTotals[k] = (occupationTotals[k] ?? 0) + v; });
    });

    return {
      totalEngagement,
      avgEngagement: avgEngagement.toFixed(1),
      totalComments,
      topTopics,
      byType,
      ageTotals,
      genderTotals,
      occupationTotals,
    };
  }, [myTopics]);

  const s = styles(colors, insets);

  if (!isPremium) {
    return (
      <View style={s.container}>
        <View style={[s.header, { paddingTop: Platform.OS === "web" ? 16 : insets.top + 4 }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Icon name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={s.headerTitle}>Analytics</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={s.gateContainer}>
          <Icon name="bar-chart-2" size={52} color={colors.border} />
          <Text style={s.gateTitle}>Analytics unlocked with a Voice</Text>
          <Text style={s.gateSub}>Apply for verification as an Expert, Brand, Public Figure, or Creator to access your post analytics.</Text>
          <Pressable style={s.gateBtn} onPress={() => router.push("/verify-request")}>
            <Text style={s.gateBtnText}>Apply for a Voice</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 16 : insets.top + 4 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Icon name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={s.headerTitle}>Analytics</Text>
        {voiceCfg && (
          <View style={[s.voicePill, { backgroundColor: voiceCfg.color + "22", borderColor: voiceCfg.color + "55" }]}>
            <Icon name={voiceCfg.icon} size={11} color={voiceCfg.color} />
            <Text style={[s.voicePillText, { color: voiceCfg.color }]}>{voiceCfg.label}</Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: Platform.OS === "web" ? 40 : insets.bottom + 32 }]}
      >
        {/* Overview cards */}
        <Text style={s.sectionLabel}>Overview</Text>
        <View style={s.overviewGrid}>
          <StatCard label="Posts" value={myTopics.length.toString()} icon="edit" color={colors.primary} colors={colors} />
          <StatCard label="Total Votes" value={stats.totalEngagement.toLocaleString()} icon="thumbs-up" color="#10b981" colors={colors} />
          <StatCard label="Avg / Post" value={stats.avgEngagement} icon="bar-chart-2" color="#f59e0b" colors={colors} />
          <StatCard label="Comments" value={stats.totalComments.toString()} icon="message-circle" color="#8b5cf6" colors={colors} />
        </View>

        {/* Poll type breakdown */}
        <Text style={s.sectionLabel}>Engagement by Poll Type</Text>
        <View style={s.card}>
          {(Object.entries(stats.byType) as [VotingType, { count: number; totalEng: number }][])
            .filter(([, v]) => v.count > 0)
            .sort(([, a], [, b]) => b.totalEng - a.totalEng)
            .map(([type, { count, totalEng }]) => {
              const maxEng = Math.max(...Object.values(stats.byType).map((v) => v.totalEng), 1);
              const pct = totalEng / maxEng;
              return (
                <View key={type} style={s.barRow}>
                  <Text style={s.barLabel}>{VOTE_TYPE_LABELS[type]}</Text>
                  <View style={s.barTrack}>
                    <View style={[s.barFill, { width: `${pct * 100}%` as any, backgroundColor: colors.primary }]} />
                  </View>
                  <Text style={s.barMeta}>{count} post{count !== 1 ? "s" : ""} · {totalEng.toLocaleString()} votes</Text>
                </View>
              );
            })}
          {Object.values(stats.byType).every((v) => v.count === 0) && (
            <Text style={s.emptyNote}>No posts yet</Text>
          )}
        </View>

        {/* Top posts */}
        {stats.topTopics.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Top Posts</Text>
            <View style={s.card}>
              {stats.topTopics.map((t, i) => {
                const eng = topicEngagement(t);
                const maxEng = topicEngagement(stats.topTopics[0]);
                const pct = maxEng > 0 ? eng / maxEng : 0;

                let detail = "";
                if (t.votingType === "yesno") {
                  const total = t.yesCount + t.noCount;
                  const yes = total > 0 ? Math.round((t.yesCount / total) * 100) : 0;
                  detail = `${yes}% Yes`;
                } else if (t.votingType === "rating" && t.ratingCount > 0) {
                  detail = `★ ${(t.totalRating / t.ratingCount).toFixed(1)}`;
                } else if (t.votingType === "aspects" && t.aspectVotes) {
                  const best = Object.entries(t.aspectVotes)
                    .sort(([, a], [, b]) => (b.up / Math.max(b.up + b.down, 1)) - (a.up / Math.max(a.up + a.down, 1)))[0];
                  if (best) detail = `Top: ${best[0]}`;
                } else if (t.votingType === "ranking" && t.rankingOptions?.length) {
                  detail = `#1: ${t.rankingOptions[0].label}`;
                }

                return (
                  <View key={t.id} style={[s.topPostRow, i > 0 && s.topPostRowBorder]}>
                    <Text style={s.topPostRank}>#{i + 1}</Text>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={s.topPostTitle} numberOfLines={1}>{t.title}</Text>
                      <View style={s.topPostBarTrack}>
                        <View style={[s.topPostBarFill, { width: `${pct * 100}%` as any }]} />
                      </View>
                      <View style={s.topPostMeta}>
                        <Text style={s.topPostEng}>{eng.toLocaleString()} votes</Text>
                        {!!detail && <Text style={s.topPostDetail}>{detail}</Text>}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Demographics */}
        {Object.keys(stats.ageTotals).length > 0 && (
          <>
            <Text style={s.sectionLabel}>Audience — Age Range</Text>
            <DemoBar data={stats.ageTotals} colors={colors} />
          </>
        )}
        {Object.keys(stats.genderTotals).length > 0 && (
          <>
            <Text style={s.sectionLabel}>Audience — Gender</Text>
            <DemoBar data={stats.genderTotals} colors={colors} />
          </>
        )}
        {Object.keys(stats.occupationTotals).length > 0 && (
          <>
            <Text style={s.sectionLabel}>Audience — Occupation</Text>
            <DemoBar data={stats.occupationTotals} colors={colors} />
          </>
        )}

        {myTopics.length === 0 && (
          <View style={s.emptyState}>
            <Icon name="bar-chart-2" size={44} color={colors.border} />
            <Text style={s.emptyStateTitle}>No data yet</Text>
            <Text style={s.emptyStateSub}>Create your first post to start seeing analytics</Text>
            <Pressable style={s.gateBtn} onPress={() => router.push("/create")}>
              <Text style={s.gateBtnText}>Create a post</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon, color, colors }: { label: string; value: string; icon: string; color: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[statCardStyles(colors).card, { borderColor: color + "33" }]}>
      <Icon name={icon} size={16} color={color} />
      <Text style={[statCardStyles(colors).value, { color }]}>{value}</Text>
      <Text style={statCardStyles(colors).label}>{label}</Text>
    </View>
  );
}

function statCardStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    card: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
    },
    value: { fontSize: 24, fontWeight: "800" },
    label: { fontSize: 11, color: colors.mutedForeground, textAlign: "center" },
  });
}

function DemoBar({ data, colors }: { data: Record<string, number>; colors: ReturnType<typeof useColors> }) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  const sorted = Object.entries(data).sort(([, a], [, b]) => b - a);
  return (
    <View style={[demoStyles(colors).card]}>
      {sorted.map(([key, val], i) => {
        const pct = total > 0 ? val / total : 0;
        return (
          <View key={key} style={demoStyles(colors).row}>
            <Text style={demoStyles(colors).key}>{key}</Text>
            <View style={demoStyles(colors).track}>
              <View style={[demoStyles(colors).fill, { width: `${pct * 100}%` as any, backgroundColor: DEMO_COLORS[i % DEMO_COLORS.length] }]} />
            </View>
            <Text style={demoStyles(colors).pct}>{Math.round(pct * 100)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

function demoStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginHorizontal: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    key: { fontSize: 12, color: colors.foreground, fontWeight: "500", width: 72 },
    track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.muted, overflow: "hidden" },
    fill: { height: "100%", borderRadius: 4 },
    pct: { fontSize: 12, color: colors.mutedForeground, width: 36, textAlign: "right" },
  });
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
    headerTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground },
    voicePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 100,
      borderWidth: 1,
    },
    voicePillText: { fontSize: 10, fontWeight: "700" },
    scroll: { paddingTop: 16, gap: 4 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 16,
      marginBottom: 8,
      marginTop: 12,
    },
    overviewGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      gap: 10,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginHorizontal: 16,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },
    barRow: { gap: 4 },
    barLabel: { fontSize: 13, fontWeight: "600", color: colors.foreground },
    barTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.muted,
      overflow: "hidden",
    },
    barFill: { height: "100%", borderRadius: 3 },
    barMeta: { fontSize: 11, color: colors.mutedForeground },
    emptyNote: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", paddingVertical: 8 },
    topPostRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    topPostRowBorder: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
    topPostRank: { fontSize: 13, fontWeight: "800", color: colors.primary, width: 22, marginTop: 2 },
    topPostTitle: { fontSize: 13, fontWeight: "600", color: colors.foreground },
    topPostBarTrack: { height: 4, borderRadius: 2, backgroundColor: colors.muted, overflow: "hidden" },
    topPostBarFill: { height: "100%", borderRadius: 2, backgroundColor: colors.primary + "88" },
    topPostMeta: { flexDirection: "row", gap: 10 },
    topPostEng: { fontSize: 11, color: colors.mutedForeground },
    topPostDetail: { fontSize: 11, color: colors.primary, fontWeight: "600" },
    gateContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      gap: 12,
    },
    gateTitle: { fontSize: 18, fontWeight: "800", color: colors.foreground, textAlign: "center" },
    gateSub: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 19 },
    gateBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 8,
    },
    gateBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    emptyState: { alignItems: "center", paddingHorizontal: 32, paddingTop: 40, gap: 10 },
    emptyStateTitle: { fontSize: 17, fontWeight: "700", color: colors.foreground },
    emptyStateSub: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", lineHeight: 19 },
  });
