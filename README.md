# Austin Vet Affordability Finder

A web application that helps Austin pet owners find veterinary clinics with transparent pricing and consumer-friendly financing options. Every claim is backed by evidence from automated website crawling.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)

## Features

- **🔍 Automated Discovery**: Find Austin vet clinics via Google Places API
- **🕷️ Smart Crawling**: Extracts financing and pricing signals from clinic websites
- **💰 Financing Taxonomy**: Ranks payment options from best (Tier A) to worst (Tier E)
- **📊 Transparency Scoring**: 0-100 score based on published prices and estimate promises
- **📝 Evidence-Backed**: Every claim links to source page with verification date
- **🎨 Calm Design**: Reassuring UI for stressed pet owners

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- (Optional) Google Places API key for clinic discovery

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/austin-vet-finder.git
cd austin-vet-finder

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and settings

# Generate Prisma client and create database tables
npx prisma generate
npx prisma db push

# Seed the database with sample clinics
npm run db:seed

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app.

### Environment Variables

Create a `.env` file with:

```env
# Required
DATABASE_URL="postgresql://user:password@localhost:5432/austin_vet_finder"

# Optional
ADMIN_PASSWORD="your-secure-password"  # Default: admin123
GOOGLE_PLACES_API_KEY="your-api-key"   # For clinic discovery
```

## Project Structure

```
austin-vet-finder/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Landing page
│   ├── search/            # Search results page
│   ├── clinic/[id]/       # Clinic detail page
│   ├── admin/             # Admin dashboard
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── clinic-card.tsx   # Main clinic card component
├── lib/                   # Utilities
│   ├── crawler.ts        # Web crawler engine
│   ├── db.ts             # Prisma client
│   └── utils.ts          # Helper functions
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── seed.ts           # Seed script
└── scripts/
    ├── crawl.ts          # Manual crawl script
    └── discover-clinics.ts # Google Places discovery
```

## Financing Taxonomy

Clinics are ranked by their financing options:

| Tier | Description | Examples |
|------|-------------|----------|
| **A** | No/Low interest, no gotchas | In-house 0% plans, Cherry Pay-in-4, Wellness plans |
| **B** | Fixed APR, transparent | Affirm (0-36% APR), Scratchpay |
| **C** | High APR possible or unclear | Generic "financing available" |
| **D** | Deferred interest risk | CareCredit promo financing |
| **E** | None detected | No financing signals found |

## Transparency Scoring

| Signal | Points |
|--------|--------|
| Published price list/table | +60 |
| Concrete price disclosed (exam fee, etc.) | +30 |
| Written estimate promise | +20 |
| "Transparent pricing" mention | +10 |

## Available Scripts

```bash
# Development
npm run dev           # Start dev server
npm run build         # Build for production
npm run start         # Start production server
npm run lint          # Run ESLint

# Database
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database
npm run db:migrate    # Run migrations
npm run db:seed       # Seed with sample data

# Crawling
npm run crawl                     # Crawl all clinics
npm run crawl -- --clinic=ID      # Crawl single clinic
npm run crawl -- --limit=10       # Limit to N clinics
npm run crawl:discover            # Discover clinics via Google Places
```

## Admin Dashboard

Access the admin dashboard at `/admin` (password protected):

- View crawl statistics
- Trigger re-crawls for individual or all clinics
- View extraction logs and evidence

## API Routes

### Public

- `GET /api/clinics` - List clinics with filtering
  - `?search=term` - Search by name/address
  - `?tier=A,B` - Filter by financing tier
  - `?minTransparency=50` - Minimum transparency score
  - `?sortBy=affordability|transparency|name`

### Admin

- `GET /api/admin/stats` - Dashboard statistics
- `GET /api/admin/clinics` - All clinics (admin view)
- `POST /api/admin/crawl` - Trigger crawl
  - `{ clinicId?: string }` - Specific clinic or all

## Crawler Behavior

The crawler respects website owners:

- ✅ Respects robots.txt
- ✅ 2-second delay between requests to same domain
- ✅ Max 30 pages per clinic
- ✅ Max depth of 2-3 levels
- ✅ Clear User-Agent identification
- ✅ Stays on same domain only

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

### Database

Recommended options:
- [Vercel Postgres](https://vercel.com/storage/postgres)
- [Supabase](https://supabase.com)
- [Railway](https://railway.app)

### Scheduled Crawling

Options for automated re-crawls:
- GitHub Actions cron job
- Vercel Cron Jobs (Pro plan)
- Separate worker on Fly.io/Render

## Disclaimers

This application displays the following disclaimers:

- "We are not a lender. We don't provide financial advice."
- "Financing terms depend on credit approval and may change."
- "Always confirm details directly with the clinic and provider."

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Styling**: Tailwind CSS + shadcn/ui
- **Animations**: Framer Motion
- **Scraping**: Cheerio (+ Playwright for dynamic sites)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built with ❤️ for Austin pet owners
