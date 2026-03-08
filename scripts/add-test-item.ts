
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    // 1. Find Primary Menu
    const menu = await prisma.menu.findFirst({
        where: { location: "PRIMARY_HEADER" },
        include: { items: true }
    })

    if (!menu) throw new Error("Primary menu not found")

    // 2. Find "By Color" item
    const byColor = menu.items.find(i => i.label === "By Color")

    if (!byColor) throw new Error("'By Color' root item not found")

    console.log(`Found 'By Color' ID: ${byColor.id}`)

    // 3. Create Test Item "Test Blue"
    const created = await prisma.menuItem.create({
        data: {
            menuId: menu.id,
            label: "Test Blue",
            type: "CUSTOM",
            url: "/test-blue",
            parentId: byColor.id,
            sortOrder: 0
        }
    })

    console.log(`Created test item 'Test Blue' with ID: ${created.id}`)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
