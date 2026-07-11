import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ThemedInput from "@/components/ThemedInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TopicCard from "@/components/TopicCard";
import EmptyState from "@/components/EmptyState";
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
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const trimmed = query.trim();
  const isHashtagSearch = trimmed.startsWith("#") && trimmed.length > 1;
  const hashtagQuery = isHashtagSearch
    ? trimmed.slice(1).toLowerCase().trim()
    : "";
  const hashtagNumber = hashtagQuery ? parseInt(hashtagQuery, 10) : NaN;
  const isPostNumberSearch =
    !isNaN(hashtagNumber) && String(hashtagNumber) === hashtagQuery;

  const results = useMemo(() => {
    let list = [...topics];

    if (activeCategory) {
      list = list.filter((t) => t.category === activeCategory);
    }

    if (isHashtagSearch && hashtagQuery) {
      if (isPostNumberSearch) {
        list = list.filter((t) => t.topicNumber === hashtagNumber);
      } else {
        list = list.filter((t) => {
          const tagMatch = t.hashtags?.some((h) =>
            h.toLowerCase().includes(hashtagQuery)
          );
          const titleMatch = t.title.toLowerCase().includes(hashtagQuery);
          const descMatch = t.description?.toLowerCase().includes(hashtagQuery);
          return tagMatch || titleMatch || descMatch;
        });
      }
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

    list.sort((a, b) =>
      sortOrder === "newest" ? b.createdAt - a.createdAt : a.createdAt - b.createdAt
    );

    return list;
  }, [topics, activeCategory, trimmed, isHashtagSearch, hashtagQuery, isPostNumberSearch, hashtagNumber, sortOrder]);

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
              {isPostNumberSearch ? (
                <>Jumping to post <Text style={{ fontWeight: "700" }}>#{hashtagNumber}</Text></>
              ) : (
                <>Showing posts matching <Text style={{ fontWeight: "700" }}>#{hashtagQuery}</Text>{" "}— including titles and tags</>
              )}
            </Text>
          </View>
        )}
      </View>

      {/* Full category grid when browsing; collapses to a chip strip once
          a category or search is active so results get the screen */}
      {!showResults ? (
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
      ) : (
        <View style={s.compactBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipRow}
          >
            {ALL_CATEGORIES.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const active = activeCategory === cat;
              return (
                <Pressable
                  key={cat}
                  style={[
                    s.chip,
                    active && { borderColor: cfg.color, backgroundColor: cfg.color + "22" },
                  ]}
                  onPress={() => setActiveCategory(active ? null : cat)}
                >
                  <Icon
                    name={cfg.icon as any}
                    size={12}
                    color={active ? cfg.color : colors.mutedForeground}
                  />
                  <Text style={[s.chipText, active && { color: cfg.color, fontWeight: "700" }]}>
                    {cfg.label}
                  </Text>
                  {active && <Icon name="x" size={11} color={cfg.color} />}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={s.resultsBar}>
            <Text style={s.resultsCount}>
              {results.length} {results.length === 1 ? "post" : "posts"}
            </Text>
            <View style={s.sortRow}>
              {(["newest", "oldest"] as const).map((o) => {
                const active = sortOrder === o;
                return (
                  <Pressable
                    key={o}
                    style={[s.sortChip, active && s.sortChipActive]}
                    onPress={() => setSortOrder(o)}
                  >
                    <Icon
                      name={o === "newest" ? "chevron-down" : "chevron-up"}
                      size={11}
                      color={active ? colors.primary : colors.mutedForeground}
                    />
                    <Text style={[s.sortChipText, active && s.sortChipTextActive]}>
                      {o === "newest" ? "Newest" : "Oldest"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      )}

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
            <EmptyState
              icon="search"
              title="No results found"
              subtitle={
                isPostNumberSearch
                  ? `No post with number #${hashtagNumber} found`
                  : isHashtagSearch
                  ? `No posts match "#${hashtagQuery}" — try a different tag or word`
                  : "Try a different search term or browse by category"
              }
            />
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
      maxWidth: 130,
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
    compactBar: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    chipRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    chipText: { fontSize: 12, color: colors.mutedForeground, fontWeight: "500" },
    resultsBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    resultsCount: { fontSize: 12, color: colors.mutedForeground, fontWeight: "600" },
    sortRow: { flexDirection: "row", gap: 6 },
    sortChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    sortChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "18",
    },
    sortChipText: { fontSize: 11, color: colors.mutedForeground, fontWeight: "600" },
    sortChipTextActive: { color: colors.primary, fontWeight: "700" },
    list: { paddingHorizontal: 16, paddingTop: 8 },
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
