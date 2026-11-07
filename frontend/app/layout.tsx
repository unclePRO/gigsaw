import type { Metadata } from 'next';
import './globals.css';
import { PayPalProvider } from '@/components/providers/PayPalProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { Navbar } from '@/components/layout/Navbar';

export const metadata: Metadata = {
  title: 'GigSaw - AI Project Decomposition & Freelancer Matching',
  description: 'AI decomposes your project into Designer, Developer, and Marketer milestones with consolidated checkout and tracking.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#F8FAFC] text-slate-900 min-h-screen flex flex-col antialiased">
        <AuthProvider>
          <PayPalProvider>
            <Navbar />
            <main className="flex-1 w-full">
              {children}
            </main>
            <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
              <div className="max-w-7xl mx-auto px-4">
                &copy; {new Date().getFullYear()} GigSaw &bull; AI Project Decomposition & Freelancer Matching
              </div>
            </footer>
          </PayPalProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
