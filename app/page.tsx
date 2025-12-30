export const dynamic = 'force-dynamic';

import prisma from '@/lib/db';
import { ClinicCard } from '@/components/clinic-card';
import { Trophy, CreditCard, FileText, MapPin } from 'lucide-react';

// Types for categorized clinics
interface ExtractedPrice {
  id: string;
  serviceType: string;
  serviceName: string | null;
  minPrice: number;
  maxPrice: number | null;
}

interface ClinicWithData {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string | null;
  phone: string | null;
  websiteUrl: string | null;
  financingTier: string | null;
  transparencyScore: number | null;
  lastVerifiedAt: Date | null;
  rating: number | null;
  ratingCount: number | null;
  placeId: string | null;
  evidence: {
    id: string;
    category: string;
    label: string;
    snippet: string;
    sourceUrl: string;
  }[];
  extractedPrices: ExtractedPrice[];
  _count: {
    communityReports: number;
  };
}

interface CategorizedClinics {
  lowCostNonprofit: ClinicWithData[];
  bnpl: ClinicWithData[];
  publishesPricing: ClinicWithData[];
  promotionalFinancing: ClinicWithData[];  // Scratchpay/CareCredit
  nothingFound: ClinicWithData[];           // No financing info found
}

// Low-cost benchmark thresholds (in cents)
// Based on Emancipet pricing: exam $20, vaccines $17
const LOW_COST_THRESHOLDS = {
  exam: 5000,        // $50 or less = low-cost
  vaccines: 3000,    // $30 or less = low-cost
};

// Verified nonprofit/low-cost organizations (exact matches or known patterns)
const VERIFIED_LOW_COST = [
  'emancipet',
  'humane society',
  'austin humane',
  'austin pets alive',
  'thrive affordable vet care',  // Specific Thrive low-cost brand
  'affordable pet care',          // Known legitimate low-cost clinic
];

// Patterns that indicate a vaccine-only clinic (not full-service vet care)
const VACCINE_CLINIC_PATTERNS = [
  'vaccine clinic',
  'vaccination clinic',
  'vaccine event',
  'shot clinic',
  'low cost shots',
  'vaccine services',
  'mobile vaccines',
  'vaccine station',
  'rabies clinic',
  'vetco vaccination',    // Vetco vaccination clinics (not Vetco Total Care)
  'vip petcare',          // VIP Petcare vaccination clinics
  'pet vaccines',         // e.g., "Prickly Pear Pet Vaccines"
];

// Service types that indicate full-service vet care (not just vaccines)
const FULL_SERVICE_TYPES = ['exam', 'spay_neuter', 'dental', 'bloodwork', 'xray', 'emergency'];

// Check if clinic is a vaccine-only clinic (not full-service vet care)
function isVaccineOnlyClinic(clinic: ClinicWithData): boolean {
  const nameLower = clinic.name.toLowerCase();

  // Check name patterns
  if (VACCINE_CLINIC_PATTERNS.some(pattern => nameLower.includes(pattern))) {
    return true;
  }

  // If clinic has extracted prices, check if they ONLY have vaccine-related services
  if (clinic.extractedPrices.length > 0) {
    const hasFullServicePricing = clinic.extractedPrices.some(
      p => FULL_SERVICE_TYPES.includes(p.serviceType)
    );
    // If they only have vaccines/microchip/heartworm/fecal (no exam, surgery, dental, etc.)
    if (!hasFullServicePricing) {
      return true;
    }
  }

  return false;
}

// Check if clinic is a verified nonprofit or low-cost provider
// STRICT: Only include verified organizations or those with confirmed low pricing
function isLowCostNonprofit(clinic: ClinicWithData): boolean {
  const nameLower = clinic.name.toLowerCase();

  // Only include verified low-cost organizations (strict matching)
  if (VERIFIED_LOW_COST.some(org => nameLower.includes(org))) {
    return true;
  }

  // Price-based verification: REQUIRE verified low pricing to be included
  // This prevents scam/unknown clinics from appearing in low-cost section
  const examPrice = clinic.extractedPrices.find(p => p.serviceType === 'exam');

  // Only if we have VERIFIED exam pricing under threshold
  if (examPrice && examPrice.minPrice <= LOW_COST_THRESHOLDS.exam) {
    // Exclude corporate chains and specialty hospitals
    const excludePatterns = ['vca', 'specialty', 'emergency', 'banfield', 'thrive pet healthcare'];
    if (!excludePatterns.some(p => nameLower.includes(p))) {
      return true;
    }
  }

  return false;
}

