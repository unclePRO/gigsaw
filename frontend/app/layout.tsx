import type { Metadata } from 'next';
import './globals.css';
import { PayPalProvider } from '@/components/providers/PayPalProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { Navbar } from '@/components/layout/Navbar';

export const metadata: Metadata = {
  title: 'Gigsaw - AI Project Decomposition & Freelancer Marketplace',
  description: 'Assemble complete specialist teams with one prompt and single-escrow PayPal Multi-Seller Checkout.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-[#F0F8F6] dark:bg-[#102B2B] text-slate-900 dark:text-slate-100 min-h-screen flex flex-col antialiased transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>
            <PayPalProvider>
              <Navbar />
              <main className="flex-1 w-full bg-[#F0F8F6] dark:bg-[#102B2B]">
                {children}
              </main>
              <footer className="border-t border-[#D8E9E4] dark:border-[#345451] bg-white dark:bg-[#142F2E] py-6 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
                <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 tracking-tight">Gigsaw</span>
                    <span>&bull;</span>
                    <span>AI Team Assembly & Escrow</span>
                  </div>
                  <div>
                    Next-Generation AI Freelance Platform &bull; &copy; {new Date().getFullYear()}
                  </div>
                </div>
              </footer>
            </PayPalProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
