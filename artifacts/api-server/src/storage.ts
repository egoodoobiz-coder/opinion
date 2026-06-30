import { users } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  metadata: Record<string, string> | null;
}

export interface StripePrice {
  id: string;
  product: string;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string; interval_count: number } | null;
  active: boolean;
  metadata: Record<string, string> | null;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  current_period_end: number | null;
  cancel_at_period_end: boolean;
}

export interface ProductWithPrices extends StripeProduct {
  prices: StripePrice[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the Stripe sync schema tables exist in the DB.
 * Stripe tables live in the `stripe` schema, synced by the Replit connector.
 * Locally they won't exist, so we check before querying.
 */
async function stripeSchemaExists(): Promise<boolean> {
  try {
    const result = await db.execute(
      sql`SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'stripe' AND table_name = 'products' LIMIT 1`
    );
    return (result.rows?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// ─── Storage class ────────────────────────────────────────────────────────────

export class Storage {
  // ── Stripe: products ────────────────────────────────────────────────────────

  async getProduct(productId: string): Promise<StripeProduct | null> {
    if (!(await stripeSchemaExists())) return null;
    try {
      const result = await db.execute(
        sql`SELECT * FROM stripe.products WHERE id = ${productId}`
      );
      return (result.rows[0] as StripeProduct) ?? null;
    } catch {
      return null;
    }
  }

  async listProducts(
    active = true,
    limit = 20,
    offset = 0
  ): Promise<StripeProduct[]> {
    if (!(await stripeSchemaExists())) return [];
    try {
      const result = await db.execute(
        sql`SELECT * FROM stripe.products
            WHERE active = ${active}
            LIMIT ${limit} OFFSET ${offset}`
      );
      return result.rows as StripeProduct[];
    } catch {
      return [];
    }
  }

  async listProductsWithPrices(
    active = true,
    limit = 20,
    offset = 0
  ): Promise<ProductWithPrices[]> {
    if (!(await stripeSchemaExists())) return [];
    try {
      const result = await db.execute(
        sql`
          WITH paginated_products AS (
            SELECT id, name, description, metadata, active
            FROM stripe.products
            WHERE active = ${active}
            ORDER BY id
            LIMIT ${limit} OFFSET ${offset}
          )
          SELECT
            p.id            AS product_id,
            p.name          AS product_name,
            p.description   AS product_description,
            p.active        AS product_active,
            p.metadata      AS product_metadata,
            pr.id           AS price_id,
            pr.unit_amount,
            pr.currency,
            pr.recurring,
            pr.active       AS price_active,
            pr.metadata     AS price_metadata
          FROM paginated_products p
          LEFT JOIN stripe.prices pr
            ON pr.product = p.id AND pr.active = true
          ORDER BY p.id, pr.unit_amount
        `
      );

      const productsMap = new Map<string, ProductWithPrices>();
      for (const row of result.rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description ?? null,
            active: row.product_active,
            metadata: row.product_metadata ?? null,
            prices: [],
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id)!.prices.push({
            id: row.price_id,
            product: row.product_id,
            unit_amount: row.unit_amount ?? null,
            currency: row.currency,
            recurring: row.recurring ?? null,
            active: row.price_active,
            metadata: row.price_metadata ?? null,
          });
        }
      }
      return Array.from(productsMap.values());
    } catch {
      return [];
    }
  }

  // ── Stripe: prices ──────────────────────────────────────────────────────────

  async getPrice(priceId: string): Promise<StripePrice | null> {
    if (!(await stripeSchemaExists())) return null;
    try {
      const result = await db.execute(
        sql`SELECT * FROM stripe.prices WHERE id = ${priceId}`
      );
      return (result.rows[0] as StripePrice) ?? null;
    } catch {
      return null;
    }
  }

  async listPrices(
    active = true,
    limit = 20,
    offset = 0
  ): Promise<StripePrice[]> {
    if (!(await stripeSchemaExists())) return [];
    try {
      const result = await db.execute(
        sql`SELECT * FROM stripe.prices
            WHERE active = ${active}
            LIMIT ${limit} OFFSET ${offset}`
      );
      return result.rows as StripePrice[];
    } catch {
      return [];
    }
  }

  async getPricesForProduct(productId: string): Promise<StripePrice[]> {
    if (!(await stripeSchemaExists())) return [];
    try {
      const result = await db.execute(
        sql`SELECT * FROM stripe.prices
            WHERE product = ${productId} AND active = true`
      );
      return result.rows as StripePrice[];
    } catch {
      return [];
    }
  }

  // ── Stripe: subscriptions ───────────────────────────────────────────────────

  async getSubscription(
    subscriptionId: string
  ): Promise<StripeSubscription | null> {
    if (!(await stripeSchemaExists())) return null;
    try {
      const result = await db.execute(
        sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
      );
      return (result.rows[0] as StripeSubscription) ?? null;
    } catch {
      return null;
    }
  }

  async getSubscriptionByCustomerId(
    customerId: string
  ): Promise<StripeSubscription | null> {
    if (!(await stripeSchemaExists())) return null;
    try {
      const result = await db.execute(
        sql`SELECT * FROM stripe.subscriptions
            WHERE customer = ${customerId}
              AND status = 'active'
            LIMIT 1`
      );
      return (result.rows[0] as StripeSubscription) ?? null;
    } catch {
      return null;
    }
  }

  // ── Users ───────────────────────────────────────────────────────────────────

  async getUser(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user ?? null;
  }

  async upsertUser(userData: { id: string; email?: string }) {
    const [user] = await db
      .insert(users)
      .values({
        id: userData.id,
        email: userData.email ?? null,
      })
      .onConflictDoUpdate({
        target: users.id,
        // Only update email if provided — don't clobber existing fields
        set: {
          ...(userData.email !== undefined ? { email: userData.email } : {}),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(
    userId: string,
    stripeInfo: {
      stripeCustomerId?: string;
      stripeSubscriptionId?: string;
      isPremium?: boolean;
      accountType?: string;
    }
  ) {
    // Strip undefined values so we don't accidentally null out existing fields
    const patch = Object.fromEntries(
      Object.entries(stripeInfo).filter(([, v]) => v !== undefined)
    ) as typeof stripeInfo;

    if (Object.keys(patch).length === 0) {
      return this.getUser(userId);
    }

    const [user] = await db
      .update(users)
      .set(patch)
      .where(eq(users.id, userId))
      .returning();
    return user ?? null;
  }
}

export const storage = new Storage();
