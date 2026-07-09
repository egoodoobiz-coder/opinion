import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type VerificationRequest = typeof verificationRequests.$inferSelect;
export type InsertVerificationRequest = typeof verificationRequests.$inferInsert;
export type Admin = typeof admins.$inferSelect;
export type DeletionRequest = typeof deletionRequests.$inferSelect;
export type ContentReport = typeof contentReports.$inferSelect;
export type InsertContentReport = typeof contentReports.$inferInsert;
