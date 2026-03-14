"use client"

import { createContext, useContext, useMemo, useState } from "react"
import {
  formatCurrency,
  getCurrencyLocale,
  normalizeCurrency,
  type CurrencySettings,
  type SupportedCurrency,
} from "@/lib/storefront/currency"
import { CURRENCY_COOKIE, type StorefrontCurrencySnapshot } from "@/lib/storefront/currency-shared"

type StorefrontCurrencyContextValue = StorefrontCurrencySnapshot & {
  setCurrency: (currency: SupportedCurrency) => void
  getCurrencySettings: (valueCurrency?: SupportedCurrency) => CurrencySettings
  formatUsd: (amount: number) => string
  formatAmount: (amount: number, valueCurrency?: SupportedCurrency) => string
}

const StorefrontCurrencyContext = createContext<StorefrontCurrencyContextValue | null>(null)

function persistCurrencyPreference(currency: SupportedCurrency) {
  document.cookie = `${CURRENCY_COOKIE}=${currency}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax`
  try {
    window.localStorage.setItem(CURRENCY_COOKIE, currency)
  } catch {
    // no-op
  }
}

export function StorefrontCurrencyProvider({
  initialSnapshot,
  children,
}: {
  initialSnapshot: StorefrontCurrencySnapshot
  children: React.ReactNode
}) {
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>(initialSnapshot.selectedCurrency)

  const value = useMemo<StorefrontCurrencyContextValue>(() => {
    const locale = getCurrencyLocale(selectedCurrency)
    return {
      ...initialSnapshot,
      selectedCurrency,
      locale,
      setCurrency: (currency) => {
        const normalized = normalizeCurrency(currency)
        setSelectedCurrency(normalized)
        persistCurrencyPreference(normalized)
      },
      getCurrencySettings: (valueCurrency = "USD") => ({
        selectedCurrency,
        valueCurrency,
        usdToEurRate: initialSnapshot.usdToEurRate,
        locale,
      }),
      formatUsd: (amount) =>
        formatCurrency(amount, {
          selectedCurrency,
          valueCurrency: "USD",
          usdToEurRate: initialSnapshot.usdToEurRate,
          locale,
        }),
      formatAmount: (amount, valueCurrency = "USD") =>
        formatCurrency(amount, {
          selectedCurrency,
          valueCurrency,
          usdToEurRate: initialSnapshot.usdToEurRate,
          locale,
        }),
    }
  }, [initialSnapshot, selectedCurrency])

  return <StorefrontCurrencyContext.Provider value={value}>{children}</StorefrontCurrencyContext.Provider>
}

export function useStorefrontCurrency() {
  const context = useContext(StorefrontCurrencyContext)
  if (!context) {
    throw new Error("useStorefrontCurrency must be used within StorefrontCurrencyProvider")
  }
  return context
}
