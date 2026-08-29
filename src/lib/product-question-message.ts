/**
 * Helpers for storefront "Ask Question" submissions.
 *
 * `ProductDetailPurchase` posts these through the ordinary contact endpoint, so
 * they land as `source: "CONTACT"` messages with no product relation. What marks
 * them is a `Product question - <title>` subject plus a body the form composes as:
 *
 *   Product: <title>
 *   Product URL: <absolute /product/<slug> url>
 *   <blank line>
 *   <what the customer actually wrote>
 *
 * Every helper here is read-only and defensive: historical rows keep whatever
 * shape they were written with, so anything that does not match the generated
 * format falls back to the untouched stored value.
 */

const SUBJECT_PREFIX = "product question -"

export type ProductQuestionMessageShape = {
    source?: string | null
    subject?: string | null
}

/**
 * Same predicate the contact API uses to label these submissions in the
 * notification email, so admin and email agree on what counts as a question.
 */
export function isProductQuestionMessage(message: ProductQuestionMessageShape) {
    if ((message.source || "") !== "CONTACT") return false
    return (message.subject || "").trim().toLowerCase().startsWith(SUBJECT_PREFIX)
}

/** The product title the storefront baked into the subject, "" when absent. */
export function getProductQuestionTitle(subject: string | null | undefined) {
    const raw = (subject || "").trim()
    if (!raw.toLowerCase().startsWith(SUBJECT_PREFIX)) return ""
    return raw.slice(SUBJECT_PREFIX.length).trim()
}

/**
 * Pull the product slug out of an absolute or root-relative `/product/<slug>`
 * URL. Returns "" for anything else so callers never query on garbage.
 */
export function getProductSlugFromUrl(value: string | null | undefined) {
    const raw = (value || "").trim()
    if (!raw || raw.length > 2048) return ""

    let pathname = ""
    try {
        pathname = new URL(raw, "https://turkishrughouse.com").pathname
    } catch {
        return ""
    }

    let decoded = pathname
    try {
        decoded = decodeURIComponent(pathname)
    } catch {
        // Malformed percent-escapes: keep the raw pathname rather than throwing.
    }

    const match = decoded.replace(/\/+$/, "").match(/^\/product\/([^/]+)$/)
    const slug = (match?.[1] || "").trim()
    if (!slug || slug.length > 200 || /\s/.test(slug)) return ""
    return slug
}

/**
 * Slug candidates in descending order of trust: the URL the form itself wrote
 * into the body, then the referer the API captured. Title is never used - two
 * products can share one.
 */
export function getProductQuestionSlugCandidates(
    content: string | null | undefined,
    pageUrl: string | null | undefined
) {
    const candidates: string[] = []
    const push = (slug: string) => {
        if (slug && !candidates.includes(slug)) candidates.push(slug)
    }

    const bodyUrl = (content || "").split(/\r?\n/).find((line) => /^Product URL:\s*\S/i.test(line))
    if (bodyUrl) push(getProductSlugFromUrl(bodyUrl.replace(/^Product URL:\s*/i, "")))
    push(getProductSlugFromUrl(pageUrl))

    return candidates
}

/**
 * Strip the two lines the Ask Question form generates so only the customer's own
 * words are shown. Bails out - returning the stored content untouched - unless
 * both generated lines are present in the exact shape the form writes them and
 * something is left afterwards. Nothing is written back to the database.
 */
export function splitProductQuestionBody(content: string | null | undefined) {
    const original = content || ""
    const lines = original.split(/\r?\n/)

    if (lines.length < 3) return { body: original, stripped: false }
    if (!/^Product:\s*\S/.test(lines[0])) return { body: original, stripped: false }
    if (!/^Product URL:\s*https?:\/\/\S+\s*$/i.test(lines[1])) return { body: original, stripped: false }

    const rest = lines.slice(2)
    while (rest.length > 0 && rest[0].trim().length === 0) rest.shift()
    if (rest.length === 0) return { body: original, stripped: false }

    return { body: rest.join("\n"), stripped: true }
}
