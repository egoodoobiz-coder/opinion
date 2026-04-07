import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUser } from "@clerk/expo";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type VotingType = "yesno" | "rating" | "ranking" | "aspects";

export interface UserDemographics {
  ageRange?: string;
  gender?: string;
  country?: string;
  occupation?: string;
}

export interface DemoBreakdown {
  ageRange?: Record<string, number>;
  gender?: Record<string, number>;
  country?: Record<string, number>;
  occupation?: Record<string, number>;
}

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
  aspects?: string[];
  aspectVotes?: Record<string, { up: number; down: number }>;
  targetDemographics?: UserDemographics;
  demoBreakdown?: DemoBreakdown;
  hashtags?: string[];
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
  ranking?: string[];
  aspectChoices?: Record<string, "up" | "down">;
  voterDemo?: UserDemographics;
}

interface AppContextValue {
  topics: Topic[];
  userVotes: Record<string, UserVote>;
  userId: string;
  userDemographics: UserDemographics;
  addTopic: (
    topic: Omit<Topic, "id" | "createdAt" | "yesCount" | "noCount" | "totalRating" | "ratingCount" | "rankingVotes" | "createdBy" | "comments" | "demoBreakdown">,
    premiumAccountType?: string
  ) => void;
  addComment: (topicId: string, text: string, authorId: string, authorName: string) => void;
  voteYesNo: (topicId: string, vote: "yes" | "no") => void;
  voteRating: (topicId: string, rating: number) => void;
  voteRanking: (topicId: string, orderedIds: string[]) => void;
  voteAspect: (topicId: string, aspect: string, choice: "up" | "down") => void;
  getUserVote: (topicId: string) => UserVote | undefined;
}

const AppContext = createContext<AppContextValue | null>(null);

const TOPICS_KEY = "opinion_topics_v3";
const VOTES_KEY = "rankit_votes";
const USER_KEY = "rankit_user";

