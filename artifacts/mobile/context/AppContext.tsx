import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "@clerk/expo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type VotingType = "yesno" | "rating" | "ranking";

export interface Comment {
  id: string;
  topicId: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: number;
}

export type Category =
  | "food"
  | "tech"
  | "movies"
  | "music"
  | "sports"
  | "politics"
  | "gaming"
  | "science"
  | "lifestyle"
  | "travel"
  | "automobiles"
  | "other";

export interface RankingOption {
  id: string;
  label: string;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  category: Category;
  votingType: VotingType;
  rankingOptions?: RankingOption[];
  createdAt: number;
  createdBy: string;
  yesCount: number;
  noCount: number;
  totalRating: number;
  ratingCount: number;
  rankingVotes: Record<string, number[]>;
  comments: Comment[];
}

export interface UserVote {
  topicId: string;
  yesno?: "yes" | "no";
  rating?: number;
  ranking?: string[]; // ordered optionIds
}

interface AppContextValue {
  topics: Topic[];
  userVotes: Record<string, UserVote>;
  userId: string;
  addTopic: (topic: Omit<Topic, "id" | "createdAt" | "yesCount" | "noCount" | "totalRating" | "ratingCount" | "rankingVotes" | "createdBy" | "comments">, premiumAccountType?: string) => void;
  addComment: (topicId: string, text: string, authorId: string, authorName: string) => void;
  voteYesNo: (topicId: string, vote: "yes" | "no") => void;
  voteRating: (topicId: string, rating: number) => void;
  voteRanking: (topicId: string, orderedIds: string[]) => void;
  getUserVote: (topicId: string) => UserVote | undefined;
}

const AppContext = createContext<AppContextValue | null>(null);

const TOPICS_KEY = "opinion_topics_v2";
const VOTES_KEY = "rankit_votes";
const USER_KEY = "rankit_user";

