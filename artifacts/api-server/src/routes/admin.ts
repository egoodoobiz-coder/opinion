import { Router } from "express";
import { createClerkClient } from "@clerk/backend";
import { db } from "@workspace/db";
import { verificationRequests, users, admins } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";

const router = Router();

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;
const MAX_NOTE_LENGTH = 1000;
const MAX_NAME_LENGTH = 200;

async function getAuthenticatedUserId(req: any): Promise<string | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    const payload = await clerk.verifyToken(token);
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// Check if a userId is an admin in the DB
async function checkIsAdmin(userId: string): Promise<boolean> {
  const rows = await db.select().from(admins).where(eq(admins.userId, userId));
  return rows.length > 0;
}

// GET /admin/admins — list all admins (admin only)
router.get("/admin/admins", async (req: any, res: any) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await checkIsAdmin(userId))) return res.status(403).json({ error: "Forbidden" });

    const rows = await db.select().from(admins);
    res.json({ admins: rows });
  } catch (err) {
    logger.error({ err }, "admin/admins GET error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/grant — grant admin to another user by email (admin only)
router.post("/admin/grant", async (req: any, res: any) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await checkIsAdmin(userId))) return res.status(403).json({ error: "Forbidden" });

    const { userEmail } = req.body;
    if (!userEmail || typeof userEmail !== "string") {
      return res.status(400).json({ error: "userEmail required" });
    }

    const clerkUsers = await clerk.users.getUserList({ emailAddress: [userEmail] });
    if (!clerkUsers.data.length) {
      return res.status(404).json({ error: "No user found with that email — they must sign in at least once first" });
    }

    const targetId = clerkUsers.data[0].id;
    const already = await checkIsAdmin(targetId);
    if (already) {
      return res.json({ success: true, message: "Already an admin", userId: targetId });
    }

    await db.insert(admins).values({ userId: targetId, userEmail });
    logger.info({ grantedBy: userId, targetId, userEmail }, "Admin granted");
    res.json({ success: true, message: "Admin access granted", userId: targetId });
  } catch (err) {
    logger.error({ err }, "admin/grant error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /admin/revoke/:userId — revoke admin (admin only, cannot revoke self)
router.delete("/admin/revoke/:targetId", async (req: any, res: any) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await checkIsAdmin(userId))) return res.status(403).json({ error: "Forbidden" });

    const { targetId } = req.params;
    if (targetId === userId) {
      return res.status(400).json({ error: "You cannot revoke your own admin access" });
    }

    await db.delete(admins).where(eq(admins.userId, targetId));
    logger.info({ revokedBy: userId, targetId }, "Admin revoked");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "admin/revoke error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/seed — grant admin by email using setup secret (no JWT required)
router.post("/admin/seed", async (req: any, res: any) => {
  try {
    const { secret, userEmail } = req.body;
    const adminSecret = process.env.ADMIN_SETUP_SECRET;

    if (!adminSecret || !secret || secret.trim() !== adminSecret) {
      return res.status(403).json({ error: "Invalid admin secret" });
    }
    if (!userEmail || typeof userEmail !== "string") {
      return res.status(400).json({ error: "userEmail required" });
    }

    const clerkUsers = await clerk.users.getUserList({ emailAddress: [userEmail] });
    if (!clerkUsers.data.length) {
      return res.status(404).json({ error: "No Clerk user found with that email — make sure they have signed in at least once" });
    }

    const userId = clerkUsers.data[0].id;
    const alreadyAdmin = await checkIsAdmin(userId);
    if (alreadyAdmin) {
      return res.json({ success: true, message: "Already an admin", userId });
    }

    await db.insert(admins).values({ userId, userEmail });
    logger.info({ userId, userEmail }, "Admin seeded via /admin/seed");
    res.json({ success: true, message: "Admin access granted", userId });
  } catch (err) {
    logger.error({ err }, "admin/seed error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/claim — grant admin access using the setup secret
router.post("/admin/claim", async (req: any, res: any) => {
  try {
    const { secret, userEmail } = req.body;
    const adminSecret = process.env.ADMIN_SETUP_SECRET;

    if (!adminSecret || !secret || secret.trim() !== adminSecret) {
      return res.status(403).json({ error: "Invalid admin secret" });
    }

    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Could not identify user — please sign out and back in" });
    }

    const alreadyAdmin = await checkIsAdmin(userId);
    if (alreadyAdmin) {
      return res.json({ success: true, message: "Already an admin" });
    }

    await db.insert(admins).values({ userId, userEmail: userEmail ?? null });
    logger.info({ userId }, "Admin access granted");
    res.json({ success: true, message: "Admin access granted" });
  } catch (err) {
    logger.error({ err }, "admin/claim error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/is-admin — check if current user is admin
router.get("/admin/is-admin", async (req: any, res: any) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const isAdmin = await checkIsAdmin(userId);
    res.json({ isAdmin });
  } catch (err) {
    logger.error({ err }, "admin/is-admin error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /admin/verify-requests — submit a verification request
router.post("/admin/verify-requests", async (req: any, res: any) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { userEmail, userName, requestedVoiceType, note } = req.body;

    if (!userEmail || !requestedVoiceType) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (typeof userEmail !== "string" || userEmail.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(userEmail)) {
      return res.status(400).json({ error: "Invalid email address" });
    }
    if (!["expert", "brand", "public", "creator"].includes(requestedVoiceType)) {
      return res.status(400).json({ error: "Invalid voice type" });
    }
    if (userName !== undefined && (typeof userName !== "string" || userName.length > MAX_NAME_LENGTH)) {
      return res.status(400).json({ error: "Invalid username" });
    }
    if (note !== undefined && (typeof note !== "string" || note.length > MAX_NOTE_LENGTH)) {
      return res.status(400).json({ error: "Note too long" });
    }

    const existing = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.userId, userId));

    const active = existing.find((r) => r.status === "pending" || r.status === "approved");
    if (active) {
      return res.status(409).json({
        error: "Request already exists",
        status: active.status,
        requestedVoiceType: active.requestedVoiceType,
      });
    }

    const [newRequest] = await db
      .insert(verificationRequests)
      .values({
        id: randomUUID(),
        userId,
        userEmail,
        userName: userName ?? null,
        requestedVoiceType,
        status: "pending",
        note: note ?? null,
      })
      .returning();

    res.json({ success: true, request: newRequest });
  } catch (err) {
    logger.error({ err }, "verify-requests POST error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/verify-requests/me — current user's request status
router.get("/admin/verify-requests/me", async (req: any, res: any) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const requests = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.userId, userId))
      .orderBy(desc(verificationRequests.requestedAt));

    res.json({ requests });
  } catch (err) {
    logger.error({ err }, "verify-requests/me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/verify-requests — list all requests (admin only)
router.get("/admin/verify-requests", async (req: any, res: any) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await checkIsAdmin(userId))) return res.status(403).json({ error: "Forbidden" });

    const requests = await db
      .select()
      .from(verificationRequests)
      .orderBy(desc(verificationRequests.requestedAt));

    res.json({ requests });
  } catch (err) {
    logger.error({ err }, "verify-requests GET error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /admin/verify-requests/:id — approve or reject (admin only)
router.patch("/admin/verify-requests/:id", async (req: any, res: any) => {
  try {
    const adminUserId = await getAuthenticatedUserId(req);
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await checkIsAdmin(adminUserId))) return res.status(403).json({ error: "Forbidden" });

    const { id } = req.params;
    const { action } = req.body;
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "Invalid action" });
    }

    const [request] = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.id, id));

    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending") {
      return res.status(409).json({ error: "Request already reviewed" });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    await db
      .update(verificationRequests)
      .set({ status: newStatus, reviewedBy: adminUserId, reviewedAt: new Date() })
      .where(eq(verificationRequests.id, id));

    if (action === "approve") {
      await db
        .insert(users)
        .values({
          id: request.userId,
          email: request.userEmail,
          isPremium: true,
          isVerified: true,
          voiceType: request.requestedVoiceType,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: { isPremium: true, isVerified: true, voiceType: request.requestedVoiceType },
        });
    }

    res.json({ success: true, status: newStatus });
  } catch (err) {
    logger.error({ err }, "verify-requests PATCH error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
