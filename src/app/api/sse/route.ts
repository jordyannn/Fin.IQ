export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Kirim event koneksi awal
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "ok", time: Date.now() })}\n\n`)
      );

      // Heartbeat setiap 25 detik agar koneksi tetap hidup di Vercel Serverless
      const interval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`event: ping\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`)
          );
        } catch (e) {
          clearInterval(interval);
        }
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
