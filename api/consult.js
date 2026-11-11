// Vercel Function: POST /api/consult emails a consultation request through Resend.
// RESEND_API_KEY is read from the environment only.

const TO = "hello@theblackbookllc.com";
const FROM = "The Blackbook LLC <hello@theblackbookllc.com>";

const NEIGHBORHOODS = new Set([
  "Bethesda",
  "Potomac",
  "Chevy Chase",
  "Rockville",
  "NW DC",
  "Elsewhere nearby",
]);

const SERVICES = new Set([
  "The Closet Edit",
  "The Seasonal Switch",
  "The Complete Reset",
  "Maintenance Visit",
  "Not sure yet",
]);

function json(body, status) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function cleanLine(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanMessage(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 4000);
}

function validEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function originAllowed(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = url.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (url.protocol !== "https:") return false;
  if (host === "theblackbookllc.com" || host === "www.theblackbookllc.com") return true;
  return host.endsWith(".vercel.app");
}

function redact(text) {
  return String(text || "").replace(/re_[A-Za-z0-9_]+/g, "[redacted]");
}

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return json({ ok: false, error: "method" }, 405);
    }
    if (!originAllowed(request)) {
      return json({ ok: false, error: "send" }, 403);
    }

    const type = (request.headers.get("content-type") || "").toLowerCase();
    if (!type.includes("application/json")) {
      return json({ ok: false, error: "validation", field: "form" }, 400);
    }

    const raw = await request.text();
    if (raw.length > 20000) {
      return json({ ok: false, error: "validation", field: "message" }, 400);
    }

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return json({ ok: false, error: "validation", field: "form" }, 400);
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return json({ ok: false, error: "validation", field: "form" }, 400);
    }

    const honeypot = data.bbl_hp;
    if (honeypot !== undefined && honeypot !== null && String(honeypot).trim() !== "") {
      return json({ ok: true }, 200);
    }

    for (const key of ["name", "email", "phone", "neighborhood", "service", "message"]) {
      if (data[key] !== undefined && data[key] !== null && typeof data[key] !== "string") {
        return json({ ok: false, error: "validation", field: "form" }, 400);
      }
    }

    const name = cleanLine(data.name, 100);
    const email = cleanLine(data.email, 254);
    const phone = cleanLine(data.phone, 40);
    const neighborhood = cleanLine(data.neighborhood, 40);
    const service = cleanLine(data.service, 40);
    const message = cleanMessage(data.message);

    if (!name) return json({ ok: false, error: "validation", field: "name" }, 400);
    if (!validEmail(email)) return json({ ok: false, error: "validation", field: "email" }, 400);
    if (phone && !/^[0-9+().\-\s]+$/.test(phone)) {
      return json({ ok: false, error: "validation", field: "form" }, 400);
    }
    if (neighborhood && !NEIGHBORHOODS.has(neighborhood)) {
      return json({ ok: false, error: "validation", field: "form" }, 400);
    }
    if (service && !SERVICES.has(service)) {
      return json({ ok: false, error: "validation", field: "form" }, 400);
    }
    if (String(data.message ?? "").trim().length > 4000) {
      return json({ ok: false, error: "validation", field: "message" }, 400);
    }

    const apiKey = String(process.env.RESEND_API_KEY || "").trim();
    if (!apiKey) {
      console.error("consult form: RESEND_API_KEY is not set");
      return json({ ok: false, error: "send" }, 503);
    }

    const text = [
      `Name: ${name}`,
      `Email: ${email}`,
      `Phone: ${phone || "(not provided)"}`,
      `Neighborhood: ${neighborhood || "(not provided)"}`,
      `Interested in: ${service || "Not sure yet"}`,
      "",
      "Message:",
      message || "(not provided)",
    ].join("\n");

    let resendResponse;
    try {
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [TO],
          reply_to: email,
          subject: `Consultation request: ${name}`.slice(0, 150),
          text,
        }),
      });
    } catch (error) {
      console.error("consult form send failed", redact(error && error.message));
      return json({ ok: false, error: "send" }, 502);
    }

    if (!resendResponse.ok) {
      const detail = await resendResponse.text().catch(() => "");
      console.error("consult form send failed", resendResponse.status, redact(detail).slice(0, 500));
      return json({ ok: false, error: "send" }, 502);
    }

    const sent = await resendResponse.json().catch(() => ({}));
    console.log("consult form sent", sent && sent.id ? sent.id : "");
    return json({ ok: true }, 200);
  },
};