// Check if clinic has Tier 1 BNPL options (Cherry, Sunbit, Affirm, VetBilling)
function hasTier1BNPL(clinic: ClinicWithData): boolean {
  const tier = clinic.financingTier;
  // New tier system: '1' = best BNPL
  // Legacy tier system: 'A' = was best, check evidence for actual providers
  if (tier === '1') return true;

  // For legacy tier A, check if it's actually a Tier 1 provider
  if (tier === 'A') {
    const evidenceLabels = clinic.evidence.map(e => e.label.toUpperCase());
    const tier1Providers = ['CHERRY', 'SUNBIT', 'AFFIRM', 'VETBILLING'];
    return tier1Providers.some(p => evidenceLabels.some(l => l.includes(p)));
  }

  // Check evidence directly for Tier 1 providers even if tier not set
  const evidenceLabels = clinic.evidence.map(e => e.label.toUpperCase());
  const tier1Providers = ['CHERRY', 'SUNBIT', 'AFFIRM', 'VETBILLING'];
  return tier1Providers.some(p => evidenceLabels.some(l => l.includes(p)));
}

// Check if clinic publishes pricing - must have actual extracted prices
function publishesPricing(clinic: ClinicWithData): boolean {
  return clinic.extractedPrices.length > 0;
}

// Check if clinic has Tier 2 financing (Scratchpay, CareCredit - deferred interest risk)
// Only checks evidence for actual Scratchpay/CareCredit - wellness plans don't count
function hasTier2Financing(clinic: ClinicWithData): boolean {
  const evidenceLabels = clinic.evidence.map(e => e.label.toUpperCase());
  return evidenceLabels.some(l => l.includes('SCRATCHPAY') || l.includes('CARECREDIT'));
}

// Categorize clinics with new structure
function categorizeClinics(clinics: ClinicWithData[]): CategorizedClinics {
  const lowCostNonprofit: ClinicWithData[] = [];
  const bnpl: ClinicWithData[] = [];
  const publishesPricingArr: ClinicWithData[] = [];
  const promotionalFinancing: ClinicWithData[] = [];
  const nothingFound: ClinicWithData[] = [];

  for (const clinic of clinics) {
    // Skip vaccine-only clinics - they're not full-service vet care
    if (isVaccineOnlyClinic(clinic)) {
      continue;
    }

    // Priority 1: Low-cost/nonprofit always goes to that category
    if (isLowCostNonprofit(clinic)) {
      lowCostNonprofit.push(clinic);
    }
    // Priority 2: Tier 1 BNPL (Cherry, Sunbit, Affirm, VetBilling)
    else if (hasTier1BNPL(clinic)) {
      bnpl.push(clinic);
    }
    // Priority 3: Publishes pricing (but not BNPL or nonprofit)
    else if (publishesPricing(clinic)) {
      publishesPricingArr.push(clinic);
    }
    // Priority 4: Tier 2 financing (Scratchpay/CareCredit)
    else if (hasTier2Financing(clinic)) {
      promotionalFinancing.push(clinic);
    }
    // Everything else - no financing info found
    else {
      nothingFound.push(clinic);
    }
  }

  // Sort each category
  lowCostNonprofit.sort((a, b) => (b.transparencyScore ?? 0) - (a.transparencyScore ?? 0));
  bnpl.sort((a, b) => (b.transparencyScore ?? 0) - (a.transparencyScore ?? 0));
  publishesPricingArr.sort((a, b) => (b.transparencyScore ?? 0) - (a.transparencyScore ?? 0));
  promotionalFinancing.sort((a, b) => a.name.localeCompare(b.name));
  nothingFound.sort((a, b) => a.name.localeCompare(b.name));

  return {
    lowCostNonprofit,
    bnpl,
    publishesPricing: publishesPricingArr,
    promotionalFinancing,
    nothingFound,
  };
}

async function getClinics(): Promise<ClinicWithData[]> {
  return prisma.clinic.findMany({
    select: {
      id: true,
      name: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      phone: true,
      websiteUrl: true,
      financingTier: true,
      transparencyScore: true,
      lastVerifiedAt: true,
      rating: true,
      ratingCount: true,
      placeId: true,
      evidence: {
        select: {
          id: true,
          category: true,
          label: true,
          snippet: true,
          sourceUrl: true,
        },
      },
      extractedPrices: {
        select: {
          id: true,
          serviceType: true,
          serviceName: true,
          minPrice: true,
          maxPrice: true,
        },
        orderBy: {
          serviceType: 'asc',
        },
      },
      _count: {
        select: {
          communityReports: true,
        },
      },
    },
  });
}

