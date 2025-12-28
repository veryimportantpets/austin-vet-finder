'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Heart, Check, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ClinicInfo {
  id: string;
  name: string;
  address: string;
}

export default function FeedbackPage({ params }: { params: { clinicId: string } }) {
  const router = useRouter();
  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [workedWithOnCost, setWorkedWithOnCost] = useState<string>('');
  const [receivedEstimate, setReceivedEstimate] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>('');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [visitYear, setVisitYear] = useState<string>('');
  const [feltFair, setFeltFair] = useState<string>('');

  useEffect(() => {
    async function fetchClinic() {
      try {
        const res = await fetch(`/api/clinics/${params.clinicId}`);
        if (res.ok) {
          const data = await res.json();
          setClinic(data);
        } else {
          setError('Clinic not found');
        }
      } catch {
        setError('Failed to load clinic');
      } finally {
        setLoading(false);
      }
    }
    fetchClinic();
  }, [params.clinicId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!workedWithOnCost || !receivedEstimate) {
      setError('Please answer the required questions');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: params.clinicId,
          workedWithOnCost,
          receivedEstimate,
          serviceType: serviceType || null,
          amountPaid: amountPaid ? Math.round(parseFloat(amountPaid) * 100) : null,
          visitYear: visitYear ? parseInt(visitYear) : null,
          feltFair: feltFair ? feltFair === 'yes' : null,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit feedback');
      }
    } catch {
      setError('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 bg-gradient-to-b from-sage-50 to-white min-h-screen">
        <div className="container mx-auto px-4 py-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-sage-500" />
        </div>
      </main>
    );
  }

  if (error && !clinic) {
    return (
      <main className="flex-1 bg-gradient-to-b from-sage-50 to-white min-h-screen">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sage-600 mb-4">{error}</p>
              <Button asChild>
                <Link href="/">Back to Home</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (submitted) {
    return (
      <main className="flex-1 bg-gradient-to-b from-sage-50 to-white min-h-screen">
        <div className="container mx-auto px-4 py-8 max-w-lg">
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="font-display text-2xl font-semibold text-sage-900">
                Thank You!
              </h1>
              <p className="text-sage-600">
                Your feedback helps other pet owners make informed decisions about veterinary care.
              </p>
              <div className="pt-4 space-y-2">
                <Button asChild className="w-full">
                  <Link href={`/clinic/${params.clinicId}`}>
                    View {clinic?.name}
                  </Link>
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/">
                    Back to All Clinics
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 bg-gradient-to-b from-sage-50 to-white min-h-screen">
      {/* Header */}
      <header className="border-b border-sage-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Link
            href={`/clinic/${params.clinicId}`}
            className="inline-flex items-center gap-2 text-sage-600 hover:text-sage-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to clinic
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-lg">
        {/* Intro */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-warmth-100 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-6 h-6 text-warmth-600" />
          </div>
          <h1 className="font-display text-2xl font-semibold text-sage-900 mb-2">
            Share Your Experience
          </h1>
          <p className="text-sage-600">
            Help other pet owners by sharing your experience at{' '}
            <span className="font-medium">{clinic?.name}</span>
          </p>
        </div>

        {/* Form */}
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Question 1: Budget concerns */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-sage-700">
                  When you mentioned budget concerns, did this clinic work with you?
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <Select value={workedWithOnCost} onValueChange={setWorkedWithOnCost}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offered_options">
                      Yes - they offered different treatment options
                    </SelectItem>
                    <SelectItem value="offered_plan">
                      Yes - they offered a payment plan
                    </SelectItem>
                    <SelectItem value="not_asked">
                      I didn&apos;t ask about budget
                    </SelectItem>
                    <SelectItem value="felt_dismissed">
                      No - I felt dismissed
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Question 2: Estimate */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-sage-700">
                  Did you get an estimate before treatment?
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <Select value={receivedEstimate} onValueChange={setReceivedEstimate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="written">
                      Yes - written estimate
                    </SelectItem>
                    <SelectItem value="verbal">
                      Yes - verbal estimate only
                    </SelectItem>
                    <SelectItem value="none">
                      No estimate given
                    </SelectItem>
                    <SelectItem value="dont_remember">
                      I don&apos;t remember
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Divider */}
              <div className="border-t border-sage-100 pt-6">
                <p className="text-xs text-sage-500 uppercase tracking-wide font-medium mb-4">
                  Optional details (helps others)
                </p>
              </div>

              {/* Service type */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-sage-700">
                  What type of service did you get?
                </label>
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exam">Exam / checkup</SelectItem>
                    <SelectItem value="vaccines">Vaccines</SelectItem>
                    <SelectItem value="spay_neuter">Spay / neuter</SelectItem>
                    <SelectItem value="dental">Dental cleaning</SelectItem>
                    <SelectItem value="emergency">Emergency visit</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount paid */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-sage-700">
                  About how much did you pay? (approximate is fine)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sage-400">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Visit year */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-sage-700">
                  What year was your visit?
                </label>
                <Select value={visitYear} onValueChange={setVisitYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2022">2022 or earlier</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Felt fair */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-sage-700">
                  Did the final cost feel fair?
                </label>
                <Select value={feltFair} onValueChange={setFeltFair}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an option..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes, it seemed fair</SelectItem>
                    <SelectItem value="no">No, it felt too high</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Error message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </Button>

              <p className="text-xs text-sage-400 text-center">
                Your feedback is anonymous and helps other pet owners.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
