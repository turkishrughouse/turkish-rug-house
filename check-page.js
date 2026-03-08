
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPage() {
    const page = await prisma.page.findFirst({
        where: { slug: 'what-is-a-kilim' }
    });
    console.log('Page:', page);
}

checkPage()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
