import { useAuth, useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TopicCard from "@/components/TopicCard";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";
import type { VotingType } from "@/context/AppContext";

type AccountType = "regular" | "company" | "celebrity";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isSignedIn, isLoaded, signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { topics, userVotes, userId } = useApp();
  const [activeTab, setActiveTab] = useState<"topics" | "analytics">("topics");

  const isPremium = (user?.unsafeMetadata as any)?.isPremium === true;
  const accountType: AccountType = (user?.unsafeMetadata as any)?.accountType ?? "regular";

  const clerkUserId = user?.id ?? userId;

  const myTopics = useMemo(
    () =>
      topics
        .filter((t) => t.createdBy === clerkUserId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [topics, clerkUserId]
  );

  const votedTopics = useMemo(
    () =>
      topics
        .filter((t) => userVotes[t.id] && t.createdBy !== clerkUserId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [topics, userVotes, clerkUserId]
  );

  const totalVotes = Object.keys(userVotes).length;
  const totalReceived = myTopics.reduce(
    (sum, t) => sum + t.yesCount + t.noCount + t.ratingCount,
    0
  );

  // Analytics data for premium
  const analyticsData = useMemo(() => {
    if (!isPremium) return null;
    const byCategory = myTopics.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topTopic = [...myTopics].sort(
      (a, b) =>
        b.yesCount + b.noCount + b.ratingCount - (a.yesCount + a.noCount + a.ratingCount)
    )[0];

    const voteTypeBreakdown = myTopics.reduce(
      (acc, t) => {
        t.votingTypes.forEach((vt: VotingType) => {
          acc[vt] = (acc[vt] ?? 0) + 1;
        });
        return acc;
      },
      {} as Record<string, number>
    );

    const avgEngagement =
      myTopics.length > 0
        ? (
            myTopics.reduce(
              (sum, t) => sum + t.yesCount + t.noCount + t.ratingCount,
              0
            ) / myTopics.length
          ).toFixed(1)
        : "0";

    return { byCategory, topTopic, voteTypeBreakdown, avgEngagement };
  }, [myTopics, isPremium]);

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
      <View style={[s.container, s.center]}>
        <View style={[s.header, { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 }]}>
          <Text style={s.title}>Profile</Text>
        </View>
        <View style={s.signInPrompt}>
          <Feather name="user" size={56} color={colors.border} />
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
          { paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 80 },
        ]}
      >
        {/* Header */}
        <View
          style={[
            s.header,
            { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 },
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
            <Feather name="log-out" size={18} color={colors.mutedForeground} />
          </Pressable>
        </View>

        {/* User info */}
        <View style={s.userCard}>
          <View style={s.avatarContainer}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {(user?.emailAddresses?.[0]?.emailAddress ?? "U")[0].toUpperCase()}
              </Text>
            </View>
            {isPremium && (
              <View style={s.premiumBadgeOnAvatar}>
                <Feather name="check" size={10} color="#fff" />
              </View>
            )}
          </View>
          <View style={s.userInfo}>
            <View style={s.nameRow}>
              <Text style={s.userName} numberOfLines={1}>
                {user?.firstName ?? user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ?? "You"}
              </Text>
              {isPremium && (
                <View style={[s.badge, accountType === "celebrity" ? s.badgeCelebrity : s.badgeCompany]}>
                  <Feather name="check-circle" size={11} color="#fff" />
                  <Text style={s.badgeText}>
                    {accountType === "celebrity" ? "Celebrity" : "Company"}
                  </Text>
                </View>
              )}
            </View>
            <Text style={s.userEmail} numberOfLines={1}>
              {user?.emailAddresses?.[0]?.emailAddress ?? ""}
            </Text>
          </View>
        </View>

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

        {/* Premium upgrade */}
        {!isPremium && (
          <View style={s.premiumCard}>
            <View style={s.premiumHeader}>
              <Feather name="star" size={18} color={colors.star} />
              <Text style={s.premiumTitle}>Go Premium</Text>
            </View>
            <Text style={s.premiumSubtitle}>
              Get a verified badge, promote your topics, and unlock detailed analytics
            </Text>
            <Pressable
              style={({ pressed }) => [s.upgradeBtn, s.upgradeBtnPrimary, pressed && { opacity: 0.8 }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push("/upgrade");
              }}
            >
              <Feather name="star" size={15} color="#fff" />
              <Text style={s.upgradeBtnText}>View Plans & Pricing</Text>
            </Pressable>
          </View>
        )}

        {/* Premium analytics */}
        {isPremium && analyticsData && (
          <View style={s.analyticsCard}>
            <View style={s.analyticsHeader}>
              <Feather name="bar-chart-2" size={16} color={colors.primary} />
              <Text style={s.analyticsTitle}>Analytics</Text>
            </View>

            <View style={s.analyticsGrid}>
              <View style={s.analyticsItem}>
                <Text style={s.analyticsNum}>{analyticsData.avgEngagement}</Text>
                <Text style={s.analyticsLabel}>Avg engagement</Text>
              </View>
              <View style={s.analyticsItem}>
                <Text style={s.analyticsNum}>{myTopics.length}</Text>
                <Text style={s.analyticsLabel}>Topics posted</Text>
              </View>
            </View>

            {analyticsData.topTopic && (
              <View style={s.topTopicBlock}>
                <Text style={s.topTopicLabel}>Top performing topic</Text>
                <Text style={s.topTopicText} numberOfLines={2}>
                  {analyticsData.topTopic.title}
                </Text>
                <Text style={s.topTopicStats}>
                  {(analyticsData.topTopic.yesCount + analyticsData.topTopic.noCount + analyticsData.topTopic.ratingCount).toLocaleString()} total engagements
                </Text>
              </View>
            )}

            <View style={s.voteBreakdown}>
              <Text style={s.voteBreakdownLabel}>Vote types used</Text>
              <View style={s.voteBreakdownRow}>
                {Object.entries(analyticsData.voteTypeBreakdown).map(([vt, count]) => (
                  <View key={vt} style={s.voteBreakdownItem}>
                    <Text style={s.voteBreakdownNum}>{count}</Text>
                    <Text style={s.voteBreakdownType}>
                      {vt === "yesno" ? "Yes/No" : vt === "rating" ? "Rating" : "Ranking"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Topics */}
        {myTopics.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>My Topics</Text>
            {myTopics.map((t) => (
              <TopicCard key={t.id} topic={t} userVoted={!!userVotes[t.id]} />
            ))}
          </View>
        )}

        {votedTopics.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Voted On</Text>
            {votedTopics.map((t) => (
              <TopicCard key={t.id} topic={t} userVoted />
            ))}
          </View>
        )}

        {myTopics.length === 0 && votedTopics.length === 0 && (
          <View style={s.empty}>
            <Feather name="inbox" size={48} color={colors.border} />
            <Text style={s.emptyText}>Nothing here yet</Text>
            <Text style={s.emptySubtext}>Create a topic or vote on something</Text>
          </View>
        )}
      </ScrollView>
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
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
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
    badgeCompany: { backgroundColor: colors.primary },
    badgeCelebrity: { backgroundColor: colors.star },
    badgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
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
    premiumSubtitle: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
    upgradeBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: 12,
    },
    upgradeBtnPrimary: { backgroundColor: colors.primary },
    upgradeBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
    analyticsCard: {
      margin: 16,
      marginTop: 0,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.primary + "44",
      gap: 14,
    },
    analyticsHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    analyticsTitle: { fontSize: 15, fontWeight: "700", color: colors.foreground },
    analyticsGrid: { flexDirection: "row", gap: 10 },
    analyticsItem: {
      flex: 1,
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: 12,
      alignItems: "center",
      gap: 4,
    },
    analyticsNum: { fontSize: 22, fontWeight: "800", color: colors.primary },
    analyticsLabel: { fontSize: 11, color: colors.mutedForeground, textAlign: "center" },
    topTopicBlock: {
      backgroundColor: colors.muted,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    topTopicLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    topTopicText: { fontSize: 14, fontWeight: "600", color: colors.foreground },
    topTopicStats: { fontSize: 12, color: colors.mutedForeground },
    voteBreakdown: { gap: 8 },
    voteBreakdownLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    voteBreakdownRow: { flexDirection: "row", gap: 8 },
    voteBreakdownItem: {
      flex: 1,
      backgroundColor: colors.muted,
      borderRadius: 10,
      padding: 10,
      alignItems: "center",
      gap: 2,
    },
    voteBreakdownNum: { fontSize: 18, fontWeight: "800", color: colors.accent },
    voteBreakdownType: { fontSize: 10, color: colors.mutedForeground, textAlign: "center" },
    section: { paddingHorizontal: 16, marginBottom: 8 },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 10,
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
    signInBtnText: { fontSize: 16, fontWeight: "700", color: colors.primaryForeground },
    signUpBtn: {
      width: "100%",
      backgroundColor: colors.muted,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    signUpBtnText: { fontSize: 16, fontWeight: "600", color: colors.foreground },
    empty: { alignItems: "center", paddingTop: 40, gap: 8, paddingHorizontal: 16 },
    emptyText: { fontSize: 18, fontWeight: "700", color: colors.mutedForeground },
    emptySubtext: { fontSize: 14, color: colors.mutedForeground, textAlign: "center" },
  });
