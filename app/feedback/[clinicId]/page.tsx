export const dynamic = 'force-dynamic';

import FeedbackForm from './feedback-form';

interface Props {
  params: { clinicId: string };
}

export default function FeedbackPage({ params }: Props) {
  return <FeedbackForm clinicId={params.clinicId} />;
}
