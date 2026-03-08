import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Starting database seed...')

    // Clear existing data
    console.log('🗑️  Clearing existing data...')
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
    await prisma.type.deleteMany()
    await prisma.style.deleteMany()
    await prisma.color.deleteMany()
    await prisma.size.deleteMany()
    await prisma.age.deleteMany()
    await prisma.supportFaq.deleteMany()

    // Create Categories
    console.log('📁 Creating categories...')

    const rugsCategory = await prisma.category.create({
        data: {
            title: 'Rugs',
            slug: 'rugs',
            description: 'Premium handcrafted rugs',
            sortOrder: 1
        }
    })

    const textilesCategory = await prisma.category.create({
        data: {
            title: 'Textiles',
            slug: 'textiles',
            description: 'Quality textile products',
            sortOrder: 2
        }
    })

    // Create subcategories for Rugs
    const modernRugs = await prisma.category.create({
        data: {
            title: 'Modern Rugs',
            slug: 'modern-rugs',
            description: 'Contemporary rug designs',
            parentId: rugsCategory.id,
            sortOrder: 1
        }
    })

    const traditionalRugs = await prisma.category.create({
        data: {
            title: 'Traditional Rugs',
            slug: 'traditional-rugs',
            description: 'Classic traditional patterns',
            parentId: rugsCategory.id,
            sortOrder: 2
        }
    })

    const vintageRugs = await prisma.category.create({
        data: {
            title: 'Vintage Rugs',
            slug: 'vintage-rugs',
            description: 'Authentic vintage pieces',
            parentId: rugsCategory.id,
            sortOrder: 3
        }
    })

    // Create subcategories for Textiles
    const pillows = await prisma.category.create({
        data: {
            title: 'Pillows',
            slug: 'pillows',
            description: 'Decorative pillows and cushions',
            parentId: textilesCategory.id,
            sortOrder: 1
        }
    })

    const throws = await prisma.category.create({
        data: {
            title: 'Throws',
            slug: 'throws',
            description: 'Cozy throw blankets',
            parentId: textilesCategory.id,
            sortOrder: 2
        }
    })

    console.log(`✅ Created ${await prisma.category.count()} categories`)

    // Create Types
    console.log('🏷️  Creating types...')
    const handKnotted = await prisma.type.create({
        data: { name: 'Hand-Knotted', slug: 'hand-knotted' }
    })
    const handTufted = await prisma.type.create({
        data: { name: 'Hand-Tufted', slug: 'hand-tufted' }
    })
    const flatWeave = await prisma.type.create({
        data: { name: 'Flat-Weave', slug: 'flat-weave' }
    })
    const machineWoven = await prisma.type.create({
        data: { name: 'Machine-Woven', slug: 'machine-woven' }
    })

    console.log(`✅ Created ${await prisma.type.count()} types`)

    // Create Styles
    console.log('🎨 Creating styles...')
    const contemporary = await prisma.style.create({
        data: { name: 'Contemporary', slug: 'contemporary' }
    })
    const traditional = await prisma.style.create({
        data: { name: 'Traditional', slug: 'traditional' }
    })
    const bohemian = await prisma.style.create({
        data: { name: 'Bohemian', slug: 'bohemian' }
    })
    const minimalist = await prisma.style.create({
        data: { name: 'Minimalist', slug: 'minimalist' }
    })

    console.log(`✅ Created ${await prisma.style.count()} styles`)

    // Create Colors
    console.log('🌈 Creating colors...')
    const colors = [
        { name: 'Beige', slug: 'beige', hex: '#F5F5DC' },
        { name: 'Gray', slug: 'gray', hex: '#808080' },
        { name: 'Blue', slug: 'blue', hex: '#4169E1' },
        { name: 'Red', slug: 'red', hex: '#DC143C' },
        { name: 'Green', slug: 'green', hex: '#228B22' },
        { name: 'Ivory', slug: 'ivory', hex: '#FFFFF0' },
        { name: 'Black', slug: 'black', hex: '#000000' },
        { name: 'Brown', slug: 'brown', hex: '#8B4513' },
    ]

    const createdColors = await Promise.all(
        colors.map(color => prisma.color.create({ data: color }))
    )

    console.log(`✅ Created ${createdColors.length} colors`)

    // Create Sizes
    console.log('📏 Creating sizes...')
    const sizes = [
        { name: '2x3', slug: '2x3' },
        { name: '3x5', slug: '3x5' },
        { name: '4x6', slug: '4x6' },
        { name: '5x7', slug: '5x7' },
        { name: '6x9', slug: '6x9' },
        { name: '8x10', slug: '8x10' },
        { name: '9x12', slug: '9x12' },
        { name: 'Runner', slug: 'runner' },
    ]

    const createdSizes = await Promise.all(
        sizes.map(size => prisma.size.create({ data: size }))
    )

    console.log(`✅ Created ${createdSizes.length} sizes`)

    // Create Ages
    console.log('⏳ Creating ages...')
    const ages = [
        { name: 'New', slug: 'new' },
        { name: 'Semi-Antique (25-50 years)', slug: 'semi-antique' },
        { name: 'Antique (50-100 years)', slug: 'antique' },
        { name: 'Vintage (100+ years)', slug: 'vintage' },
    ]

    const createdAges = await Promise.all(
        ages.map(age => prisma.age.create({ data: age }))
    )

    console.log(`✅ Created ${createdAges.length} ages`)

    // Create Sample Products
    console.log('🛍️  Creating sample products...')

    const products = [
        {
            title: 'Modern Geometric Rug',
            slug: 'modern-geometric-rug',
            description: 'A stunning contemporary rug featuring bold geometric patterns in neutral tones. Hand-tufted with premium wool for lasting quality.',
            price: 899.99,
            compareAtPrice: 1299.99,
            stockCount: 5,
            isStock: true,
            isPublished: true,
            images: JSON.stringify([
                '/images/products/rug-1.jpg',
                '/images/products/rug-1-detail.jpg'
            ]),
            seoTitle: 'Modern Geometric Rug - Premium Hand-Tufted Wool',
            seoDescription: 'Shop our modern geometric rug collection. Hand-tufted premium wool rugs with contemporary designs.',
            seoKeywords: 'modern rug, geometric rug, hand-tufted, wool rug',
            categories: { connect: [{ id: modernRugs.id }] },
            types: { connect: [{ id: handTufted.id }] },
            styles: { connect: [{ id: contemporary.id }] },
            colors: { connect: [{ id: createdColors[0].id }, { id: createdColors[1].id }] },
            sizes: { connect: [{ id: createdSizes[4].id }] },
            ages: { connect: [{ id: createdAges[0].id }] }
        },
        {
            title: 'Persian Traditional Rug',
            slug: 'persian-traditional-rug',
            description: 'Authentic Persian design with intricate floral patterns. Hand-knotted by skilled artisans using traditional techniques.',
            price: 1899.99,
            compareAtPrice: 2499.99,
            stockCount: 3,
            isStock: true,
            isPublished: true,
            images: JSON.stringify([
                '/images/products/rug-2.jpg'
            ]),
            seoTitle: 'Persian Traditional Rug - Hand-Knotted Authentic Design',
            seoDescription: 'Authentic Persian rugs with traditional patterns. Hand-knotted by master artisans.',
            seoKeywords: 'persian rug, traditional rug, hand-knotted, oriental rug',
            categories: { connect: [{ id: traditionalRugs.id }] },
            types: { connect: [{ id: handKnotted.id }] },
            styles: { connect: [{ id: traditional.id }] },
            colors: { connect: [{ id: createdColors[3].id }, { id: createdColors[5].id }] },
            sizes: { connect: [{ id: createdSizes[5].id }] },
            ages: { connect: [{ id: createdAges[1].id }] }
        },
        {
            title: 'Vintage Kilim Runner',
            slug: 'vintage-kilim-runner',
            description: 'Beautiful vintage kilim runner with authentic wear and patina. Perfect for hallways and narrow spaces.',
            price: 599.99,
            stockCount: 2,
            isStock: true,
            isPublished: true,
            images: JSON.stringify([
                '/images/products/rug-3.jpg'
            ]),
            seoTitle: 'Vintage Kilim Runner - Authentic Flat-Weave Rug',
            seoDescription: 'Vintage kilim runners with authentic character. Perfect for hallways and entryways.',
            seoKeywords: 'kilim runner, vintage rug, flat-weave, hallway rug',
            categories: { connect: [{ id: vintageRugs.id }] },
            types: { connect: [{ id: flatWeave.id }] },
            styles: { connect: [{ id: bohemian.id }] },
            colors: { connect: [{ id: createdColors[2].id }, { id: createdColors[4].id }] },
            sizes: { connect: [{ id: createdSizes[7].id }] },
            ages: { connect: [{ id: createdAges[2].id }] }
        },
        {
            title: 'Minimalist Scandinavian Rug',
            slug: 'minimalist-scandinavian-rug',
            description: 'Clean lines and subtle textures define this Scandinavian-inspired rug. Perfect for modern interiors.',
            price: 749.99,
            compareAtPrice: 999.99,
            stockCount: 8,
            isStock: true,
            isPublished: true,
            images: JSON.stringify([
                '/images/products/rug-4.jpg'
            ]),
            seoTitle: 'Minimalist Scandinavian Rug - Modern Nordic Design',
            seoDescription: 'Scandinavian minimalist rugs with clean lines and neutral tones.',
            seoKeywords: 'scandinavian rug, minimalist rug, nordic design, modern rug',
            categories: { connect: [{ id: modernRugs.id }] },
            types: { connect: [{ id: handTufted.id }] },
            styles: { connect: [{ id: minimalist.id }] },
            colors: { connect: [{ id: createdColors[0].id }, { id: createdColors[1].id }] },
            sizes: { connect: [{ id: createdSizes[3].id }] },
            ages: { connect: [{ id: createdAges[0].id }] }
        },
        {
            title: 'Bohemian Decorative Pillow Set',
            slug: 'bohemian-decorative-pillow-set',
            description: 'Set of 2 decorative pillows with vibrant bohemian patterns. Hand-embroidered details.',
            price: 89.99,
            compareAtPrice: 129.99,
            stockCount: 15,
            isStock: true,
            isPublished: true,
            images: JSON.stringify([
                '/images/products/pillow-1.jpg'
            ]),
            seoTitle: 'Bohemian Decorative Pillow Set - Hand-Embroidered',
            seoDescription: 'Vibrant bohemian pillows with hand-embroidered details. Set of 2.',
            seoKeywords: 'bohemian pillow, decorative pillow, throw pillow, embroidered pillow',
            categories: { connect: [{ id: pillows.id }] },
            styles: { connect: [{ id: bohemian.id }] },
            colors: { connect: [{ id: createdColors[3].id }, { id: createdColors[4].id }] }
        },
        {
            title: 'Luxury Cashmere Throw',
            slug: 'luxury-cashmere-throw',
            description: 'Ultra-soft cashmere throw blanket. Perfect for cozy evenings and elegant draping.',
            price: 299.99,
            compareAtPrice: 399.99,
            stockCount: 6,
            isStock: true,
            isPublished: true,
            images: JSON.stringify([
                '/images/products/throw-1.jpg'
            ]),
            seoTitle: 'Luxury Cashmere Throw Blanket - Ultra Soft',
            seoDescription: 'Premium cashmere throw blankets for ultimate comfort and style.',
            seoKeywords: 'cashmere throw, luxury blanket, soft throw, cashmere blanket',
            categories: { connect: [{ id: throws.id }] },
            styles: { connect: [{ id: minimalist.id }] },
            colors: { connect: [{ id: createdColors[0].id }] }
        }
    ]

    for (const product of products) {
        await prisma.product.create({ data: product })
    }

    console.log(`✅ Created ${await prisma.product.count()} products`)

    console.log('💬 Creating support FAQs...')
    const faqSeeds = [
        {
            category: "ORDER_SHIPPING",
            question: "How long does shipping take?",
            answerShort: "Most in-stock rugs ship in 1-2 business days and arrive in 3-8 business days.",
            answerLong: "For in-stock items, we usually dispatch within 1-2 business days. Delivery time depends on your shipping country and selected carrier, but most orders arrive in 3-8 business days. Remote zones and customs checks may add extra time.",
            tags: JSON.stringify(["shipping", "delivery", "timing"]),
            isFeatured: true,
        },
        {
            category: "ORDER_SHIPPING",
            question: "How can I track my order?",
            answerShort: "Open your account orders page to see the carrier and tracking number.",
            answerLong: "When your order ships, we assign a carrier and tracking number. You can view these details in your account order details. We also send a tracking update message in your customer panel.",
            tags: JSON.stringify(["tracking", "order"]),
            isFeatured: true,
        },
        {
            category: "ORDER_SHIPPING",
            question: "Will I pay customs duties?",
            answerShort: "Customs and import taxes are set by your destination country and may apply.",
            answerLong: "Import duties, taxes, and handling fees are controlled by local customs authorities. If charges apply, the shipping carrier usually collects them before or at delivery.",
            tags: JSON.stringify(["customs", "tax", "international"]),
            isFeatured: true,
        },
        {
            category: "CUSTOM_SPECIAL_ORDERS",
            question: "Can I request a custom size?",
            answerShort: "Yes. We can prepare custom dimensions for many rug models.",
            answerLong: "You can request custom width and length for eligible products. Share your target dimensions, preferred style, and budget so we can confirm availability and provide an estimate.",
            tags: JSON.stringify(["custom", "size"]),
            isFeatured: true,
        },
        {
            category: "CUSTOM_SPECIAL_ORDERS",
            question: "How long do custom orders take?",
            answerShort: "Custom production usually takes 4-10 weeks depending on design complexity.",
            answerLong: "Lead time changes based on material, weaving technique, and queue. After we review your custom request, we provide a timeline with milestones and expected shipping date.",
            tags: JSON.stringify(["custom", "timeline", "production"]),
            isFeatured: true,
        },
        {
            category: "INVOICE_PAYMENT",
            question: "How do I get an invoice copy?",
            answerShort: "Submit an invoice request with your order number and email.",
            answerLong: "Use Support > Invoice & Payment and choose Invoice copy. Once verified, we send the invoice PDF to your registered email address.",
            tags: JSON.stringify(["invoice", "billing"]),
            isFeatured: true,
        },
        {
            category: "INVOICE_PAYMENT",
            question: "When will my refund be processed?",
            answerShort: "Approved refunds are usually processed within 3-10 business days.",
            answerLong: "After approval, refund timing depends on your payment provider. Card refunds often appear in 3-10 business days, while bank transfer timelines can vary by country.",
            tags: JSON.stringify(["refund", "payment"]),
            isFeatured: true,
        },
        {
            category: "WHOLESALE_TRADE",
            question: "Do you offer trade pricing?",
            answerShort: "Yes. Verified trade buyers can access tiered wholesale pricing.",
            answerLong: "Trade pricing depends on order volume, collection type, and delivery region. Share your company details and planned quantities to receive a tailored quote.",
            tags: JSON.stringify(["wholesale", "trade", "pricing"]),
            isFeatured: true,
        },
        {
            category: "WHOLESALE_TRADE",
            question: "What is your minimum order quantity?",
            answerShort: "MOQ depends on product type and customization needs.",
            answerLong: "Minimum quantity varies by item category and whether products are stock or custom. Send your target styles and quantity plan so we can confirm MOQ and lead time.",
            tags: JSON.stringify(["wholesale", "moq"]),
            isFeatured: true,
        },
    ]

    await prisma.supportFaq.createMany({ data: faqSeeds })
    console.log(`✅ Created ${await prisma.supportFaq.count()} support FAQs`)

    console.log('🎉 Seed completed successfully!')
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
