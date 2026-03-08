import { ChevronDown, LineChart, BarChart3, MoreVertical } from "lucide-react"
import { adminText } from "@/lib/admin/i18n"
import { getAdminLanguage } from "@/lib/admin/server-language"

export default async function AnalyticsOverviewPage() {
  const lang = await getAdminLanguage()
  const t = adminText[lang].analyticsOverview

  return (
    <div className="flex-1 space-y-8 p-6 pt-5 text-slate-900">
      <section className="max-w-[650px] space-y-2">
        <p className="admin-muted">{t.dateRange}</p>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md border border-[#8c8f94] bg-white px-5 py-3 text-left shadow-sm"
        >
          <div className="space-y-0.5">
            <p className="admin-page-title">{t.monthToDate}</p>
            <p className="admin-body">{t.previousYear}</p>
          </div>
          <ChevronDown className="h-6 w-6 text-slate-700" />
        </button>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="text-[20px] font-semibold leading-none text-slate-900">{t.performance}</h2>
          <div className="h-px flex-1 bg-[#d8dadd]" />
          <button type="button" className="rounded p-1 text-slate-700 hover:bg-slate-100">
            <MoreVertical className="h-6 w-6" />
          </button>
        </div>

        <div className="grid gap-0 rounded-md border border-[#d8dadd] bg-white md:grid-cols-5">
          {[
            { label: t.totalSales, value: "₺0,00" },
            { label: t.netSales, value: "₺0,00" },
            { label: t.orders, value: "0" },
            { label: t.productsSold, value: "0" },
            { label: t.variationsSold, value: "0" },
          ].map((item) => (
            <div key={item.label} className="border-b border-[#d8dadd] p-4 md:border-b-0 md:border-r last:border-r-0">
              <p className="text-[14px] font-medium leading-tight text-slate-800">{item.label}</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[22px] leading-none font-medium text-slate-900">{item.value}</p>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-700">0%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="admin-section-title">{t.charts}</h2>
          <div className="h-px flex-1 bg-[#d8dadd]" />
          <button type="button" className="inline-flex items-center gap-3 rounded-md border border-[#d8dadd] bg-white px-4 py-2 text-lg text-slate-700">
            {t.byDay}
            <ChevronDown className="h-5 w-5" />
          </button>
          <button type="button" className="rounded-md p-2 text-slate-700 hover:bg-slate-100">
            <LineChart className="h-6 w-6" />
          </button>
          <button type="button" className="rounded-md p-2 text-slate-300">
            <BarChart3 className="h-6 w-6" />
          </button>
          <button type="button" className="rounded p-1 text-slate-700 hover:bg-slate-100">
            <MoreVertical className="h-6 w-6" />
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {[
            { title: t.netSales, left: "₺0,00", right: "₺0,00" },
            { title: t.orders, left: "0", right: "0" },
          ].map((chart) => (
            <div key={chart.title} className="overflow-hidden rounded-xl border border-[#d8dadd] bg-white">
              <div className="border-b border-[#d8dadd] px-6 py-4 admin-card-title">{chart.title}</div>
              <div className="flex min-h-[290px] items-center justify-center px-6 text-center text-[24px] font-semibold text-slate-500">
                {t.noDataSelectedRange}
              </div>
              <div className="border-t border-[#d8dadd] bg-[#f8f9fb] px-6 py-5">
                <div className="flex items-center justify-between admin-body">
                  <span>{t.monthToDate.replace("vs. ", "")}</span>
                  <span className="font-semibold text-slate-700">{chart.left}</span>
                </div>
                <div className="mt-3 flex items-center justify-between admin-body">
                  <span>{t.previousYear.replace("vs. ", "")}</span>
                  <span className="font-semibold text-slate-700">{chart.right}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="admin-section-title">{t.leaderboards}</h2>
          <div className="h-px flex-1 bg-[#d8dadd]" />
          <button type="button" className="rounded p-1 text-slate-700 hover:bg-slate-100">
            <MoreVertical className="h-6 w-6" />
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {[t.topCategories, t.topProducts].map((title) => (
            <div key={title} className="overflow-hidden rounded-xl border border-[#d8dadd] bg-white">
              <div className="border-b border-[#d8dadd] px-6 py-4 admin-card-title">{title}</div>
              <div className="flex min-h-[250px] items-center justify-center px-6 text-center text-[20px] text-slate-500">
                {t.noDataTimePeriod}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
