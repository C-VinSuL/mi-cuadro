const appUrl = Deno.env.get("APP_URL");

const appOrigin = (() => {
  if (!appUrl) return null;

  try {
    const url = new URL(appUrl);
    if (
      url.protocol !== "https:"
      && url.hostname !== "localhost"
      && url.hostname !== "127.0.0.1"
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
})();

export const corsHeaders: Record<string, string> = {
  ...(appOrigin ? { "Access-Control-Allow-Origin": appOrigin } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-browser-user-agent, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

export function rejectUntrustedOrigin(request: Request): Response | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;

  let requestOrigin: string | null = null;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    requestOrigin = null;
  }

  if (appOrigin && requestOrigin === appOrigin) return null;

  const configurationMissing = !appOrigin;
  return new Response(
    JSON.stringify({
      error: configurationMissing
        ? "APP_URL debe ser una URL HTTPS válida para habilitar solicitudes web."
        : "Origen no permitido.",
    }),
    {
      status: configurationMissing ? 500 : 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
