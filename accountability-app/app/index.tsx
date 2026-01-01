import { Redirect } from 'expo-router';
import { useStore } from '@/store/useStore';

export default function Index() {
  const { currentUser } = useStore();

  // If user hasn't completed onboarding, show onboarding
  if (!currentUser) {
    return <Redirect href="/onboarding" />;
  }

  // Otherwise, go to main app
  return <Redirect href="/(tabs)" />;
}
