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
    <div className="min-h-screen bg-gray-50 flex">
      <AdminNav user={session.user as any} />
      <main className="flex-1 min-w-0 p-6 lg:p-8">
        {children}
      </main>
    </div>
  )
}
