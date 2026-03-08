
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const menus = await prisma.menu.findMany({
    include: {
      items: true
    }
  })

  console.log('--- MENUS ---')
  menus.forEach(m => {
    console.log(`[ID: ${m.id}] Title: ${m.title} | Location: ${m.location || 'NONE'}`)
    console.log(`    Total Items: ${m.items.length}`)

    // Count children of 'By Type'
    const byType = m.items.find(i => i.label === 'By Type')
    if (byType) {
      const children = m.items.filter(i => i.parentId === byType.id)
      console.log(`    By Type Children: ${children.length}`)

      // Log the missing ones?
      if (children.length < 10 && m.items.length > 10) {
        console.log('    Only ' + children.length + ' children found. Listing all roots:')
        const roots = m.items.filter(i => !i.parentId)
        console.log(roots.map(r => r.label).join(', '))
      }
    } else {
      console.log('    By Type: Not Found')
    }
  })
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect())
