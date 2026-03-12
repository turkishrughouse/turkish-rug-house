export type AnalyticsSearchParams = {
  range?: string
}

export type AnalyticsPageProps = {
  searchParams?: Promise<AnalyticsSearchParams>
}