function formatDate(date: Date | null): string {
  if (!date) return 'Not yet verified';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default async function HomePage() {
  const clinics = await getClinics();
  const categorized = categorizeClinics(clinics);
  const lastUpdate = clinics
    .map(c => c.lastVerifiedAt)
    .filter(Boolean)
    .sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0))[0];

  return (
    <main className="flex-1 bg-gradient-to-b from-sage-50 to-white min-h-screen">
      {/* Header */}
      <header className="border-b border-sage-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <h1 className="font-display text-xl md:text-2xl font-semibold text-sage-900">
              Austin Vet Affordability Finder
            </h1>
            <p className="text-xs text-sage-500">
              Updated {formatDate(lastUpdate)}
            </p>
          </div>
          <p className="text-sm text-sage-600 mt-1">
            We crawl clinic websites and financing provider directories to find pricing and payment options for Austin pet owners.
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-12">
        {/* Section 1: Low-Cost & Nonprofit */}
        {categorized.lowCostNonprofit.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-amber-100">
                <Trophy className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-sage-900">
                  Low-Cost & Nonprofit
                </h2>
                <p className="text-sm text-sage-600">
                  Community clinics and nonprofits with affordable pricing
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categorized.lowCostNonprofit.map(clinic => (
                <ClinicCard key={clinic.id} clinic={clinic} badge="nonprofit" />
              ))}
            </div>
          </section>
        )}

        {/* Section 2: Buy Now, Pay Later (Tier 1) */}
        {categorized.bnpl.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-emerald-100">
                <CreditCard className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-sage-900">
                  Buy Now, Pay Later
                </h2>
                <p className="text-sm text-sage-600">
                  Clinics accepting Cherry, Sunbit, Affirm, or VetBilling (no deferred interest)
                </p>
              </div>
            </div>
            <p className="text-sm text-sage-600 mb-6">
              These providers offer transparent fixed payments with no deferred interest. Unlike Scratchpay
              or CareCredit, where interest builds up from day one and hits you all at once if you don&apos;t
              pay in full by the promo deadline, these options show you the exact total upfront. No surprises.
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categorized.bnpl.map(clinic => (
                <ClinicCard key={clinic.id} clinic={clinic} badge="bnpl" />
              ))}
            </div>
          </section>
        )}

        {/* Section 3: Publishes Pricing */}
        {categorized.publishesPricing.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-sky-100">
                <FileText className="w-5 h-5 text-sky-600" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-sage-900">
                  Publishes Pricing
                </h2>
                <p className="text-sm text-sage-600">
                  Transparent about costs before you visit
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categorized.publishesPricing.map(clinic => (
                <ClinicCard key={clinic.id} clinic={clinic} badge="transparent" />
              ))}
            </div>
          </section>
        )}

        {/* Section 4: Promotional Financing (Scratchpay/CareCredit) */}
        {categorized.promotionalFinancing.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-orange-100">
                <CreditCard className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-sage-900">
                  Promotional Financing
                </h2>
                <p className="text-sm text-sage-600">
                  Clinics accepting Scratchpay or CareCredit
                </p>
              </div>
            </div>
            <p className="text-sm text-sage-600 mb-6">
              These clinics offer promotional financing through Scratchpay or CareCredit. These plans
              work differently from the BNPL options above&mdash;they use deferred interest, which means
              interest accrues from day 1 and is charged retroactively if not paid in full by the end
              of the promotional period. Review the terms carefully so you can plan your payments.
            </p>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categorized.promotionalFinancing.map(clinic => (
                <ClinicCard key={clinic.id} clinic={clinic} />
              ))}
            </div>
          </section>
        )}

        {/* Section 5: All Clinics (no financing info found) */}
        {categorized.nothingFound.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-sage-100">
                <MapPin className="w-5 h-5 text-sage-600" />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-sage-900">
                  All Clinics
                </h2>
                <p className="text-sm text-sage-600">
                  Other veterinary clinics in the Austin area
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categorized.nothingFound.map(clinic => (
                <ClinicCard key={clinic.id} clinic={clinic} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-sage-100 bg-sage-50 py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center text-sm text-sage-600">
            <p className="mb-2">
              <strong>Important:</strong> We are not a lender and don&apos;t provide financial advice.
            </p>
            <p>
              Financing terms change. Always confirm details directly with the clinic.
              Data is collected from public websites and community reports.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
