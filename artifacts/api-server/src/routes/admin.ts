import { Router } from "express";
import { createClerkClient } from "@clerk/backend";
import { db } from "@workspace/db";
import { verificationRequests, users } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;
  return createClerkClient({ secretKey });
}

async function getAuthenticatedUserId(req: any): Promise<string | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);

    const clerk = getClerkClient();
    if (!clerk) {
      // Fallback: decode JWT without verification (dev only)
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
      return payload.sub ?? null;
    }

    const client = await clerk.verifyToken(token, {
      jwtKey: process.env.CLERK_JWT_KEY,
    });
    return client.sub;
  } catch {
    return null;
  }
}

function isAdmin(userId: string): boolean {
  const adminIds = (process.env.ADMIN_CLERK_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId);
}

// POST /admin/verify-requests — submit a verification request
router.post("/admin/verify-requests", async (req: any, res: any) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { userEmail, userName, requestedAccountType, note } = req.body;
    if (!userEmail || !requestedAccountType) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!["company", "celebrity"].includes(requestedAccountType)) {
      return res.status(400).json({ error: "Invalid account type" });
    }

    // Check for existing pending request
    const existing = await db
      .select()
      .from(verificationRequests)
      .where(eq(verificationRequests.userId, userId));

    const pendingOrApproved = existing.find(
      (r) => r.status === "pending" || r.status === "approved"
    );
    if (pendingOrApproved) {
      return res.status(409).json({
        error: "Request already exists",
        status: pendingOrApproved.status,
        requestedAccountType: pendingOrApproved.requestedAccountType,
      });
    }

    const [newRequest] = await db
      .insert(verificationRequests)
      .values({
        id: randomUUID(),
        userId,
        userEmail,
        userName: userName ?? null,
        requestedAccountType,
        status: "pending",
        note: note ?? null,
      })
      .returning();

    res.json({ success: true, request: newRequest });
  } catch (err) {
    console.error("verify-requests POST error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/verify-requests/me — get current user's request status
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
    console.error("verify-requests/me error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /admin/verify-requests — list all requests (admin only)
router.get("/admin/verify-requests", async (req: any, res: any) => {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!isAdmin(userId)) return res.status(403).json({ error: "Forbidden" });

    const requests = await db
      .select()
      .from(verificationRequests)
      .orderBy(desc(verificationRequests.requestedAt));

    res.json({ requests });
  } catch (err) {
    console.error("verify-requests GET error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /admin/verify-requests/:id — approve or reject (admin only)
router.patch("/admin/verify-requests/:id", async (req: any, res: any) => {
  try {
    const adminUserId = await getAuthenticatedUserId(req);
    if (!adminUserId) return res.status(401).json({ error: "Unauthorized" });
    if (!isAdmin(adminUserId)) return res.status(403).json({ error: "Forbidden" });

    const { id } = req.params;
    const { action } = req.body; // "approve" | "reject"
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
      .set({
        status: newStatus,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
      })
      .where(eq(verificationRequests.id, id));

    // If approved, also upsert the users table record as a record-keeping measure
    if (action === "approve") {
      await db
        .insert(users)
        .values({
          id: request.userId,
          email: request.userEmail,
          isPremium: true,
          accountType: request.requestedAccountType,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            isPremium: true,
            accountType: request.requestedAccountType,
          },
        });
    }

    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error("verify-requests PATCH error", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
