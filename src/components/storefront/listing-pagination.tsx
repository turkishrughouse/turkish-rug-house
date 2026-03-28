import Link from "next/link"

import { cn } from "@/lib/utils"

type ListingPaginationProps = {
  currentPage: number
  totalPages: number
  buildHref: (page: number) => string
}

export function ListingPagination({ currentPage, totalPages, buildHref }: ListingPaginationProps) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {currentPage > 1 ? (
        <Link
          href={buildHref(currentPage - 1)}
          className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Previous
        </Link>
      ) : (
        <span className="inline-flex h-10 cursor-not-allowed items-center rounded-md border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-400">
          Previous
        </span>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        {pages.map((page) => (
          <Link
            key={page}
            href={buildHref(page)}
            aria-current={page === currentPage ? "page" : undefined}
            className={cn(
              "inline-flex h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm font-semibold transition-colors",
              page === currentPage
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            {page}
          </Link>
        ))}
      </div>

      {currentPage < totalPages ? (
        <Link
          href={buildHref(currentPage + 1)}
          className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Next
        </Link>
      ) : (
        <span className="inline-flex h-10 cursor-not-allowed items-center rounded-md border border-slate-200 bg-slate-100 px-4 text-sm font-medium text-slate-400">
          Next
        </span>
      )}
    </nav>
  )
}