const SAMPLE_TOPICS: Topic[] = [
  {
    id: "1",
    title: "Is pineapple on pizza acceptable?",
    description: "The age-old debate. Share your honest opinion.",
    category: "food",
    votingType: "yesno",
    hashtags: ["pizza", "food", "pineapple"],
    createdAt: Date.now() - 86400000 * 2,
    createdBy: "system",
    yesCount: 142,
    noCount: 203,
    totalRating: 687,
    ratingCount: 189,
    rankingVotes: {},
    comments: [],
    demoBreakdown: {
      ageRange: { "18–24": 48, "25–34": 91, "35–44": 62, "45–54": 34, "65+": 10 },
      gender: { Male: 174, Female: 146, "Non-binary": 25 },
      occupation: { Student: 89, Employed: 178, Retired: 28 },
    },
  },
  {
    id: "2",
    title: "Rank these streaming platforms",
    description: "Which do you actually use most?",
    category: "tech",
    votingType: "ranking",
    hashtags: ["streaming", "netflix", "tech"],
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
    demoBreakdown: {
      ageRange: { "18–24": 24, "25–34": 38, "35–44": 18, "45–54": 7 },
      gender: { Male: 52, Female: 29, "Non-binary": 6 },
    },
  },
  {
    id: "3",
    title: "Should remote work be the standard?",
    description: "Post-pandemic, is remote-first the right move for companies?",
    category: "lifestyle",
    votingType: "yesno",
    hashtags: ["remotework", "work", "lifestyle"],
    targetDemographics: { occupation: "Employed" },
    createdAt: Date.now() - 3600000 * 5,
    createdBy: "system",
    yesCount: 876,
    noCount: 124,
    totalRating: 2890,
    ratingCount: 576,
    rankingVotes: {},
    comments: [],
    demoBreakdown: {
      ageRange: { "18–24": 201, "25–34": 398, "35–44": 267, "45–54": 102, "55–64": 32 },
      gender: { Male: 489, Female: 412, "Non-binary": 99 },
      occupation: { Employed: 612, "Self-employed": 198, Student: 87, Retired: 33 },
    },
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
    hashtags: ["chess", "sports", "debate"],
    createdAt: Date.now() - 3600000 * 2,
    createdBy: "system",
    yesCount: 521,
    noCount: 389,
    totalRating: 0,
    ratingCount: 0,
    rankingVotes: {},
    comments: [],
  },
  {
    id: "6",
    title: "Rate this garage: City Motors",
    description: "Have you visited City Motors? Tell us what you think about each aspect of their service.",
    category: "automobiles",
    votingType: "aspects",
    aspects: ["Service", "Punctuality", "Staff", "Cleanliness", "Price", "Quality"],
    aspectVotes: {
      Service:     { up: 87, down: 23 },
      Punctuality: { up: 61, down: 41 },
      Staff:       { up: 94, down: 12 },
      Cleanliness: { up: 78, down: 28 },
      Price:       { up: 44, down: 68 },
      Quality:     { up: 89, down: 17 },
    },
    createdAt: Date.now() - 3600000 * 8,
    createdBy: "system",
    yesCount: 0,
    noCount: 0,
    totalRating: 0,
    ratingCount: 0,
    rankingVotes: {},
    comments: [],
    demoBreakdown: {
      ageRange: { "25–34": 41, "35–44": 58, "45–54": 27, "55–64": 18 },
      gender: { Male: 98, Female: 46 },
    },
  },
];

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function applyDemoToBreakdown(
  breakdown: DemoBreakdown,
  demo: UserDemographics,
  delta: 1 | -1
): DemoBreakdown {
  const result: DemoBreakdown = { ...breakdown };
  const fields: Array<keyof UserDemographics> = ["ageRange", "gender", "country", "occupation"];
  for (const field of fields) {
    const val = demo[field];
    if (!val) continue;
    const current = result[field] ?? {};
    const next = { ...current };
    next[val] = Math.max(0, (next[val] ?? 0) + delta);
    result[field] = next;
  }
  return result;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, UserVote>>({});
  const [userId, setUserId] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const { user } = useUser();
  const clerkUserId = user?.id;

  const userDemographics: UserDemographics = (user?.unsafeMetadata as any)?.demographics ?? {};

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
            aspectVotes: t.aspectVotes ?? {},
            aspects: t.aspects ?? undefined,
            demoBreakdown: t.demoBreakdown ?? {},
            targetDemographics: t.targetDemographics ?? undefined,
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
    (
      topic: Omit<Topic, "id" | "createdAt" | "yesCount" | "noCount" | "totalRating" | "ratingCount" | "rankingVotes" | "createdBy" | "comments" | "demoBreakdown">,
      premiumAccountType?: string
    ) => {
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
        demoBreakdown: {},
        aspectVotes: topic.votingType === "aspects"
          ? Object.fromEntries((topic.aspects ?? []).map((a) => [a, { up: 0, down: 0 }]))
          : undefined,
      };
      if (premiumAccountType) newTopic.premiumAccountType = premiumAccountType;
      saveTopics([newTopic, ...topics]);
    },
    [topics, userId, clerkUserId, saveTopics]
  );

  const voteYesNo = useCallback(
    (topicId: string, vote: "yes" | "no") => {
      const prev = userVotes[topicId];
      const wasYes = prev?.yesno === "yes";
      const wasNo = prev?.yesno === "no";
      const prevDemo = prev?.voterDemo;

      const updated = topics.map((t) => {
        if (t.id !== topicId) return t;
        let { yesCount, noCount } = t;
        if (wasYes) yesCount--;
        if (wasNo) noCount--;
        if (vote === "yes") yesCount++;
        else noCount++;

        let db = t.demoBreakdown ?? {};
        if (prevDemo) db = applyDemoToBreakdown(db, prevDemo, -1);
        if (Object.keys(userDemographics).length > 0) db = applyDemoToBreakdown(db, userDemographics, 1);

        return { ...t, yesCount, noCount, demoBreakdown: db };
      });

      const newVotes = {
        ...userVotes,
        [topicId]: { ...prev, topicId, yesno: vote as "yes" | "no", voterDemo: userDemographics },
      };
      saveTopics(updated);
      saveVotes(newVotes);
    },
    [topics, userVotes, userDemographics, saveTopics, saveVotes]
  );

  const voteRating = useCallback(
    (topicId: string, rating: number) => {
      const prev = userVotes[topicId];
      const prevRating = prev?.rating;
      const prevDemo = prev?.voterDemo;

      const updated = topics.map((t) => {
        if (t.id !== topicId) return t;
        let { totalRating, ratingCount } = t;
        if (prevRating !== undefined) { totalRating -= prevRating; ratingCount--; }
        totalRating += rating;
        ratingCount++;

        let db = t.demoBreakdown ?? {};
        if (prevDemo && prevRating === undefined) db = applyDemoToBreakdown(db, prevDemo, -1);
        if (prevRating === undefined && Object.keys(userDemographics).length > 0) {
          db = applyDemoToBreakdown(db, userDemographics, 1);
        }

        return { ...t, totalRating, ratingCount, demoBreakdown: db };
      });

      const newVotes = {
        ...userVotes,
        [topicId]: { ...prev, topicId, rating, voterDemo: userDemographics },
      };
      saveTopics(updated);
      saveVotes(newVotes);
    },
    [topics, userVotes, userDemographics, saveTopics, saveVotes]
  );

  const voteRanking = useCallback(
    (topicId: string, orderedIds: string[]) => {
      const prev = userVotes[topicId];
      const prevRanking = prev?.ranking;
      const prevDemo = prev?.voterDemo;

      const updated = topics.map((t) => {
        if (t.id !== topicId) return t;
        const newRankingVotes = { ...t.rankingVotes };

        if (prevRanking) {
          prevRanking.forEach((optId, idx) => {
            const rank = idx + 1;
            if (newRankingVotes[optId]) {
              newRankingVotes[optId] = newRankingVotes[optId].filter((r) => r !== rank);
            }
          });
        }
        orderedIds.forEach((optId, idx) => {
          const rank = idx + 1;
          if (!newRankingVotes[optId]) newRankingVotes[optId] = [];
          newRankingVotes[optId] = [...newRankingVotes[optId], rank];
        });

        let db = t.demoBreakdown ?? {};
        if (prevDemo && !prevRanking) db = applyDemoToBreakdown(db, prevDemo, -1);
        if (!prevRanking && Object.keys(userDemographics).length > 0) {
          db = applyDemoToBreakdown(db, userDemographics, 1);
        }

        return { ...t, rankingVotes: newRankingVotes, demoBreakdown: db };
      });

      const newVotes = {
        ...userVotes,
        [topicId]: { ...prev, topicId, ranking: orderedIds, voterDemo: userDemographics },
      };
      saveTopics(updated);
      saveVotes(newVotes);
    },
    [topics, userVotes, userDemographics, saveTopics, saveVotes]
  );

  const voteAspect = useCallback(
    (topicId: string, aspect: string, choice: "up" | "down") => {
      const prev = userVotes[topicId];
      const prevChoice = prev?.aspectChoices?.[aspect];
      const prevDemo = prev?.voterDemo;

      const updated = topics.map((t) => {
        if (t.id !== topicId) return t;
        const av = { ...(t.aspectVotes ?? {}) };
        const current = av[aspect] ?? { up: 0, down: 0 };
        const next = { ...current };

        if (prevChoice === choice) {
          if (choice === "up") next.up = Math.max(0, next.up - 1);
          else next.down = Math.max(0, next.down - 1);
        } else {
          if (prevChoice === "up") next.up = Math.max(0, next.up - 1);
          if (prevChoice === "down") next.down = Math.max(0, next.down - 1);
          if (choice === "up") next.up++;
          else next.down++;
        }
        av[aspect] = next;

        const isFirstAspectVote = !prev?.aspectChoices || Object.keys(prev.aspectChoices).length === 0;
        let db = t.demoBreakdown ?? {};
        if (isFirstAspectVote && Object.keys(userDemographics).length > 0) {
          db = applyDemoToBreakdown(db, userDemographics, 1);
        }

        return { ...t, aspectVotes: av, demoBreakdown: db };
      });

      const prevChoices = prev?.aspectChoices ?? {};
      const newChoice = prevChoices[aspect] === choice ? undefined : choice;
      const nextChoices = { ...prevChoices };
      if (newChoice === undefined) delete nextChoices[aspect];
      else nextChoices[aspect] = newChoice;

      const newVotes = {
        ...userVotes,
        [topicId]: { ...prev, topicId, aspectChoices: nextChoices, voterDemo: userDemographics },
      };
      saveTopics(updated);
      saveVotes(newVotes);
    },
    [topics, userVotes, userDemographics, saveTopics, saveVotes]
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
        userDemographics,
        addTopic,
        addComment,
        voteYesNo,
        voteRating,
        voteRanking,
        voteAspect,
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
