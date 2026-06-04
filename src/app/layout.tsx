import type {Metadata} from 'next';
import './globals.css';
import { FirebaseErrorListener } from '@/components/firebase-error-listener';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'Architectural Pro Studio',
  description: 'Professional architectural design and estimation tool',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
      </head>
      <body className="font-body antialiased overflow-hidden overscroll-behavior-none">
        {children}
        <FirebaseErrorListener />
        <Toaster />
      </body>
    </html>
  );
}
