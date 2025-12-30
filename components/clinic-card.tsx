'use client';

import Link from 'next/link';
import { Phone, ArrowRight, Check, Circle, MessageCircle, Star, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Evidence {
  id: string;
  category: string;
  label: string;
  snippet: string;
  sourceUrl: string;
}

interface ExtractedPrice {
  id: string;
  serviceType: string;
  serviceName: string | null;
  minPrice: number;
  maxPrice: number | null;
}

interface ClinicCardProps {
  clinic: {
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
    rating?: number | null;
    ratingCount?: number | null;
    placeId?: string | null;
    evidence: Evidence[];
    extractedPrices?: ExtractedPrice[];
    _count: {
      communityReports: number;
    };
  };
  badge?: 'budget' | 'payment' | 'transparent' | 'bnpl' | 'nonprofit';
}

// Badge info with tier classification
interface FinancingBadge {
  name: string;
  tier: 'nonprofit' | 'lowcost' | '1' | 'wellness' | '2';
}

// Get financing badges based on evidence
// Order: Low-Cost → Nonprofit → BNPL (Tier 1) → Wellness Plan → Scratchpay/CareCredit (Tier 2)
function getFinancingBadges(clinic: ClinicCardProps['clinic']): FinancingBadge[] {
  const badges: FinancingBadge[] = [];
  const nameLower = clinic.name.toLowerCase();
  const evidenceLabels = clinic.evidence.map(e => e.label.toUpperCase());

  // Check nonprofit status (used for low-cost detection)
  const isNonprofit = nameLower.includes('emancipet') || nameLower.includes('humane');

  // 1. Low-cost indicator (sky blue) - nonprofits are also low-cost
  if (isNonprofit || nameLower.includes('thrive affordable') || nameLower.includes('affordable pet care')) {
    badges.push({ name: 'Low-Cost', tier: 'lowcost' });
  }

  // 2. Nonprofit organizations (amber)
  if (isNonprofit) {
    badges.push({ name: 'Nonprofit', tier: 'nonprofit' });
  }

  // 2. Tier 1 providers (Best BNPL - no deferred interest)
  if (evidenceLabels.some(l => l.includes('CHERRY'))) {
    badges.push({ name: 'Cherry', tier: '1' });
  }
  if (evidenceLabels.some(l => l.includes('SUNBIT'))) {
    badges.push({ name: 'Sunbit', tier: '1' });
  }
  if (evidenceLabels.some(l => l.includes('AFFIRM'))) {
    badges.push({ name: 'Affirm', tier: '1' });
  }
  if (evidenceLabels.some(l => l.includes('VETBILLING'))) {
    badges.push({ name: 'VetBilling', tier: '1' });
  }
  if (evidenceLabels.some(l => l.includes('IN_HOUSE') || l.includes('IN-HOUSE'))) {
    badges.push({ name: 'In-house Plan', tier: '1' });
  }

  // 3. Wellness plans (neutral, informational)
  if (evidenceLabels.some(l => l.includes('WELLNESS_PLAN') || l.includes('WELLNESS PLAN'))) {
    badges.push({ name: 'Wellness Plan', tier: 'wellness' });
  }

  // 4. Tier 2 providers (Scratchpay/CareCredit - deferred interest)
  if (evidenceLabels.some(l => l.includes('SCRATCHPAY'))) {
    badges.push({ name: 'Scratchpay', tier: '2' });
  }
  if (evidenceLabels.some(l => l.includes('CARECREDIT') || l.includes('CARE CREDIT'))) {
    badges.push({ name: 'CareCredit', tier: '2' });
  }

  return badges;
}

// Format price in dollars
function formatPrice(cents: number): string {
  return `$${Math.round(cents / 100)}`;
}

// Get key prices to display prominently
function getKeyPrices(clinic: ClinicCardProps['clinic']): { service: string; price: string }[] {
  const prices: { service: string; price: string }[] = [];
  const extractedPrices = clinic.extractedPrices || [];

  // Service name mapping
  const serviceNames: Record<string, string> = {
    exam: 'Exam',
    rabies: 'Rabies',
    dhpp: 'DHPP',
    bordetella: 'Bordetella',
    vaccines: 'Vaccines',
    spay_neuter: 'Spay/Neuter',
    dental: 'Dental',
    wellness_plan: 'Wellness/mo',
  };

  // Priority order: exam first, then individual vaccines (more useful than package), then other services
  // Individual vaccines are more useful for comparison than generic "vaccines" package price
  const priorityServices = ['exam', 'rabies', 'dhpp', 'bordetella', 'vaccines', 'spay_neuter', 'dental', 'wellness_plan'];

  for (const serviceType of priorityServices) {
    const price = extractedPrices.find(p => p.serviceType === serviceType);
    if (price) {
      // Skip generic "vaccines" if we already have individual vaccine prices
      if (serviceType === 'vaccines') {
        const hasIndividualVaccines = prices.some(p =>
          ['Rabies', 'DHPP', 'Bordetella'].includes(p.service)
        );
        if (hasIndividualVaccines) continue;
      }

      const serviceName = serviceNames[serviceType] || price.serviceName || serviceType;
      const priceStr = price.maxPrice
        ? `${formatPrice(price.minPrice)}-${formatPrice(price.maxPrice)}`
        : formatPrice(price.minPrice);

      prices.push({ service: serviceName, price: priceStr });

      if (prices.length >= 3) break;
    }
  }

  return prices;
}

// Get "What we found" items
function getWhatWeFound(clinic: ClinicCardProps['clinic']): { found: boolean; text: string }[] {
  const items: { found: boolean; text: string }[] = [];
  const extractedPrices = clinic.extractedPrices || [];
  const evidenceLabels = clinic.evidence.map(e => e.label.toLowerCase());

  // Check for extracted prices first (more reliable)
  const examPrice = extractedPrices.find(p => p.serviceType === 'exam');
  if (examPrice) {
    items.push({ found: true, text: `Exam fee: ${formatPrice(examPrice.minPrice)}` });
  } else {
    const examEvidence = clinic.evidence.find(e =>
      e.label.toLowerCase().includes('exam') && e.snippet.includes('$')
    );
    if (examEvidence) {
      const priceMatch = examEvidence.snippet.match(/\$\d+/);
      if (priceMatch) {
        items.push({ found: true, text: `Posts exam fee: ${priceMatch[0]}` });
      }
    }
  }

  // Vaccine pricing
  const vaccinePrice = extractedPrices.find(p => p.serviceType === 'vaccines');
  if (vaccinePrice) {
    items.push({ found: true, text: `Vaccines from ${formatPrice(vaccinePrice.minPrice)}` });
  }

  // Spay/neuter pricing
  const spayPrice = extractedPrices.find(p => p.serviceType === 'spay_neuter');
  if (spayPrice) {
    items.push({ found: true, text: `Spay/neuter from ${formatPrice(spayPrice.minPrice)}` });
  }

  // Price list
  if (evidenceLabels.some(l => l.includes('price list') || l.includes('pricing'))) {
    items.push({ found: true, text: 'Publishes price list' });
  }

  // Wellness plan pricing
  const wellnessPrice = extractedPrices.find(p => p.serviceType === 'wellness_plan');
  if (wellnessPrice) {
    items.push({ found: true, text: `Wellness plan ${formatPrice(wellnessPrice.minPrice)}/mo` });
  } else if (evidenceLabels.some(l => l.includes('wellness'))) {
    items.push({ found: true, text: 'Wellness plan available' });
  }

  // If no items found
  if (items.length === 0) {
    items.push({ found: false, text: 'No pricing published' });
  }

  return items.slice(0, 3);
}

// Get badge variant based on tier
function getBadgeVariant(badge: FinancingBadge): 'nonprofit' | 'lowcost' | 'tier1' | 'tier2' | 'default' {
  if (badge.tier === 'nonprofit') return 'nonprofit';
  if (badge.tier === 'lowcost') return 'lowcost';
  if (badge.tier === '1') return 'tier1';
  if (badge.tier === '2') return 'tier2';
  return 'default';  // wellness plans get default styling
}

// Generate Google Maps URL for reviews
function getGoogleMapsUrl(placeId: string | null | undefined, clinicName: string, city: string): string {
  const query = encodeURIComponent(clinicName + ' ' + city + ' TX');
  if (placeId) {
    // Use Maps URLs API format - works reliably on both mobile and desktop
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${placeId}`;
  }
  // Fallback to search
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function ClinicCard({ clinic, badge }: ClinicCardProps) {
  const badges = getFinancingBadges(clinic);
  const whatWeFound = getWhatWeFound(clinic);
  const keyPrices = getKeyPrices(clinic);
  const reportCount = clinic._count.communityReports;
  const hasGoogleRating = clinic.rating && clinic.ratingCount;
  const googleMapsUrl = getGoogleMapsUrl(clinic.placeId, clinic.name, clinic.city);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div>
          <Link href={`/clinic/${clinic.id}`}>
            <h3 className="font-display text-lg font-semibold text-sage-900 hover:text-sage-700 transition-colors">
              {clinic.name}
            </h3>
          </Link>
          <p className="text-sm text-sage-600 mt-0.5">
            {clinic.address}
          </p>
        </div>

        {/* Key Prices - Prominent display */}
        {keyPrices.length > 0 && (
          <div className="bg-sage-50 rounded-lg p-3">
            <div className="flex items-center justify-between gap-2">
              {keyPrices.map((item, i) => (
                <div key={i} className="text-center flex-1">
                  <div className="text-lg font-semibold text-sage-800">{item.price}</div>
                  <div className="text-xs text-sage-500">{item.service}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Badges */}
        {badges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {badges.map((b, i) => (
              <Badge
                key={i}
                variant={getBadgeVariant(b)}
                className="text-xs"
              >
                {b.name}
              </Badge>
            ))}
          </div>
        )}

        {/* What we found */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-sage-500 uppercase tracking-wide">
            What we found
          </p>
          <ul className="space-y-1">
            {whatWeFound.map((item, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                {item.found ? (
                  <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-sage-300 flex-shrink-0" />
                )}
                <span className={item.found ? 'text-sage-700' : 'text-sage-400'}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Reviews Section - Side by Side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Google Reviews */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-sage-500 uppercase tracking-wide flex items-center gap-1">
              Google
            </p>
            {hasGoogleRating ? (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-sm font-medium text-sage-700">{clinic.rating!.toFixed(1)}</span>
                <span className="text-xs text-sage-500 hover:underline">({clinic.ratingCount})</span>
              </a>
            ) : (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-sage-400 hover:text-sage-600 transition-colors"
              >
                View on Maps
              </a>
            )}
          </div>

          {/* Community Reports */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-sage-500 uppercase tracking-wide">
              Community
            </p>
            {reportCount >= 1 ? (
              <p className="text-sm text-sage-700 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4 text-sage-500" />
                {reportCount} {reportCount === 1 ? 'report' : 'reports'}
              </p>
            ) : (
              <Link
                href={`/feedback/${clinic.id}`}
                className="text-sm text-sage-500 hover:text-sage-700 transition-colors"
              >
                Share your experience
              </Link>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-sage-100">
          {clinic.phone && (
            <Button variant="outline" size="sm" asChild className="flex-1">
              <a href={`tel:${clinic.phone}`}>
                <Phone className="w-3.5 h-3.5 mr-1.5" />
                Call
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild title="View on Google Maps">
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <MapPin className="w-3.5 h-3.5" />
            </a>
          </Button>
          <Button variant="calm" size="sm" asChild className="flex-1">
            <Link href={`/clinic/${clinic.id}`}>
              Details
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
