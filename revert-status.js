
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function revertPage() {
    const page = await prisma.page.findFirst({
        where: { slug: 'what-is-a-kilim' }
    });

    if (!page) {
        console.log('Page not found');
        return;
    }

    const updated = await prisma.page.update({
        where: { id: page.id },
        data: { status: 'DRAFT' }
    });

    console.log('Reverted status:', updated.status);
}

revertPage()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
