import Link from "next/link"

import { cn } from "@/lib/utils"

type ListingPaginationProps = {
  currentPage: number
  totalPages: number
  buildHref: (page: number) => string
  className?: string
  theme?: "default" | "dark"
}

export function ListingPagination({
  currentPage,
  totalPages,
  buildHref,
  className,
  theme = "default",
}: ListingPaginationProps) {
  if (totalPages <= 1) return null

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
  const dark = theme === "dark"

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-center gap-2",
        dark ? "mt-6 justify-start" : "mt-10",
        className,
      )}
    >
      {currentPage > 1 ? (
        <Link
          href={buildHref(currentPage - 1)}
          className={cn(
            "inline-flex h-10 items-center px-4 text-sm font-medium transition-colors",
            dark
              ? "rounded-full border border-[#e7dfd4] bg-[#fffdfa] text-[#70675c] hover:border-[#d8cebf] hover:text-[#2c261f]"
              : "rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          )}
        >
          Previous
        </Link>
      ) : (
        <span
          className={cn(
            "inline-flex h-10 cursor-not-allowed items-center px-4 text-sm font-medium",
            dark
              ? "rounded-full border border-[#ece4d9] bg-[#f5f1ea] text-[#aaa092]"
              : "rounded-md border border-slate-200 bg-slate-100 text-slate-400",
          )}
        >
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
              "inline-flex h-10 min-w-10 items-center justify-center border px-3 text-sm font-semibold transition-colors",
              page === currentPage
                ? dark
                  ? "rounded-full border-[#caa56a] bg-[#caa56a] text-white"
                  : "rounded-md border-slate-900 bg-slate-900 text-white"
                : dark
                  ? "rounded-full border-[#e7dfd4] bg-[#fffdfa] text-[#70675c] hover:border-[#d8cebf] hover:text-[#2c261f]"
                  : "rounded-md border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            )}
          >
            {page}
          </Link>
        ))}
      </div>

      {currentPage < totalPages ? (
        <Link
          href={buildHref(currentPage + 1)}
          className={cn(
            "inline-flex h-10 items-center px-4 text-sm font-medium transition-colors",
            dark
              ? "rounded-full border border-[#e7dfd4] bg-[#fffdfa] text-[#70675c] hover:border-[#d8cebf] hover:text-[#2c261f]"
              : "rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          )}
        >
          Next
        </Link>
      ) : (
        <span
          className={cn(
            "inline-flex h-10 cursor-not-allowed items-center px-4 text-sm font-medium",
            dark
              ? "rounded-full border border-[#ece4d9] bg-[#f5f1ea] text-[#aaa092]"
              : "rounded-md border border-slate-200 bg-slate-100 text-slate-400",
          )}
        >
          Next
        </span>
      )}
    </nav>
  )
}