const SAMPLE_TOPICS: Topic[] = [
  {
    id: "1",
    title: "Is pineapple on pizza acceptable?",
    description: "The age-old debate. Share your honest opinion.",
    category: "food",
    votingType: "yesno",
    createdAt: Date.now() - 86400000 * 2,
    createdBy: "system",
    yesCount: 142,
    noCount: 203,
    totalRating: 687,
    ratingCount: 189,
    rankingVotes: {},
    comments: [],
  },
  {
    id: "2",
    title: "Rank these streaming platforms",
    description: "Which do you actually use most?",
    category: "tech",
    votingType: "ranking",
    rankingOptions: [
      { id: "netflix", label: "Netflix" },
      { id: "disney", label: "Disney+" },
      { id: "hbo", label: "Max" },
      { id: "apple", label: "Apple TV+" },
      { id: "prime", label: "Prime Video" },
    ],
    createdAt: Date.now() - 86400000,
    createdBy: "system",
    yesCount: 0,
    noCount: 0,
    totalRating: 412,
    ratingCount: 87,
    rankingVotes: {
      netflix: [1, 1, 2, 1, 3, 2, 1, 1],
      disney: [2, 3, 1, 2, 1, 3, 2, 2],
      hbo: [3, 2, 3, 3, 2, 1, 3, 3],
      apple: [4, 4, 5, 4, 4, 4, 4, 4],
      prime: [5, 5, 4, 5, 5, 5, 5, 5],
    },
    comments: [],
  },
  {
    id: "3",
    title: "Should remote work be the standard?",
    description: "Post-pandemic, is remote-first the right move for companies?",
    category: "lifestyle",
    votingType: "yesno",
    createdAt: Date.now() - 3600000 * 5,
    createdBy: "system",
    yesCount: 876,
    noCount: 124,
    totalRating: 2890,
    ratingCount: 576,
    rankingVotes: {},
    comments: [],
  },
  {
    id: "4",
    title: "Best programming languages to learn in 2025",
    description: "For career, for fun, or both?",
    category: "tech",
    votingType: "ranking",
    rankingOptions: [
      { id: "python", label: "Python" },
      { id: "rust", label: "Rust" },
      { id: "typescript", label: "TypeScript" },
      { id: "go", label: "Go" },
      { id: "swift", label: "Swift" },
    ],
    createdAt: Date.now() - 3600000 * 12,
    createdBy: "system",
    yesCount: 210,
    noCount: 45,
    totalRating: 0,
    ratingCount: 0,
    rankingVotes: {
      python: [1, 2, 1, 1, 2, 1, 1],
      typescript: [2, 1, 2, 2, 1, 2, 2],
      rust: [3, 3, 3, 4, 3, 3, 3],
      go: [4, 4, 4, 3, 4, 4, 4],
      swift: [5, 5, 5, 5, 5, 5, 5],
    },
    comments: [],
  },
  {
    id: "5",
    title: "Is chess a sport?",
    description: "Should mental games be classified as sports?",
    category: "sports",
    votingType: "yesno",
    createdAt: Date.now() - 3600000 * 2,
    createdBy: "system",
    yesCount: 521,
    noCount: 389,
    totalRating: 0,
    ratingCount: 0,
    rankingVotes: {},
    comments: [],
  },
];

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, UserVote>>({});
  const [userId, setUserId] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const { user } = useUser();
  const clerkUserId = user?.id;

  useEffect(() => {
    (async () => {
      try {
        const [topicsRaw, votesRaw, userRaw] = await Promise.all([
          AsyncStorage.getItem(TOPICS_KEY),
          AsyncStorage.getItem(VOTES_KEY),
          AsyncStorage.getItem(USER_KEY),
        ]);

        let uid = userRaw;
        if (!uid) {
          uid = generateId();
          await AsyncStorage.setItem(USER_KEY, uid);
        }
        setUserId(uid);

        if (topicsRaw) {
          const parsed = JSON.parse(topicsRaw);
          const migrated = parsed.map((t: any) => ({
            ...t,
            comments: t.comments ?? [],
          }));
          setTopics(migrated);
        } else {
          setTopics(SAMPLE_TOPICS);
          await AsyncStorage.setItem(TOPICS_KEY, JSON.stringify(SAMPLE_TOPICS));
        }

        if (votesRaw) {
          setUserVotes(JSON.parse(votesRaw));
        }
      } catch (e) {
        setTopics(SAMPLE_TOPICS);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const saveTopics = useCallback(async (updated: Topic[]) => {
    setTopics(updated);
    await AsyncStorage.setItem(TOPICS_KEY, JSON.stringify(updated));
  }, []);

  const saveVotes = useCallback(async (updated: Record<string, UserVote>) => {
    setUserVotes(updated);
    await AsyncStorage.setItem(VOTES_KEY, JSON.stringify(updated));
  }, []);

  const addTopic = useCallback(
    (topic: Omit<Topic, "id" | "createdAt" | "yesCount" | "noCount" | "totalRating" | "ratingCount" | "rankingVotes" | "createdBy">, premiumAccountType?: string) => {
      const effectiveUserId = clerkUserId ?? userId;
      const newTopic: any = {
        ...topic,
        id: generateId(),
        createdAt: Date.now(),
        createdBy: effectiveUserId,
        yesCount: 0,
        noCount: 0,
        totalRating: 0,
        ratingCount: 0,
        rankingVotes: {},
        comments: [],
      };
      if (premiumAccountType) {
        newTopic.premiumAccountType = premiumAccountType;
      }
      const updated = [newTopic, ...topics];
      saveTopics(updated);
    },
    [topics, userId, clerkUserId, saveTopics]
  );

  const voteYesNo = useCallback(
    (topicId: string, vote: "yes" | "no") => {
      const prev = userVotes[topicId];
      const wasYes = prev?.yesno === "yes";
      const wasNo = prev?.yesno === "no";

      const updated = topics.map((t) => {
        if (t.id !== topicId) return t;
        let { yesCount, noCount } = t;
        if (wasYes) yesCount--;
        if (wasNo) noCount--;
        if (vote === "yes") yesCount++;
        else noCount++;
        return { ...t, yesCount, noCount };
      });

      const newVotes = {
        ...userVotes,
        [topicId]: { ...prev, topicId, yesno: vote as "yes" | "no" },
      };
      saveTopics(updated);
      saveVotes(newVotes);
    },
    [topics, userVotes, saveTopics, saveVotes]
  );

  const voteRating = useCallback(
    (topicId: string, rating: number) => {
      const prev = userVotes[topicId];
      const prevRating = prev?.rating;

      const updated = topics.map((t) => {
        if (t.id !== topicId) return t;
        let { totalRating, ratingCount } = t;
        if (prevRating !== undefined) {
          totalRating -= prevRating;
          ratingCount--;
        }
        totalRating += rating;
        ratingCount++;
        return { ...t, totalRating, ratingCount };
      });

      const newVotes = {
        ...userVotes,
        [topicId]: { ...prev, topicId, rating },
      };
      saveTopics(updated);
      saveVotes(newVotes);
    },
    [topics, userVotes, saveTopics, saveVotes]
  );

  const voteRanking = useCallback(
    (topicId: string, orderedIds: string[]) => {
      const prev = userVotes[topicId];
      const prevRanking = prev?.ranking;

      const updated = topics.map((t) => {
        if (t.id !== topicId) return t;
        const newRankingVotes = { ...t.rankingVotes };

        if (prevRanking) {
          prevRanking.forEach((optId, idx) => {
            const rank = idx + 1;
            if (newRankingVotes[optId]) {
              newRankingVotes[optId] = newRankingVotes[optId].filter(
                (r) => r !== rank
              );
            }
          });
        }

        orderedIds.forEach((optId, idx) => {
          const rank = idx + 1;
          if (!newRankingVotes[optId]) newRankingVotes[optId] = [];
          newRankingVotes[optId] = [...newRankingVotes[optId], rank];
        });

        return { ...t, rankingVotes: newRankingVotes };
      });

      const newVotes = {
        ...userVotes,
        [topicId]: { ...prev, topicId, ranking: orderedIds },
      };
      saveTopics(updated);
      saveVotes(newVotes);
    },
    [topics, userVotes, saveTopics, saveVotes]
  );

  const getUserVote = useCallback(
    (topicId: string) => userVotes[topicId],
    [userVotes]
  );

  const addComment = useCallback(
    (topicId: string, text: string, authorId: string, authorName: string) => {
      const comment: Comment = {
        id: generateId(),
        topicId,
        text: text.trim(),
        authorId,
        authorName,
        createdAt: Date.now(),
      };
      const updated = topics.map((t) =>
        t.id === topicId ? { ...t, comments: [...t.comments, comment] } : t
      );
      saveTopics(updated);
    },
    [topics, saveTopics]
  );

  if (!loaded) return null;

  return (
    <AppContext.Provider
      value={{
        topics,
        userVotes,
        userId,
        addTopic,
        addComment,
        voteYesNo,
        voteRating,
        voteRanking,
        getUserVote,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
