
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updatePage() {
    const page = await prisma.page.findFirst({
        where: { slug: 'what-is-a-kilim' }
    });

    if (!page) {
        console.log('Page not found');
        return;
    }

    console.log('Current status:', page.status);

    const updated = await prisma.page.update({
        where: { id: page.id },
        data: { status: 'PUBLISHED' }
    });

    console.log('Updated status:', updated.status);
}

updatePage()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
