# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a Next.js 15 SaaS starter template with integrated authentication (Clerk), real-time database (Convex), and subscription billing (Clerk Billing).

## Development Commands

### Core Development
- `npm run dev` - Start development server with Turbopack on http://localhost:3000
- `npm run build` - Build production bundle
- `npm start` - Start production server
- `npm run lint` - Run Next.js linting

### Convex Development
- `npx convex dev` - Start Convex development server (required for database)
- Run this in a separate terminal alongside `npm run dev`

### Document Parsing (Dolphin Integration)
- `python scripts/setup_dolphin.py` - Setup Dolphin multimodal document parser
- `python scripts/setup_dolphin.py --verify-only` - Verify Dolphin setup without downloading
- `python scripts/test_dolphin.py --file <path>` - Test Dolphin parser on specific file
- `python scripts/test_dolphin.py --batch` - Test Dolphin parser on multiple PDFs
- `python scripts/test_dolphin.py --benchmark` - Run performance benchmark comparison

## Architecture Overview

### Tech Stack
- **Next.js 15** with App Router and Turbopack
- **Convex** for real-time database and serverless functions
- **Clerk** for authentication and user management
- **Clerk Billing** for subscription payments
- **TailwindCSS v4** with custom UI components (shadcn/ui)
- **TypeScript** throughout
- **Dolphin Parser** for advanced multimodal document parsing with enhanced proposal generation

### Key Architectural Patterns

#### Authentication Flow
1. Clerk handles all authentication via `middleware.ts`
2. JWT tokens are configured with "convex" template in Clerk dashboard
3. Users are synced to Convex via webhooks at `/api/clerk-users-webhook`
4. Protected routes redirect unauthenticated users to sign-in

#### Database Architecture
- **Convex** provides real-time sync and serverless functions
- Schema defined in `convex/schema.ts`:
  - `users` table: Synced from Clerk (externalId maps to Clerk ID)
  - `paymentAttempts` table: Tracks subscription payments
- All database operations in `convex/` directory

#### Payment Integration
1. Clerk Billing handles subscription management
2. Custom pricing component in `components/custom-clerk-pricing.tsx`
3. Payment-gated content uses `<ClerkBillingGate>` component
4. Webhook events update payment status in Convex

#### Enhanced Document Processing (Dolphin Integration)
1. **Multi-tiered parsing**: Dolphin (primary) → pdfminer → PyMuPDF → OCR (fallbacks)
2. **Structure preservation**: Tables, formulas, and layout relationships maintained
3. **Proposal enhancement**: Better template analysis and style extraction
4. **Real-time generation**: Enhanced prompts with structure insights for proposal creation

### Project Structure
```
app/
├── (landing)/         # Public landing page components
├── dashboard/         # Protected dashboard area
│   └── payment-gated/ # Subscription-only content
├── layout.tsx         # Root layout with providers
└── middleware.ts      # Auth protection

components/
├── ui/               # shadcn/ui components
├── custom-clerk-pricing.tsx
└── ConvexClientProvider.tsx

convex/
├── schema.ts         # Database schema
├── users.ts          # User CRUD operations
├── paymentAttempts.ts # Payment tracking
├── http.ts           # Webhook handlers
└── auth.config.ts    # JWT configuration

ingestion/
├── dolphin_parser.py # Dolphin multimodal parser integration
├── converters.py     # Enhanced document converters (includes Dolphin)
├── chunker.py        # Document chunking
└── embedder.py       # Vector embeddings

agent/
├── proposal_analyzer.py # Enhanced proposal analysis (Dolphin integration)
├── api.py           # Enhanced proposal generation API
└── ...              # Other agent components

scripts/
├── setup_dolphin.py # Dolphin setup automation
├── test_dolphin.py  # Testing and benchmarking framework
└── ...              # Other utility scripts

docs/
└── DOLPHIN_INTEGRATION.md # Comprehensive integration documentation
```

## Key Integration Points

### Environment Variables Required

#### Core Platform
- `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_FRONTEND_API_URL` (from Clerk JWT template)
- `CLERK_WEBHOOK_SECRET` (set in Convex dashboard)

#### Dolphin Document Parser (Optional)
- `USE_DOLPHIN=1` - Enable/disable Dolphin parser
- `DOLPHIN_MODEL_PATH=./hf_model` - Path to Dolphin model
- `DOLPHIN_PARSING_MODE=page` - Parsing mode ('page' or 'element')
- `DOLPHIN_OUTPUT_FORMAT=markdown` - Output format ('markdown' or 'json')
- `DOLPHIN_CONFIDENCE_THRESHOLD=0.7` - Confidence threshold for parsing
- `POPPLER_PATH` - Path to Poppler utilities (for PDF conversion)
- `OCR_PDF=0` - Enable OCR fallback for PDFs

### Webhook Configuration
Clerk webhooks must be configured to:
- Endpoint: `{your_domain}/api/clerk-users-webhook`
- Events: `user.created`, `user.updated`, `user.deleted`, `paymentAttempt.updated`

### Real-time Data Flow
1. UI components use Convex hooks (`useQuery`, `useMutation`)
2. Convex provides automatic real-time updates
3. Authentication context from `useAuth()` (Clerk)
4. User data synced between Clerk and Convex

## Shadcn Component Installation Rules
When installing shadcn/ui components:
- ALWAYS use `bunx --bun shadcn@latest add [component-name]` instead of `npx`
- If dependency installation fails, manually install with `bun install [dependency-name]`
- Check components.json for existing configuration before installing
- Verify package.json after installation to ensure dependencies were added
- Multiple components can be installed at once: `bunx --bun shadcn@latest add button card drawer`
