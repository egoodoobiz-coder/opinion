import { Feather } from "@expo/vector-icons";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TopicCard from "@/components/TopicCard";
import { ALL_CATEGORIES, CATEGORY_CONFIG } from "@/constants/categories";
import { useApp, type Category } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Filter = "all" | "new" | "top";

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { topics, userVotes } = useApp();
  const [activeFilter, setActiveFilter] = useState<Filter>("new");
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");

  const filtered = useMemo(() => {
    let list = [...topics];
    if (activeCategory !== "all") {
      list = list.filter((t) => t.category === activeCategory);
    }
    if (activeFilter === "new") {
      list.sort((a, b) => b.createdAt - a.createdAt);
    } else if (activeFilter === "top") {
      list.sort(
        (a, b) =>
          b.yesCount + b.noCount + b.ratingCount - (a.yesCount + a.noCount + a.ratingCount)
      );
    }
    // Promote premium topics to the top
    list.sort((a, b) => {
      const aPremium = !!(a as any).premiumAccountType;
      const bPremium = !!(b as any).premiumAccountType;
      if (aPremium && !bPremium) return -1;
      if (!aPremium && bPremium) return 1;
      return 0;
    });
    return list;
  }, [topics, activeFilter, activeCategory]);

  const s = styles(colors, insets);

  return (
    <View style={s.container}>
      <View
        style={[
          s.header,
          { paddingTop: Platform.OS === "web" ? 67 : insets.top + 12 },
        ]}
      >
        <View style={s.headerTop}>
          <Text style={s.logo}>Opinion</Text>
          <Pressable
            style={({ pressed }) => [s.createBtn, pressed && { opacity: 0.8 }]}
            onPress={() => router.push("/create")}
          >
            <Feather name="plus" size={20} color={colors.primaryForeground} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterRow}
        >
          {(["all", "new", "top"] as const).map((f) => (
            <Pressable
              key={f}
              style={[s.filterBtn, activeFilter === f && s.filterBtnActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text
                style={[
                  s.filterLabel,
                  activeFilter === f && s.filterLabelActive,
                ]}
              >
                {f === "all" ? "All" : f === "new" ? "New" : "Top"}
              </Text>
            </Pressable>
          ))}
          <View style={s.divider} />
          <Pressable
            style={[
              s.filterBtn,
              activeCategory === "all" && s.filterBtnActive,
            ]}
            onPress={() => setActiveCategory("all")}
          >
            <Text
              style={[
                s.filterLabel,
                activeCategory === "all" && s.filterLabelActive,
              ]}
            >
              All Topics
            </Text>
          </Pressable>
          {ALL_CATEGORIES.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <Pressable
                key={cat}
                style={[
                  s.filterBtn,
                  activeCategory === cat && s.filterBtnActive,
                  activeCategory === cat && {
                    backgroundColor: cfg.color + "33",
                    borderColor: cfg.color,
                  },
                ]}
                onPress={() => setActiveCategory(cat)}
              >
                <Feather
                  name={cfg.icon as any}
                  size={12}
                  color={
                    activeCategory === cat ? cfg.color : colors.mutedForeground
                  }
                />
                <Text
                  style={[
                    s.filterLabel,
                    activeCategory === cat && {
                      color: cfg.color,
                      fontWeight: "700",
                    },
                  ]}
                >
                  {cfg.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        contentContainerStyle={[
          s.list,
          { paddingBottom: Platform.OS === "web" ? 100 : insets.bottom + 80 },
        ]}
        renderItem={({ item }) => (
          <TopicCard topic={item} userVoted={!!userVotes[item.id]} />
        )}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!filtered.length}
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="inbox" size={48} color={colors.border} />
            <Text style={s.emptyText}>No topics yet</Text>
            <Text style={s.emptySubtext}>Be the first to share an opinion</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = (colors: ReturnType<typeof useColors>, insets: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },
    logo: {
      fontSize: 26,
      fontWeight: "800",
      color: colors.foreground,
      letterSpacing: -0.5,
    },
    createBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    filterRow: {
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
      paddingBottom: 4,
    },
    filterBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 100,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterBtnActive: {
      backgroundColor: colors.primary + "22",
      borderColor: colors.primary,
    },
    filterLabel: {
      fontSize: 12,
      fontWeight: "500",
      color: colors.mutedForeground,
    },
    filterLabelActive: {
      color: colors.primary,
      fontWeight: "700",
    },
    divider: {
      width: 1,
      height: 20,
      backgroundColor: colors.border,
      marginHorizontal: 4,
    },
    list: {
      padding: 16,
    },
    empty: {
      alignItems: "center",
      paddingTop: 80,
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
