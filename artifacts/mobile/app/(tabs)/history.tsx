import { useAuth, useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TopicCard from "@/components/TopicCard";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type SubTab = "posts" | "voted";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const { topics, userVotes } = useApp();
  const [activeTab, setActiveTab] = useState<SubTab>("posts");

  const userId = user?.id;

  const myTopics = topics
    .filter((t) => t.authorId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const votedTopics = topics
    .filter((t) => userVotes[t.id] && t.authorId !== userId)
    .sort((a, b) => b.createdAt - a.createdAt);

  const s = styles(colors, insets);

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <View style={[s.container, s.center]}>
        <View style={[s.header, { paddingTop: Platform.OS === "web" ? 16 : insets.top + 12 }]}>
          <Text style={s.title}>History</Text>
        </View>
        <View style={s.signInPrompt}>
          <Feather name="clock" size={56} color={colors.border} />
          <Text style={s.signInTitle}>Sign in to see your history</Text>
          <Text style={s.signInSubtitle}>
            Your posts and votes will appear here once you have an account
          </Text>
          <Pressable
            style={({ pressed }) => [s.signInBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push("/(auth)/sign-in")}
          >
            <Text style={s.signInBtnText}>Sign In</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const activeData = activeTab === "posts" ? myTopics : votedTopics;

  const emptyConfig = {
    posts: {
      icon: "edit" as const,
      title: "No posts yet",
      subtitle: "Topics you create will show up here",
      action: "Create a topic",
      onPress: () => router.push("/create"),
    },
    voted: {
      icon: "thumbs-up" as const,
      title: "No votes yet",
      subtitle: "Topics you vote on will appear here",
      action: "Browse topics",
      onPress: () => router.push("/(tabs)/explore"),
    },
  };

  const empty = emptyConfig[activeTab];

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={[s.header, { paddingTop: Platform.OS === "web" ? 16 : insets.top + 12 }]}>
        <Text style={s.title}>History</Text>
      </View>

      {/* Sub-tabs */}
      <View style={s.subTabBar}>
        <Pressable
          style={[s.subTab, activeTab === "posts" && s.subTabActive]}
          onPress={() => setActiveTab("posts")}
        >
          <Text style={[s.subTabText, activeTab === "posts" && s.subTabTextActive]}>
            My Posts
          </Text>
          {myTopics.length > 0 && (
            <View style={[s.badge, activeTab === "posts" && s.badgeActive]}>
              <Text style={[s.badgeText, activeTab === "posts" && s.badgeTextActive]}>
                {myTopics.length}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          style={[s.subTab, activeTab === "voted" && s.subTabActive]}
          onPress={() => setActiveTab("voted")}
        >
          <Text style={[s.subTabText, activeTab === "voted" && s.subTabTextActive]}>
            Voted On
          </Text>
          {votedTopics.length > 0 && (
            <View style={[s.badge, activeTab === "voted" && s.badgeActive]}>
              <Text style={[s.badgeText, activeTab === "voted" && s.badgeTextActive]}>
                {votedTopics.length}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Content */}
      <FlatList
        data={activeData}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.listContent,
          activeData.length === 0 && s.listContentEmpty,
        ]}
        ListEmptyComponent={
          <View style={s.emptyState}>
            <Feather name={empty.icon} size={52} color={colors.border} />
            <Text style={s.emptyTitle}>{empty.title}</Text>
            <Text style={s.emptySubtitle}>{empty.subtitle}</Text>
            <Pressable
              style={({ pressed }) => [s.emptyBtn, pressed && { opacity: 0.8 }]}
              onPress={empty.onPress}
            >
              <Text style={s.emptyBtnText}>{empty.action}</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <TopicCard
            topic={item}
            userVoted={!!userVotes[item.id]}
          />
        )}
      />
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
      paddingBottom: 12,
    },
    title: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.foreground,
      letterSpacing: -0.3,
    },

    subTabBar: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: 16,
    },
    subTab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 12,
      marginRight: 24,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    subTabActive: {
      borderBottomColor: colors.primary,
    },
    subTabText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    subTabTextActive: {
      color: colors.foreground,
    },
    badge: {
      backgroundColor: colors.card,
      borderRadius: 10,
      paddingHorizontal: 6,
      paddingVertical: 1,
      minWidth: 20,
      alignItems: "center",
    },
    badgeActive: {
      backgroundColor: colors.primary + "22",
    },
    badgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.mutedForeground,
    },
    badgeTextActive: {
      color: colors.primary,
    },

    listContent: {
      paddingTop: 8,
      paddingBottom: Platform.OS === "web" ? 70 : insets.bottom + 80,
    },
    listContentEmpty: {
      flex: 1,
      justifyContent: "center",
    },

    emptyState: {
      alignItems: "center",
      paddingHorizontal: 40,
      paddingVertical: 60,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "600",
      color: colors.foreground,
      marginTop: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
    },
    emptyBtn: {
      marginTop: 16,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 20,
    },
    emptyBtnText: {
      color: "#fff",
      fontWeight: "600",
      fontSize: 14,
    },

    signInPrompt: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 40,
      gap: 8,
    },
    signInTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: colors.foreground,
      marginTop: 16,
      textAlign: "center",
    },
    signInSubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
    },
    signInBtn: {
      marginTop: 20,
      backgroundColor: colors.primary,
      paddingHorizontal: 32,
      paddingVertical: 12,
      borderRadius: 24,
    },
    signInBtnText: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
    },
  });
