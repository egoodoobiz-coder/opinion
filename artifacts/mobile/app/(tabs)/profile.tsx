import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TopicCard from "@/components/TopicCard";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { topics, userVotes, userId } = useApp();

  const myTopics = useMemo(
    () =>
      topics
        .filter((t) => t.createdBy === userId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [topics, userId]
  );

  const votedTopics = useMemo(
    () =>
      topics
        .filter((t) => userVotes[t.id] && t.createdBy !== userId)
        .sort((a, b) => b.createdAt - a.createdAt),
    [topics, userVotes, userId]
  );

  const totalVotes = Object.keys(userVotes).length;
  const s = styles(colors, insets);

  return (
    <View style={s.container}>
      <View
        style={[
          s.header,
          { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 },
        ]}
      >
        <Text style={s.title}>Profile</Text>
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
            <Text style={s.statNum}>
              {myTopics.reduce(
                (sum, t) => sum + t.yesCount + t.noCount + t.ratingCount,
                0
              )}
            </Text>
            <Text style={s.statLabel}>Received</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={[...myTopics, ...votedTopics]}
        keyExtractor={(t) => t.id}
        contentContainerStyle={[
          s.list,
          { paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 80 },
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {myTopics.length > 0 && (
              <Text style={s.sectionTitle}>My Topics</Text>
            )}
          </>
        }
        renderItem={({ item, index }) => {
          const isVotedSection =
            myTopics.length > 0 && index === myTopics.length;
          return (
            <>
              {isVotedSection && votedTopics.length > 0 && (
                <Text style={[s.sectionTitle, { marginTop: 16 }]}>
                  Topics I Voted On
                </Text>
              )}
              <TopicCard topic={item} userVoted={!!userVotes[item.id]} />
            </>
          );
        }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="user" size={48} color={colors.border} />
            <Text style={s.emptyText}>Nothing here yet</Text>
            <Text style={s.emptySubtext}>
              Create a topic or vote on something
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 16,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    statsRow: {
      flexDirection: "row",
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      alignItems: "center",
    },
    statBox: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },
    statNum: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.primary,
    },
    statLabel: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontWeight: "500",
    },
    statDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.border,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    list: { padding: 16 },
    empty: {
      alignItems: "center",
      paddingTop: 60,
      gap: 8,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.mutedForeground,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.mutedForeground,
    },
  });
