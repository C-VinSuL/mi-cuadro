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

const allowedAppOrigins = new Set(
  [appOrigin, ...(Deno.env.get("APP_ALLOWED_ORIGINS") || "").split(",")]
    .map((value) => {
      const candidate = value?.trim();
      if (!candidate) return null;
      try {
        const url = new URL(candidate);
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
    })
    .filter((origin): origin is string => Boolean(origin)),
);

export const corsHeaders: Record<string, string> = {
  ...(appOrigin ? { "Access-Control-Allow-Origin": appOrigin } : {}),
  "Access-Control-Allow-Headers": "authorization, x-client-info, x-browser-user-agent, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

export function corsHeadersForRequest(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const headers = { ...corsHeaders };

  if (origin && allowedAppOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

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

export function rejectUntrustedOriginFromAllowlist(request: Request): Response | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;

  let requestOrigin: string | null = null;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    requestOrigin = null;
  }

  if (requestOrigin && allowedAppOrigins.has(requestOrigin)) return null;

  const configurationMissing = allowedAppOrigins.size === 0;
  return new Response(
    JSON.stringify({
      error: configurationMissing
        ? "Configura APP_URL o APP_ALLOWED_ORIGINS con una URL HTTPS válida para habilitar solicitudes web."
        : "Origen no permitido. Añade el dominio de la aplicación a APP_ALLOWED_ORIGINS.",
    }),
    {
      status: configurationMissing ? 500 : 403,
      headers: {
        ...corsHeadersForRequest(request),
        "Content-Type": "application/json",
      },
    },
  );
}
