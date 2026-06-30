import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ThemedInput from "@/components/ThemedInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TopicCard from "@/components/TopicCard";
import { ALL_CATEGORIES, CATEGORY_CONFIG } from "@/constants/categories";
import { useApp, type Category } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function ExploreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { topics, userVotes } = useApp();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  const trimmed = query.trim();
  const isHashtagSearch = trimmed.startsWith("#") && trimmed.length > 1;
  // Strip the leading # and any extra whitespace
  const hashtagQuery = isHashtagSearch
    ? trimmed.slice(1).toLowerCase().trim()
    : "";

  const results = useMemo(() => {
    let list = [...topics];

    // Category filter always applies first
    if (activeCategory) {
      list = list.filter((t) => t.category === activeCategory);
    }

    if (isHashtagSearch && hashtagQuery) {
      // Hashtag search: match stored hashtags, title, OR description
      // This way #chess finds "Is chess a sport?" even if it wasn't tagged
      list = list.filter((t) => {
        const tagMatch = t.hashtags?.some((h) =>
          h.toLowerCase().includes(hashtagQuery)
        );
        const titleMatch = t.title.toLowerCase().includes(hashtagQuery);
        const descMatch = t.description?.toLowerCase().includes(hashtagQuery);
        return tagMatch || titleMatch || descMatch;
      });
    } else if (trimmed) {
      // Plain text search: match title, description, OR hashtags (without needing #)
      const q = trimmed.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.hashtags?.some((h) => h.toLowerCase().includes(q))
      );
    }

    return list;
  }, [topics, activeCategory, trimmed, isHashtagSearch, hashtagQuery]);

  // Show results whenever there's any query OR a category is selected
  const showResults = !!trimmed || !!activeCategory;

  const s = styles(colors, insets);

  return (
    <View style={s.container}>
      {/* Header */}
      <View
        style={[
          s.header,
          { paddingTop: Platform.OS === "web" ? 16 : insets.top + 4 },
        ]}
      >
        <Text style={s.title}>Explore</Text>

        <View style={[s.searchRow, isHashtagSearch && s.searchRowHashtag]}>
          <Icon
            name={isHashtagSearch ? "hash" : "search"}
            size={16}
            color={isHashtagSearch ? colors.primary : colors.mutedForeground}
          />
          <ThemedInput
            style={s.searchInput}
            placeholder="Search topics or #hashtag..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {!!query && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Icon name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {isHashtagSearch && (
          <View style={s.hashtagBanner}>
            <Icon name="hash" size={12} color={colors.primary} />
            <Text style={s.hashtagBannerText}>
              Showing posts matching{" "}
              <Text style={{ fontWeight: "700" }}>#{hashtagQuery}</Text>
              {" "}— including titles and tags
            </Text>
          </View>
        )}
      </View>

      {/* Category grid */}
      <View style={s.catGrid}>
        {ALL_CATEGORIES.map((cat) => {
          const cfg = CATEGORY_CONFIG[cat];
          const active = activeCategory === cat;
          const count = topics.filter((t) => t.category === cat).length;
          return (
            <Pressable
              key={cat}
              style={({ pressed }) => [
                s.catTile,
                active && {
                  borderColor: cfg.color,
                  backgroundColor: cfg.color + "22",
                },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setActiveCategory(active ? null : cat)}
            >
              <Icon name={cfg.icon as any} size={18} color={cfg.color} />
              <Text style={[s.catName, active && { color: cfg.color }]}>
                {cfg.label}
              </Text>
              <Text style={s.catCount}>{count}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Results */}
      {showResults && (
        <FlatList
          data={results}
          keyExtractor={(t) => t.id}
          contentContainerStyle={[
            s.list,
            { paddingBottom: Platform.OS === "web" ? 68 : insets.bottom + 56 },
          ]}
          renderItem={({ item }) => (
            <TopicCard topic={item} userVoted={!!userVotes[item.id]} />
          )}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon name="search" size={36} color={colors.border} />
              <Text style={s.emptyTitle}>No results found</Text>
              <Text style={s.emptySubtitle}>
                {isHashtagSearch
                  ? `No posts match "#${hashtagQuery}" — try a different tag or word`
                  : "Try a different search term or browse by category"}
              </Text>
            </View>
          }
        />
      )}

      {/* Default state — no search, no category */}
      {!showResults && (
        <View style={s.defaultHint}>
          <Icon name="search" size={28} color={colors.border} />
          <Text style={s.defaultHintText}>
            Search by title, description, or #hashtag
          </Text>
          <Text style={s.defaultHintSub}>
            Or tap a category above to browse
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 12,
    },
    title: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.muted,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 8,
      borderWidth: 1,
      borderColor: "transparent",
    },
    searchRowHashtag: {
      borderColor: colors.primary + "66",
      backgroundColor: colors.primary + "11",
    },
    hashtagBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    hashtagBannerText: {
      fontSize: 12,
      color: colors.mutedForeground,
      flex: 1,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      color: colors.foreground,
      padding: 0,
    },
    catGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      padding: 12,
      gap: 8,
    },
    catTile: {
      width: "22%",
      aspectRatio: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      flexGrow: 1,
    },
    catName: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.foreground,
      textAlign: "center",
    },
    catCount: { fontSize: 10, color: colors.mutedForeground },
    list: { paddingHorizontal: 16, paddingTop: 8 },
    empty: { alignItems: "center", paddingTop: 60, gap: 8, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 16, fontWeight: "600", color: colors.mutedForeground },
    emptySubtitle: {
      fontSize: 13,
      color: colors.border,
      textAlign: "center",
      lineHeight: 19,
    },
    defaultHint: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingBottom: 80,
    },
    defaultHintText: {
      fontSize: 14,
      color: colors.mutedForeground,
      textAlign: "center",
    },
    defaultHintSub: {
      fontSize: 12,
      color: colors.border,
      textAlign: "center",
    },
  });
