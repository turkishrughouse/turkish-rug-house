/**
 * Message Events - Server-Sent Events (SSE) Emitter
 * Manages real-time message notifications to admin clients
 */

type MessageEventData = {
    id: string
    source: string
    status: string
    name?: string | null
    email?: string | null
    phone?: string | null
    subject?: string | null
    content: string
    receivedAt: Date
}

type SSEClient = {
    id: string
    controller: ReadableStreamDefaultController
}

class MessageEventEmitter {
    private clients: Set<SSEClient> = new Set()

    /**
     * Add a new SSE client
     */
    addClient(client: SSEClient): void {
        this.clients.add(client)
        console.log(`[SSE] Client connected. Total clients: ${this.clients.size}`)
    }

    /**
     * Remove an SSE client
     */
    removeClient(clientId: string): void {
        const client = Array.from(this.clients).find((c) => c.id === clientId)
        if (client) {
            this.clients.delete(client)
            console.log(`[SSE] Client disconnected. Total clients: ${this.clients.size}`)
        }
    }

    /**
     * Broadcast new message event to all connected clients
     */
    broadcastNewMessage(message: MessageEventData): void {
        const eventData = {
            type: "new_message",
            data: {
                id: message.id,
                source: message.source,
                status: message.status,
                from: message.name || message.email || message.phone || "Unknown",
                preview: message.subject || message.content.substring(0, 100),
                receivedAt: message.receivedAt.toISOString(),
            },
        }

        const payload = `data: ${JSON.stringify(eventData)}\n\n`

        // Send to all connected clients
        this.clients.forEach((client) => {
            try {
                client.controller.enqueue(new TextEncoder().encode(payload))
            } catch (error) {
                console.error("[SSE] Error sending to client:", error)
                this.clients.delete(client)
            }
        })

        console.log(`[SSE] Broadcasted new message to ${this.clients.size} clients`)
    }

    /**
     * Send keep-alive ping to all clients
     */
    sendKeepAlive(): void {
        const payload = `: keep-alive\n\n`

        this.clients.forEach((client) => {
            try {
                client.controller.enqueue(new TextEncoder().encode(payload))
            } catch (error) {
                console.error("[SSE] Error sending keep-alive:", error)
                this.clients.delete(client)
            }
        })
    }

    /**
     * Get number of connected clients
     */
    getClientCount(): number {
        return this.clients.size
    }
}

// Singleton instance
export const messageEvents = new MessageEventEmitter()

// Start keep-alive interval (every 30 seconds)
if (typeof window === "undefined") {
    // Only run on server
    setInterval(() => {
        messageEvents.sendKeepAlive()
    }, 30000)
}
