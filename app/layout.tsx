import type { Metadata } from 'next';
import { Source_Sans_3, Fraunces, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sourceSans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Austin Vet Affordability Finder | Find Vets That Work With Your Budget',
  description:
    'Discover Austin veterinary clinics with friendly payment options and transparent pricing. Evidence-based ratings for financing and cost transparency.',
  keywords: [
    'Austin vet',
    'affordable veterinarian',
    'vet payment plans',
    'pet financing',
    'veterinary costs',
    'Austin animal hospital',
  ],
  openGraph: {
    title: 'Austin Vet Affordability Finder',
    description: 'Find vets that can work with your budget — friendly payment options + estimate transparency, with evidence.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sourceSans.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans antialiased">
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
