import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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

  const results = useMemo(() => {
    let list = [...topics];
    if (activeCategory) {
      list = list.filter((t) => t.category === activeCategory);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [topics, activeCategory, query]);

  const s = styles(colors, insets);

  return (
    <View style={s.container}>
      <View
        style={[
          s.header,
          { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 },
        ]}
      >
        <Text style={s.title}>Explore</Text>
        <View style={s.searchRow}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            style={s.searchInput}
            placeholder="Search opinions..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
          />
          {!!query && (
            <Pressable onPress={() => setQuery("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

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
                active && { borderColor: cfg.color, backgroundColor: cfg.color + "22" },
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => setActiveCategory(active ? null : cat)}
            >
              <Feather name={cfg.icon as any} size={18} color={cfg.color} />
              <Text style={[s.catName, active && { color: cfg.color }]}>
                {cfg.label}
              </Text>
              <Text style={s.catCount}>{count}</Text>
            </Pressable>
          );
        })}
      </View>

      {(!!query || !!activeCategory) && (
        <FlatList
          data={results}
          keyExtractor={(t) => t.id}
          contentContainerStyle={[
            s.list,
            {
              paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 80,
            },
          ]}
          renderItem={({ item }) => (
            <TopicCard topic={item} userVoted={!!userVotes[item.id]} />
          )}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!results.length}
          ListEmptyComponent={
            <View style={s.empty}>
              <Feather name="search" size={36} color={colors.border} />
              <Text style={s.emptyText}>No results found</Text>
            </View>
          }
        />
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
    catCount: {
      fontSize: 10,
      color: colors.mutedForeground,
    },
    list: { paddingHorizontal: 16, paddingTop: 8 },
    empty: {
      alignItems: "center",
      paddingTop: 60,
      gap: 8,
    },
    emptyText: {
      fontSize: 16,
      color: colors.mutedForeground,
    },
  });
