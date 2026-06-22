// src/app/layout.tsx
import type { Metadata }   from 'next'
import Providers           from './providers'
import './globals.css'

export const metadata: Metadata = {
  title:       'Paplūdimio tinklinio turnyras',
  description: 'Turnyro valdymo ir sekimo sistema',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lt">
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
