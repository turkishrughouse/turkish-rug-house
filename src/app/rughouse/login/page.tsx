import Link from "next/link"
import { ShieldCheck, Sparkles, PackageCheck } from "lucide-react"
import { LoginForm } from "@/components/admin/auth/login-form"

export const dynamic = "force-dynamic"

export default async function RughouseLoginPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#dff5ef,transparent_36%),radial-gradient(circle_at_bottom_right,#f4e9d8,transparent_35%),#f4f7fb] p-6 md:p-10">
      <div className="pointer-events-none fixed inset-0 opacity-40 [background-image:linear-gradient(to_right,#cbd5e130_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e130_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-[#dce3ed] bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur md:p-8">
          <div className="mb-6 rounded-2xl border border-[#dce3ed] bg-[linear-gradient(145deg,#0f172a,#134e4a)] p-4 text-slate-100">
            <p className="text-xs tracking-[0.35em] uppercase text-teal-100/90">Rug House Admin</p>
            <p className="mt-2 text-sm text-slate-200/90">
              Siparis, urun ve icerik yonetimi icin guvenli yonetici girisi.
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-200/90">
              <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Guvenli</span>
              <span className="inline-flex items-center gap-1"><PackageCheck className="h-3.5 w-3.5 text-amber-200" /> Stok</span>
              <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-cyan-200" /> Bildirim</span>
            </div>
          </div>

          <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <span className="h-2 w-2 rounded-full bg-teal-600" />
            Visit storefront
          </Link>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">Admin Login</h1>
          <p className="mt-2 text-sm text-slate-600">Users bolumunde tanimli hesapla giris yapin.</p>
          <div className="mt-6 rounded-2xl border border-[#dce3ed] bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.08)]">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  )
}
