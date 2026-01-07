import { http, HttpResponse } from 'msw'

// MSW handlers for API mocking
export const handlers = [
  // IPFS/Pinata endpoints
  http.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', async ({ request }) => {
    const body = await request.json()
    const cid = `Qm${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`

    return HttpResponse.json({
      IpfsHash: cid,
      PinSize: JSON.stringify(body).length,
      Timestamp: new Date().toISOString()
    })
  }),

  http.delete('https://api.pinata.cloud/pinning/unpin/:cid', () => {
    return HttpResponse.json({ success: true })
  }),

  // Polygon RPC endpoints
  http.post('https://rpc-amoy.polygon.technology', async ({ request }) => {
    const body = await request.json() as { method: string; params?: unknown[] }

    switch (body.method) {
      case 'eth_chainId':
        return HttpResponse.json({ jsonrpc: '2.0', id: 1, result: '0x13882' })

      case 'eth_blockNumber':
        return HttpResponse.json({ jsonrpc: '2.0', id: 1, result: '0x1000000' })

      case 'eth_call':
        // Mock contract calls
        return HttpResponse.json({ jsonrpc: '2.0', id: 1, result: '0x' })

      case 'eth_sendRawTransaction':
        const txHash = `0x${Date.now().toString(16)}${'0'.repeat(48)}`
        return HttpResponse.json({ jsonrpc: '2.0', id: 1, result: txHash })

      default:
        return HttpResponse.json({ jsonrpc: '2.0', id: 1, result: null })
    }
  }),

  // MCP SSE endpoint
  http.get('*/sse', () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection event
        controller.enqueue(encoder.encode('event: open\ndata: {}\n\n'))
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    })
  }),

  // MCP message endpoint
  http.post('*/message', async ({ request }) => {
    const body = await request.json() as { method: string }

    // Mock MCP protocol responses
    return HttpResponse.json({
      jsonrpc: '2.0',
      id: 1,
      result: {
        method: body.method,
        success: true
      }
    })
  })
]

// Error simulation handlers
export const errorHandlers = [
  http.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', () => {
    return HttpResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }),

  http.post('https://rpc-amoy.polygon.technology', () => {
    return HttpResponse.json(
      { jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'insufficient funds' } }
    )
  })
]

// Timeout simulation handlers
export const timeoutHandlers = [
  http.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', async () => {
    await new Promise(resolve => setTimeout(resolve, 30000))
    return HttpResponse.json({})
  })
]
