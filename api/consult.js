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
  "Another space in my home",
  "Not sure yet",
]);

const SPACES = [
  "Closet",
  "Kitchen & pantry",
  "Bathroom",
  "Home office",
  "Kids' room / playroom",
  "Linen or utility closet",
];

const TIMELINES = new Set([
  "Within 2 weeks",
  "This month",
  "Just exploring",
]);

const HEARD = new Set([
  "Instagram",
  "Google",
  "Friend or referral",
  "Event or auction",
  "Other",
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

function parseSpaces(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > SPACES.length) return null;
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== "string") return null;
    const space = cleanLine(item, 40);
    if (!SPACES.includes(space) || seen.has(space)) return null;
    seen.add(space);
  }
  return SPACES.filter((space) => seen.has(space));
}

export function parseInquiry(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, field: "form" };
  }

  for (const key of ["name", "email", "phone", "zip", "neighborhood", "service", "message", "heard", "timeline"]) {
    if (data[key] !== undefined && data[key] !== null && typeof data[key] !== "string") {
      return { ok: false, field: "form" };
    }
  }

  const name = cleanLine(data.name, 100);
  const email = cleanLine(data.email, 254);
  const phone = cleanLine(data.phone, 40);
  const zip = cleanLine(data.zip, 10);
  const neighborhood = cleanLine(data.neighborhood, 40);
  const spaces = parseSpaces(data.spaces);
  const timeline = cleanLine(data.timeline, 40);
  const service = cleanLine(data.service, 40);
  const heard = cleanLine(data.heard, 40);
  const message = cleanMessage(data.message);

  if (!name) return { ok: false, field: "name" };
  if (!validEmail(email)) return { ok: false, field: "email" };
  if (phone && !/^[0-9+().\-\s]+$/.test(phone)) return { ok: false, field: "form" };
  if (!/^\d{5}$/.test(zip)) return { ok: false, field: "zip" };
  if (neighborhood && !NEIGHBORHOODS.has(neighborhood)) return { ok: false, field: "form" };
  if (!spaces) return { ok: false, field: "spaces" };
  if (!TIMELINES.has(timeline)) return { ok: false, field: "timeline" };
  if (service && !SERVICES.has(service)) return { ok: false, field: "form" };
  if (heard && !HEARD.has(heard)) return { ok: false, field: "form" };
  if (String(data.message ?? "").trim().length > 4000) return { ok: false, field: "message" };

  return {
    ok: true,
    fields: { name, email, phone, zip, neighborhood, spaces, timeline, service, heard, message },
  };
}

export function formatInquiry(fields) {
  return [
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    `Phone: ${fields.phone || "(not provided)"}`,
    `ZIP: ${fields.zip}`,
    `Neighborhood: ${fields.neighborhood || "(not provided)"}`,
    `Spaces: ${fields.spaces.join(", ")}`,
    `Timeline: ${fields.timeline}`,
    `Interested in: ${fields.service || "Not sure yet"}`,
    `How they heard about us: ${fields.heard || "(not provided)"}`,
    "",
    "Message:",
    fields.message || "(not provided)",
  ].join("\n");
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

    const parsed = parseInquiry(data);
    if (!parsed.ok) {
      return json({ ok: false, error: "validation", field: parsed.field }, 400);
    }

    const apiKey = String(process.env.RESEND_API_KEY || "").trim();
    if (!apiKey) {
      console.error("consult form: RESEND_API_KEY is not set");
      return json({ ok: false, error: "send" }, 503);
    }

    const { name, email } = parsed.fields;
    const text = formatInquiry(parsed.fields);

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
