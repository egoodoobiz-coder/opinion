import { Router, type IRouter } from "express";
import { verifyToken } from "@clerk/backend";
import { db } from "@workspace/db";
import { contentReports } from "@workspace/db/schema";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// "child_safety" is first deliberately — Google's child safety standards policy
// requires an explicit, prominent way to report CSAE concerns.
export const REPORT_REASONS = [
  "child_safety",
  "sexual_content",
  "harassment",
  "hate_speech",
  "violence",
  "spam",
  "other",
] as const;

const CONTENT_TYPES = ["topic", "comment"] as const;

const MAX_DETAILS_LENGTH = 1000;
const MAX_SNAPSHOT_LENGTH = 2000;
const MAX_NAME_LENGTH = 200;
const MAX_ID_LENGTH = 200;

// Reporting must work for signed-out users, so a missing/invalid token is not an
// error here — it just means the report is filed anonymously.
async function getOptionalUserId(req: any): Promise<string | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
    const payload = await verifyToken(authHeader.slice(7), {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

function isStr(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}

// POST /reports — file a report against a topic or comment
router.post("/reports", async (req: any, res: any) => {
  try {
    const reporterId = await getOptionalUserId(req);
    const { contentType, contentId, topicId, reason, details, contentSnapshot, authorName } = req.body ?? {};

    if (!CONTENT_TYPES.includes(contentType)) {
      return res.status(400).json({ error: "Invalid contentType" });
    }
    if (!isStr(contentId, MAX_ID_LENGTH)) {
      return res.status(400).json({ error: "contentId required" });
    }
    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ error: "Invalid reason" });
    }
    if (details !== undefined && details !== null && details !== "" && !isStr(details, MAX_DETAILS_LENGTH)) {
      return res.status(400).json({ error: "Details too long" });
    }
    if (contentSnapshot !== undefined && contentSnapshot !== null && contentSnapshot !== "" && !isStr(contentSnapshot, MAX_SNAPSHOT_LENGTH)) {
      return res.status(400).json({ error: "Content snapshot too long" });
    }
    if (topicId !== undefined && topicId !== null && topicId !== "" && !isStr(topicId, MAX_ID_LENGTH)) {
      return res.status(400).json({ error: "Invalid topicId" });
    }
    if (authorName !== undefined && authorName !== null && authorName !== "" && !isStr(authorName, MAX_NAME_LENGTH)) {
      return res.status(400).json({ error: "Invalid authorName" });
    }

    const [row] = await db
      .insert(contentReports)
      .values({
        id: randomUUID(),
        reporterId,
        contentType,
        contentId,
        topicId: topicId || null,
        reason,
        details: details || null,
        contentSnapshot: contentSnapshot || null,
        authorName: authorName || null,
        status: "open",
      })
      .returning();

    // Child safety reports are the highest-severity category — log at warn so they
    // stand out in the server logs even before the admin panel is checked.
    if (reason === "child_safety") {
      logger.warn({ reportId: row.id, contentType, contentId }, "CHILD SAFETY report filed");
    } else {
      logger.info({ reportId: row.id, contentType, reason }, "Content report filed");
    }

    res.json({ success: true, reportId: row.id });
  } catch (err) {
    logger.error({ err }, "reports POST error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
