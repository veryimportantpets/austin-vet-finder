import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Phone,
  Globe,
  MapPin,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Clock,
  Shield,
  DollarSign,
  MessageCircle,
  Heart,
  ArrowRight,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import prisma from '@/lib/db';
import {
  formatDate,
  formatRelativeTime,
  getTierInfo,
  getTransparencyInfo,
  getQuestionsToAsk,
  FINANCING_PROVIDERS,
} from '@/lib/utils';
import { CopyButton } from './copy-button';

interface Props {
  params: { id: string };
}

export default async function ClinicDetailPage({ params }: Props) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: params.id },
    include: {
      evidence: {
        orderBy: { fetchedAt: 'desc' },
      },
      extractedSignals: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      extractedPrices: {
        orderBy: { serviceType: 'asc' },
      },
      communityReports: {
        where: { flagged: false },
        orderBy: { submittedAt: 'desc' },
        take: 10,
      },
      _count: {
        select: {
          communityReports: {
            where: { flagged: false },
          },
        },
      },
    },
  });
  
  if (!clinic) {
    notFound();
  }
  
  // Increment view count
  await prisma.clinic.update({
    where: { id: params.id },
    data: { viewCount: { increment: 1 } },
  });
  
  const tierInfo = getTierInfo(clinic.financingTier);
  const transparencyInfo = getTransparencyInfo(clinic.transparencyScore);
  const signals = clinic.extractedSignals[0] || {
    financingProviders: [],
    inHousePaymentPlan: false,
    deferredInterest: false,
    hasPriceList: false,
    hasExamFee: false,
    hasEstimatePromise: false,
  };
  
  const financingProviders = (signals.financingProviders as string[]) || [];
  const financingEvidence = clinic.evidence.filter(e => e.category === 'FINANCING');
  const transparencyEvidence = clinic.evidence.filter(e => e.category === 'TRANSPARENCY');
  
  const questionsToAsk = getQuestionsToAsk(
    financingProviders,
    signals.hasEstimatePromise,
    signals.hasPriceList
  );
  
  // Check for deferred interest risk
  const hasDeferredInterestRisk = signals.deferredInterest || 
    financingProviders.includes('CARECREDIT');
  
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-sage-50/30">
        {/* Header */}
        <header className="bg-white border-b border-sage-100">
          <div className="container mx-auto px-4 py-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sage-600 hover:text-sage-800 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              All clinics
            </Link>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Clinic Header */}
            <div className="bg-white rounded-2xl border border-sage-100 p-6 md:p-8 mb-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="flex-1">
                  <h1 className="font-display text-2xl md:text-3xl font-semibold text-sage-900 mb-3">
                    {clinic.name}
                  </h1>
                  
                  <div className="space-y-2 text-sage-600">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span>{clinic.address}</span>
                    </div>
                    {clinic.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <a href={`tel:${clinic.phone}`} className="hover:text-sage-800">
                          {clinic.phone}
                        </a>
                      </div>
                    )}
                    {clinic.websiteUrl && (
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 flex-shrink-0" />
                        <a
                          href={clinic.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-sage-800 flex items-center gap-1"
                        >
                          Visit website
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {/* Google Rating */}
                    {clinic.rating && clinic.ratingCount && (
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 flex-shrink-0 text-yellow-500 fill-yellow-500" />
                        <a
                          href={clinic.placeId
                            ? `https://www.google.com/maps/place/?q=place_id:${clinic.placeId}`
                            : `https://www.google.com/maps/search/${encodeURIComponent(clinic.name + ' ' + clinic.city + ' TX')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-sage-800 flex items-center gap-1"
                        >
                          {clinic.rating.toFixed(1)} ({clinic.ratingCount} reviews)
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-4">
                    <Badge variant={`tier${clinic.financingTier || 'E'}` as any}>
                      {tierInfo.label}: {tierInfo.description}
                    </Badge>
                    <Badge 
                      variant={(clinic.transparencyScore || 0) >= 30 ? 'transparent' : (clinic.transparencyScore || 0) >= 10 ? 'partial' : 'none'}
                    >
                      {transparencyInfo.label}
                    </Badge>
                  </div>
                </div>
                
                {/* Last Verified */}
                <div className="flex-shrink-0 bg-sage-50 rounded-xl p-4 text-center">
                  <Clock className="w-6 h-6 text-sage-400 mx-auto mb-2" />
                  <p className="text-xs text-sage-500">Last verified</p>
                  <p className="text-sm font-medium text-sage-700">
                    {formatRelativeTime(clinic.lastVerifiedAt)}
                  </p>
                </div>
              </div>
              
              {/* Contact Actions */}
              <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-sage-100">
                {clinic.phone && (
                  <Button asChild>
                    <a href={`tel:${clinic.phone}`}>
                      <Phone className="w-4 h-4 mr-2" />
                      Call clinic
                    </a>
                  </Button>
                )}
                {clinic.websiteUrl && (
                  <Button variant="outline" asChild>
                    <a href={clinic.websiteUrl} target="_blank" rel="noopener noreferrer">
                      <Globe className="w-4 h-4 mr-2" />
                      Visit website
                    </a>
                  </Button>
                )}
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Financing Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-sage-500" />
                    Financing Options
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {financingProviders.length > 0 || signals.inHousePaymentPlan ? (
                    <>
                      <div className="space-y-3">
                        {signals.inHousePaymentPlan && (
                          <div className="flex items-start gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium text-emerald-800">In-house payment plan</p>
                              <p className="text-sm text-emerald-700">
                                Clinic offers their own payment plans
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {financingProviders.map((provider) => {
                          const providerInfo = FINANCING_PROVIDERS[provider];
                          const isRisky = provider === 'CARECREDIT';
                          
                          return (
                            <div 
                              key={provider}
                              className={`flex items-start gap-3 p-3 rounded-lg border ${
                                isRisky 
                                  ? 'bg-orange-50 border-orange-100' 
                                  : 'bg-sage-50 border-sage-100'
                              }`}
                            >
                              {isRisky ? (
                                <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle2 className="w-5 h-5 text-sage-600 flex-shrink-0 mt-0.5" />
                              )}
                              <div>
                                <p className={`font-medium ${isRisky ? 'text-orange-800' : 'text-sage-800'}`}>
                                  {providerInfo?.name || provider}
                                </p>
                                {providerInfo?.risk && (
                                  <p className="text-sm text-orange-700 mt-1">
                                    ⚠️ {providerInfo.risk}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Financing Evidence */}
                      {financingEvidence.length > 0 && (
                        <div className="pt-4 border-t border-sage-100">
                          <p className="text-xs font-medium text-sage-500 uppercase tracking-wide mb-3">
                            How we know
                          </p>
                          <div className="space-y-2">
                            {financingEvidence.map((e) => {
                              const isValidUrl = e.sourceUrl?.startsWith('http');
                              return (
                                <div key={e.id} className="bg-sage-50/50 rounded-lg p-3 pl-4 text-sm">
                                  <p className="text-sage-600 mb-1">
                                    <span className="font-medium text-sage-700">{e.label}:</span>{' '}
                                    "{e.snippet}"
                                  </p>
                                  <div className="flex items-center gap-3 text-xs text-sage-500">
                                    {isValidUrl ? (
                                      <a
                                        href={e.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:text-sage-700 flex items-center gap-1"
                                      >
                                        View source <ExternalLink className="w-3 h-3" />
                                      </a>
                                    ) : (
                                      <span>Verified manually</span>
                                    )}
                                    <span>•</span>
                                    <span>{formatDate(e.fetchedAt)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-sage-500">
                      <p>No financing options detected on this clinic's website.</p>
                      <p className="text-sm mt-2">Call the clinic directly to ask about payment plans.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Published Prices Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-sage-500" />
                    Published Prices
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {clinic.extractedPrices && clinic.extractedPrices.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <p className="font-medium text-emerald-800">
                          This clinic publishes pricing on their website
                        </p>
                      </div>

                      <div className="space-y-2">
                        {clinic.extractedPrices.map((price) => {
                          const serviceName =
                            price.serviceType === 'exam' ? 'Exam Fee' :
                            price.serviceType === 'vaccines' ? 'Vaccines' :
                            price.serviceType === 'spay_neuter' ? 'Spay/Neuter' :
                            price.serviceType === 'dental' ? 'Dental Cleaning' :
                            price.serviceType === 'microchip' ? 'Microchip' :
                            price.serviceType === 'wellness_plan' ? 'Wellness Plan (monthly)' :
                            price.serviceType === 'fecal_test' ? 'Fecal Test' :
                            price.serviceType === 'heartworm_test' ? 'Heartworm Test' :
                            price.serviceType === 'emergency' ? 'Emergency Fee' :
                            price.serviceName || price.serviceType;

                          const priceStr = price.maxPrice
                            ? `$${Math.round(price.minPrice / 100)} - $${Math.round(price.maxPrice / 100)}`
                            : `$${Math.round(price.minPrice / 100)}`;

                          return (
                            <div
                              key={price.id}
                              className="flex items-center justify-between p-3 bg-sage-50 rounded-lg"
                            >
                              <span className="text-sage-700">{serviceName}</span>
                              <span className="font-semibold text-sage-800">{priceStr}</span>
                            </div>
                          );
                        })}
                      </div>

                      {clinic.websiteUrl && (
                        <p className="text-xs text-sage-500 pt-2">
                          Prices scraped from clinic website. Verify current pricing by calling.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <DollarSign className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sage-600 mb-2">No prices published online</p>
                      <p className="text-sm text-sage-500">
                        Call the clinic directly to ask about pricing.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            
            {/* Community Feedback Section */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-sage-500" />
                  What Pet Owners Say
                </CardTitle>
              </CardHeader>
              <CardContent>
                {clinic._count.communityReports > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sage-600">
                      {clinic._count.communityReports} pet owner{clinic._count.communityReports === 1 ? '' : 's'} shared their experience
                    </p>
                    <p className="text-xs text-sage-400">
                      Community reports are anonymous and unverified. Individual experiences may vary.
                    </p>

                    {/* Summary stats */}
                    {clinic.communityReports.length > 0 && (
                      <div className="grid grid-cols-2 gap-4">
                        {/* Budget flexibility */}
                        {(() => {
                          const positive = clinic.communityReports.filter(
                            r => r.workedWithOnCost === 'offered_options' || r.workedWithOnCost === 'offered_plan'
                          ).length;
                          const total = clinic.communityReports.filter(r => r.workedWithOnCost && r.workedWithOnCost !== 'not_asked').length;
                          if (total === 0) return null;
                          const pct = Math.round((positive / total) * 100);
                          return (
                            <div className="p-4 bg-sage-50 rounded-lg">
                              <div className="text-2xl font-semibold text-sage-700">{pct}%</div>
                              <div className="text-sm text-sage-600">worked with on budget</div>
                            </div>
                          );
                        })()}

                        {/* Estimates */}
                        {(() => {
                          const positive = clinic.communityReports.filter(
                            r => r.receivedEstimate === 'written' || r.receivedEstimate === 'verbal'
                          ).length;
                          const total = clinic.communityReports.filter(r => r.receivedEstimate && r.receivedEstimate !== 'dont_remember').length;
                          if (total === 0) return null;
                          const pct = Math.round((positive / total) * 100);
                          return (
                            <div className="p-4 bg-sage-50 rounded-lg">
                              <div className="text-2xl font-semibold text-sage-700">{pct}%</div>
                              <div className="text-sm text-sage-600">received estimate</div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* CTA to add feedback */}
                    <div className="pt-4 border-t border-sage-100">
                      <Button variant="outline" asChild>
                        <Link href={`/feedback/${params.id}`}>
                          <Heart className="w-4 h-4 mr-2" />
                          Share your experience
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-warmth-100 flex items-center justify-center mx-auto mb-4">
                      <Heart className="w-6 h-6 text-warmth-600" />
                    </div>
                    <p className="text-sage-600 mb-4">
                      Be the first to share your experience at this clinic
                    </p>
                    <Button asChild>
                      <Link href={`/feedback/${params.id}`}>
                        Share Your Experience
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* What to Ask Section */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>What to ask when you call</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sage-600 mb-4">
                  Use these questions to get the information you need. Copy them to your clipboard for easy reference.
                </p>
                <div className="space-y-3">
                  {questionsToAsk.map((question, index) => (
                    <div 
                      key={index}
                      className="flex items-start gap-3 p-3 bg-sage-50 rounded-lg group"
                    >
                      <span className="text-sage-400 font-medium">{index + 1}.</span>
                      <p className="flex-1 text-sage-700">{question}</p>
                      <CopyButton text={question} />
                    </div>
                  ))}
                </div>
                
                {/* Copy All */}
                <div className="mt-4 pt-4 border-t border-sage-100">
                  <CopyButton 
                    text={questionsToAsk.join('\n\n')} 
                    label="Copy all questions"
                    variant="button"
                  />
                </div>
              </CardContent>
            </Card>
            
            {/* Disclaimer */}
            <div className="mt-6 p-5 bg-warmth-50 rounded-xl border border-warmth-100 text-sm">
              <p className="font-medium text-warmth-800 mb-2">Important disclaimers</p>
              <ul className="space-y-1 text-warmth-700">
                <li>• We are not a lender. We don't provide financial advice.</li>
                <li>• Financing terms depend on credit approval and may change.</li>
                <li>• Always confirm details directly with the clinic and financing provider.</li>
                {hasDeferredInterestRisk && (
                  <li className="font-medium">
                    • <span className="text-orange-700">Deferred interest warning:</span> Interest accrues from day 1. 
                    If the balance isn't paid in full during the promotional period, 
                    all accrued interest will be charged retroactively.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
