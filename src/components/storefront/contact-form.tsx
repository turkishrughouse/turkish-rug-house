"use client"

import { useState } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { ArrowRight, Mail, MapPin, Phone } from "lucide-react"

type ContactFormProps = {
    pageTitle?: string
    pageDescription?: string
    phone?: string
    email?: string
    locationLabel?: string
    locationUrl?: string
    teamCardTitle?: string
    teamCardCtaLabel?: string
    teamCardCtaUrl?: string
    teamCardImage?: string
}

export function ContactForm({
    pageTitle = "Connect with Our Team of Experts",
    pageDescription = "Contact our team of excellence-driven experts today to bring your project to life.",
    phone = "+1 (555) 000-0000",
    email = "info@turkishrughouse.com",
    locationLabel = "See Our Locations",
    locationUrl = "/info/contact",
    teamCardTitle = "Want to Join Our Talented Team?",
    teamCardCtaLabel = "Visit Our Job Board",
    teamCardCtaUrl = "#",
    teamCardImage,
}: ContactFormProps) {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        location: "",
        expertise: "",
        message: "",
    })
    const [loading, setLoading] = useState(false)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData((prev) => ({
            ...prev,
            [e.target.name]: e.target.value,
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Basic validation
        if (!formData.name || !formData.email || !formData.expertise || !formData.message) {
            toast.error("Please fill in all required fields")
            return
        }

        try {
            setLoading(true)

            const composedMessage = [
                `Expertise: ${formData.expertise}`,
                formData.location ? `Location: ${formData.location}` : "",
                formData.message,
            ]
                .filter(Boolean)
                .join("\n\n")

            const response = await fetch("/api/messages/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    phone: formData.phone,
                    subject: `Contact request - ${formData.expertise}`,
                    message: composedMessage,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to send message")
            }

            toast.success("Message sent successfully!", {
                description: "We'll get back to you as soon as possible.",
            })

            // Reset form
            setFormData({
                name: "",
                email: "",
                phone: "",
                location: "",
                expertise: "",
                message: "",
            })
        } catch (error) {
            console.error("Error sending message:", error)
            toast.error(error instanceof Error ? error.message : "Failed to send message")
        } finally {
            setLoading(false)
        }
    }

    return (
        <section className="bg-[#eaf4ff] pb-12 pt-10 md:py-16">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Contact Us</p>
                            <h1 className="max-w-xl text-4xl font-bold leading-tight text-[#081f5c] md:text-6xl">
                                {pageTitle}
                            </h1>
                            <p className="max-w-xl text-lg leading-8 text-slate-700">{pageDescription}</p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 text-slate-700 sm:grid-cols-3">
                            <a href={`tel:${phone}`} className="flex items-center gap-2 text-sm font-semibold hover:text-[#081f5c]">
                                <Phone className="h-4 w-4" />
                                {phone}
                            </a>
                            <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm font-semibold hover:text-[#081f5c]">
                                <Mail className="h-4 w-4" />
                                {email}
                            </a>
                            <Link href={locationUrl} className="flex items-center gap-2 text-sm font-semibold hover:text-[#081f5c]">
                                <MapPin className="h-4 w-4" />
                                {locationLabel}
                            </Link>
                        </div>

                        <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm">
                            <div className="relative z-10 max-w-xs space-y-4">
                                <h2 className="text-3xl font-semibold leading-tight text-[#081f5c]">{teamCardTitle}</h2>
                                <Link href={teamCardCtaUrl} className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#008fd9] hover:text-[#0a6ec0]">
                                    {teamCardCtaLabel}
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                            {teamCardImage ? (
                                <img
                                    src={teamCardImage}
                                    alt="Contact team"
                                    className="pointer-events-none mt-4 h-60 w-full rounded-xl object-cover object-top md:absolute md:bottom-0 md:right-0 md:mt-0 md:h-full md:w-[46%]"
                                />
                            ) : null}
                        </div>
                    </div>

                    <div className="rounded-2xl bg-[#a8c0bb] p-6 text-white shadow-xl md:p-8">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label htmlFor="name" className="text-sm font-semibold">Full Name *</label>
                                    <input
                                        id="name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="Full Name"
                                        required
                                        className="h-11 w-full rounded-md border border-slate-200 px-3 text-slate-900 outline-none ring-[#20b7ff] placeholder:text-slate-400 focus:ring-2"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="email" className="text-sm font-semibold">Email Address *</label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="Email Address"
                                        required
                                        className="h-11 w-full rounded-md border border-slate-200 px-3 text-slate-900 outline-none ring-[#20b7ff] placeholder:text-slate-400 focus:ring-2"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="phone" className="text-sm font-semibold">Phone Number</label>
                                    <input
                                        id="phone"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        placeholder="Phone Number"
                                        className="h-11 w-full rounded-md border border-slate-200 px-3 text-slate-900 outline-none ring-[#20b7ff] placeholder:text-slate-400 focus:ring-2"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label htmlFor="location" className="text-sm font-semibold">Location</label>
                                    <input
                                        id="location"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleChange}
                                        placeholder="Location"
                                        className="h-11 w-full rounded-md border border-slate-200 px-3 text-slate-900 outline-none ring-[#20b7ff] placeholder:text-slate-400 focus:ring-2"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="expertise" className="text-sm font-semibold">What Expertise You&apos;re Interested In *</label>
                                <select
                                    id="expertise"
                                    name="expertise"
                                    value={formData.expertise}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, expertise: e.target.value }))}
                                    required
                                    className="h-11 w-full rounded-md border border-slate-200 px-3 text-slate-900 outline-none ring-[#20b7ff] focus:ring-2"
                                >
                                    <option value="">Select</option>
                                    <option value="Order & Shipping">Order & Shipping</option>
                                    <option value="After Purchase Support">After Purchase Support</option>
                                    <option value="Custom & Special Orders">Custom & Special Orders</option>
                                    <option value="Invoice & Payment">Invoice & Payment</option>
                                    <option value="Wholesale & Trade">Wholesale & Trade</option>
                                    <option value="Product Information">Product Information</option>
                                    <option value="Account & Website Help">Account & Website Help</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="message" className="text-sm font-semibold">Tell Us About Your Project *</label>
                                <textarea
                                    id="message"
                                    name="message"
                                    value={formData.message}
                                    onChange={handleChange}
                                    placeholder="Leave your message here"
                                    rows={8}
                                    required
                                    className="w-full rounded-md border border-slate-200 p-3 text-slate-900 outline-none ring-[#20b7ff] placeholder:text-slate-400 focus:ring-2"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex h-12 items-center gap-2 rounded-md bg-[#2cb7ff] px-6 text-sm font-bold uppercase tracking-wide text-[#001b66] transition hover:bg-[#45c4ff] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {loading ? "Submitting..." : "Submit"}
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    )
}
