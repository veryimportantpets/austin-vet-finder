import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DE Connect Setup',
  description: 'Set up DE Connect to sync your veterinary practice data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <div className="min-h-screen flex flex-col">
          <header className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="max-w-3xl mx-auto flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">DE Connect</h1>
                <p className="text-sm text-gray-500">Setup Wizard</p>
              </div>
            </div>
          </header>
          <main className="flex-1 py-8">
            <div className="max-w-3xl mx-auto px-6">
              {children}
            </div>
          </main>
          <footer className="border-t border-gray-200 py-4 text-center text-sm text-gray-500">
            DE Connect &copy; {new Date().getFullYear()}
          </footer>
        </div>
      </body>
    </html>
  );
}
