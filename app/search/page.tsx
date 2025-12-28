import { redirect } from 'next/navigation';

// Search page has been replaced by the homepage with instant categorized results
export default function SearchPage() {
  redirect('/');
}
