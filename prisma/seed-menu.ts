import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding Primary Menu...')

    // Get all categories
    const categories = await prisma.category.findMany({
        orderBy: { sortOrder: 'asc' }
    })

    console.log(`Found ${categories.length} categories`)

    // Delete existing PRIMARY_HEADER menu if exists
    const existingMenu = await prisma.menu.findFirst({
        where: { location: 'PRIMARY_HEADER' }
    })

    if (existingMenu) {
        console.log('Deleting existing PRIMARY_HEADER menu...')
        await prisma.menuItem.deleteMany({
            where: { menuId: existingMenu.id }
        })
        await prisma.menu.delete({
            where: { id: existingMenu.id }
        })
    }

    // Create PRIMARY_HEADER menu
    const menu = await prisma.menu.create({
        data: {
            title: 'Primary Navigation',
            slug: 'primary-navigation',
            location: 'PRIMARY_HEADER'
        }
    })

    console.log(`Created menu: ${menu.title}`)

    // Add all categories as menu items
    let sortOrder = 0
    for (const category of categories) {
        await prisma.menuItem.create({
            data: {
                menuId: menu.id,
                type: 'CATEGORY',
                label: category.title,
                url: `/category/${category.slug}`,
                referenceId: category.id,
                sortOrder: sortOrder++,
                parentId: category.parentId ? null : null // We'll handle nesting in a second pass if needed
            }
        })
        console.log(`  ✓ Added: ${category.title}`)
    }

    console.log('✅ Primary Menu seeded successfully!')
}

main()
    .catch((e) => {
        console.error('❌ Error seeding menu:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
