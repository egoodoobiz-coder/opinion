import { pgTable, text, boolean, timestamp, integer, serial, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

// voiceType: "expert" | "brand" | "public" | "creator" | null
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  isPremium: boolean("is_premium").default(false),
  isVerified: boolean("is_verified").default(false),
  voiceType: text("voice_type"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const verificationRequests = pgTable("verification_requests", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  userEmail: text("user_email").notNull(),
  userName: text("user_name"),
  requestedVoiceType: text("requested_voice_type").notNull(), // "expert" | "brand" | "public" | "creator"
  status: text("status").notNull().default("pending"), // "pending" | "approved" | "rejected"
  note: text("note"),
  reviewedBy: text("reviewed_by"),
  requestedAt: timestamp("requested_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const admins = pgTable("admins", {
  userId: text("user_id").primaryKey(),
  userEmail: text("user_email"),
  grantedAt: timestamp("granted_at").defaultNow(),
});

// Account deletion requests submitted via the public /delete-account page
// (required by Google Play's data-deletion policy)
export const deletionRequests = pgTable("deletion_requests", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  status: text("status").notNull().default("pending"), // "pending" | "completed"
  requestedAt: timestamp("requested_at").defaultNow(),
});

// In-app reports of topics or comments. Required by Google Play's User Generated
// Content and child safety standards policies.
//
// Topics and comments currently live only in the reporter's device storage, so the
// server cannot look the content up by id. The reporter's client sends a snapshot of
// the text along with the report — without it a report is not actionable.
export const contentReports = pgTable("content_reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id"), // null when reported while signed out
  contentType: text("content_type").notNull(), // "topic" | "comment"
  contentId: text("content_id").notNull(),
  topicId: text("topic_id"), // parent topic when contentType = "comment"
  reason: text("reason").notNull(), // see REPORT_REASONS in the API
  details: text("details"),
  contentSnapshot: text("content_snapshot"),
  authorName: text("author_name"),
  status: text("status").notNull().default("open"), // "open" | "reviewed" | "actioned"
  createdAt: timestamp("created_at").defaultNow(),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
});

// ── Shared opinion data (server migration) ──────────────────────────────────
// Topics/votes/comments used to live only in each device's AsyncStorage, so the
// app was single-player and the website had nothing to show. These tables make
// the server the one source of truth the app and website both read.

// Aggregate columns are denormalised onto the topic (updated transactionally when
// a vote is cast) so the feed and website read fast without recomputing.
export const topics = pgTable("topics", {
  id: text("id").primaryKey(),
  topicNumber: serial("topic_number").notNull(),
  title: text("title").notNull(),
  description: text("description").default(""),
  category: text("category").notNull(),
  votingType: text("voting_type").notNull(), // "yesno" | "rating" | "ranking" | "aspects"
  rankingOptions: jsonb("ranking_options"), // { id, label }[]
  aspects: jsonb("aspects"), // string[]
  hashtags: jsonb("hashtags"), // string[]
  linkUrl: text("link_url"),
  targetDemographics: jsonb("target_demographics"),
  createdBy: text("created_by").notNull(),
  createdByName: text("created_by_name"),
  voiceType: text("voice_type"),
  createdAt: timestamp("created_at").defaultNow(),
  // denormalised aggregates
  yesCount: integer("yes_count").notNull().default(0),
  noCount: integer("no_count").notNull().default(0),
  totalRating: integer("total_rating").notNull().default(0),
  ratingCount: integer("rating_count").notNull().default(0),
  rankingVotes: jsonb("ranking_votes").notNull().default({}), // { optionId: number[] }
  aspectVotes: jsonb("aspect_votes").notNull().default({}), // { aspect: { up, down } }
  demoBreakdown: jsonb("demo_breakdown").notNull().default({}),
});

// One row per user per topic — the current vote. Lets us return "your vote",
// enforce a single vote, and reverse a prior vote's contribution on change.
export const topicVotes = pgTable(
  "topic_votes",
  {
    id: text("id").primaryKey(),
    topicId: text("topic_id").notNull(),
    userId: text("user_id").notNull(),
    yesno: text("yesno"), // "yes" | "no" | null
    rating: integer("rating"),
    ranking: jsonb("ranking"), // string[]
    aspectChoices: jsonb("aspect_choices"), // { aspect: "up" | "down" }
    voterDemo: jsonb("voter_demo"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => ({
    userTopicUnique: uniqueIndex("topic_votes_user_topic_idx").on(t.topicId, t.userId),
  })
);

export const topicComments = pgTable("topic_comments", {
  id: text("id").primaryKey(),
  topicId: text("topic_id").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Topic = typeof topics.$inferSelect;
export type InsertTopic = typeof topics.$inferInsert;
export type TopicVote = typeof topicVotes.$inferSelect;
export type TopicComment = typeof topicComments.$inferSelect;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type VerificationRequest = typeof verificationRequests.$inferSelect;
export type InsertVerificationRequest = typeof verificationRequests.$inferInsert;
export type Admin = typeof admins.$inferSelect;
export type DeletionRequest = typeof deletionRequests.$inferSelect;
export type ContentReport = typeof contentReports.$inferSelect;
export type InsertContentReport = typeof contentReports.$inferInsert;
