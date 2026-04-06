# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## App: Opinion (Mobile)

Mobile app built with Expo/React Native. Key features:
- Clerk auth (email + Google OAuth)
- Premium accounts (Company/Celebrity) with verified badges
- Promoted topics in feed for premium users
- Analytics panel for premium users
- Premium upgrade screen at `artifacts/mobile/app/upgrade.tsx`

### Stripe Payment Setup (Incomplete)

Stripe is partially wired but **not yet connected**. The Replit Stripe connector was dismissed by the user.

Current state:
- `stripe` and `stripe-replit-sync` packages installed at workspace root
- API server has Stripe routes: `/api/checkout`, `/api/products-with-prices`, `/api/subscription`, `/api/checkout-verify`
- `stripeClient.ts` is a placeholder — must be replaced with real template after Stripe is connected
- **Fallback active**: premium upgrade works without payment by directly updating Clerk `unsafeMetadata`

To complete Stripe setup:
1. Either reconnect via Integrations panel (connector: `ccfg_stripe_01K611P4YQR0SZM11XFRQJC44Y`) — or ask user for `STRIPE_SECRET_KEY` to store as a secret
2. Get `stripeClient.ts` template from `addIntegration` rendered content
3. Run `pnpm --filter @workspace/scripts exec tsx src/seed-products.ts` to create Company/Celebrity products in Stripe
4. Restart API server

### Key Env Vars (Mobile)

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — set from `CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_API_URL` — set to `https://$REPLIT_DEV_DOMAIN/artifacts/api-server`
- `EXPO_PUBLIC_DOMAIN` — the Replit dev domain
