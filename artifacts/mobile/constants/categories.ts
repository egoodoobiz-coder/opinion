import type { Category } from "@/context/AppContext";

export const CATEGORY_CONFIG: Record<
  Category,
  { label: string; icon: string; color: string }
> = {
  food: { label: "Food", icon: "coffee", color: "#f97316" },
  tech: { label: "Tech", icon: "cpu", color: "#3b82f6" },
  movies: { label: "Movies", icon: "film", color: "#ec4899" },
  music: { label: "Music", icon: "music", color: "#8b5cf6" },
  sports: { label: "Sports", icon: "activity", color: "#22c55e" },
  politics: { label: "Politics", icon: "flag", color: "#ef4444" },
  gaming: { label: "Gaming", icon: "zap", color: "#eab308" },
  science: { label: "Science", icon: "globe", color: "#06b6d4" },
  lifestyle: { label: "Lifestyle", icon: "sun", color: "#f59e0b" },
  other: { label: "Other", icon: "more-horizontal", color: "#94a3b8" },
};

export const ALL_CATEGORIES: Category[] = [
  "food",
  "tech",
  "movies",
  "music",
  "sports",
  "politics",
  "gaming",
  "science",
  "lifestyle",
  "other",
];
