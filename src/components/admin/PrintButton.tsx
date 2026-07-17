'use client'

import type { ReactNode } from 'react'

export default function PrintButton({ children = 'Spausdinti' }: { children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
    >
      {children}
    </button>
  )
}
