
import { prisma } from "./src/lib/db"

async function main() {
    console.log("--- DIAGNOSTIC START ---");
    try {
        const count = await prisma.category.count();
        console.log(`Total Categories in DB: ${count}`);

        if (count > 0) {
            const sample = await prisma.category.findMany({ take: 5 });
            console.log("Sample Categories:", JSON.stringify(sample, null, 2));
        } else {
            console.log("WARNING: DB table 'Category' is empty.");
        }

    } catch (error) {
        console.error("DIAGNOSTIC ERROR: DB Connection Failed");
        console.error(error);
    } finally {
        console.log("--- DIAGNOSTIC END ---");
    }
}

main();
