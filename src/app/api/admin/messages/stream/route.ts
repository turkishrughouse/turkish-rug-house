import { NextRequest } from "next/server"
import { messageEvents } from "@/lib/message-events"

export const dynamic = "force-dynamic"

/**
 * GET /api/admin/messages/stream
 * Server-Sent Events endpoint for real-time message notifications
 */
export async function GET(req: NextRequest) {
    // Create a unique client ID
    const clientId = Math.random().toString(36).substring(7)

    // Create a readable stream
    const stream = new ReadableStream({
        start(controller) {
            // Add client to the event emitter
            messageEvents.addClient({ id: clientId, controller })

            // Send initial connection message
            const initialMessage = `data: ${JSON.stringify({ type: "connected", clientId })}\n\n`
            controller.enqueue(new TextEncoder().encode(initialMessage))

            // Handle client disconnect
            req.signal.addEventListener("abort", () => {
                messageEvents.removeClient(clientId)
                controller.close()
            })
        },
    })

    // Return SSE response
    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    })
}
