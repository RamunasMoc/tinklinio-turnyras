// src/app/(admin)/layout.tsx
import { getServerSession }  from 'next-auth'
import { redirect }          from 'next/navigation'
import { authOptions }       from '@/lib/auth'
import AdminNav              from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if ((session.user as any)?.role !== 'ADMIN') redirect('/login?error=forbidden')

  return (
    <div className="min-h-screen bg-gray-50 md:flex print:block print:bg-white">
      <AdminNav user={session.user as any} />
      <main className="w-full min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6 md:p-6 lg:p-8 print:block print:p-0">
        {children}
      </main>
    </div>
  )
}
