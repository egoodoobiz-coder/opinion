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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type VerificationRequest = typeof verificationRequests.$inferSelect;
export type InsertVerificationRequest = typeof verificationRequests.$inferInsert;
export type Admin = typeof admins.$inferSelect;
