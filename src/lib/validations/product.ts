import { z } from "zod"

const customAttributeSchema = z.object({
    name: z.string().trim().min(1, "Attribute name is required"),
    values: z.array(z.string().trim().min(1)).default([]),
    visible: z.boolean().default(true),
})

const supplierSchema = z.object({
    name: z.string().trim().default(""),
    number: z.string().trim().default(""),
    company: z.string().trim().default(""),
    phone: z.string().trim().default(""),
    note: z.string().trim().default(""),
}).refine(
    (value) => Boolean(value.name || value.company || value.number),
    { message: "Supplier must have a name, company, or number" }
)

export const productFormSchema = z.object({
    title: z.string().min(1, "Title is required"),
    slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format"),
    sku: z.string().trim().min(1, "SKU is required"),
    description: z.string().optional(),
    shortDescription: z.string().optional(),
    price: z.coerce.number().min(0, "Price must be positive"),
    compareAtPrice: z.coerce.number().min(0).optional(),
    stockCount: z.coerce.number().int().min(0),
    isStock: z.boolean().default(true),
    isPublished: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    featuredImage: z.string().optional(),
    images: z.array(z.string()).min(1, "At least one image is required").default([]), // URLs

    // Relations (IDs)
    categoryIds: z.array(z.string()).min(1, "At least one category is required").default([]),

    // Legacy taxonomy attributes (kept optional)
    typeIds: z.array(z.string()).default([]),
    styleIds: z.array(z.string()).default([]),
    colorIds: z.array(z.string()).default([]),
    sizeIds: z.array(z.string()).default([]),
    ageIds: z.array(z.string()).default([]),
    materialIds: z.array(z.string()).default([]),

    // SEO
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    seoKeywords: z.string().optional(),
    customAttributes: z.array(customAttributeSchema).default([]),
    suppliers: z.array(supplierSchema).default([]),
})

export type ProductFormInput = z.input<typeof productFormSchema>
export type ProductFormValues = z.output<typeof productFormSchema>
