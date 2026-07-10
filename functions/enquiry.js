// Cloudflare Pages Function — handles the enquiry form POST from index.html.
// Replaces Netlify Forms + the netlify/functions/form-to-brevo.js webhook.
// On submit it: (1) adds/updates the contact in Brevo and files them onto the
// right list, (2) sends the enquirer a confirmation email (Brevo template #2),
// (3) emails the internal team a notification (Netlify Forms used to do this),
// then redirects the browser to /thank-you.

const CONFIRMATION_TEMPLATE_ID = 2;
const NEW_ENQUIRY_LIST_ID = 2; // "Enquiries - New"

const EVENT_TYPE_LISTS = {
  "Corporate event or gala":          3,
  "Nightclub or venue booking":       4,
  "Race day or motorsport event":     5,
  "Hens party":                       6,
  "Wedding":                          7,
  "Festival or outdoor event":        8,
  "Private event":                    9,
  "Brand activation":                 10,
  "Not sure yet — happy to discuss":  2,
};

function redirect(location) {
  return new Response(null, { status: 303, headers: { Location: location } });
}

// Escape a user-supplied form value before interpolating it into email HTML
// (closes an HTML-injection hole in the internal notification email).
function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const BREVO_API_KEY = env.BREVO_API_KEY;

  // Internal notification target + sender (verified sender required in Brevo).
  const NOTIFY_TO   = env.NOTIFY_TO   || "slayentertainmentco@gmail.com";
  const NOTIFY_FROM = env.NOTIFY_FROM || "hello@slayentertainment.co";

  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return redirect("/thank-you");
  }

  // Honeypot: bots fill the hidden bot-field. Pretend success, do nothing.
  if ((form.get("bot-field") || "").trim() !== "") {
    return redirect("/thank-you");
  }

  const name         = (form.get("name")          || "").trim();
  const email        = (form.get("email")         || "").trim();
  const phone        = (form.get("phone")         || "").trim();
  const eventType    = (form.get("event-type")    || "").trim();
  const eventDate    = (form.get("event-date")    || "").trim();
  const flexibleDate = (form.get("flexible-date") || "").trim();
  const message      = (form.get("message")       || "").trim();
  const pkg          = (form.get("package")       || "").trim();

  // No email means nothing useful to store — still send them to thank-you.
  if (!email) {
    return redirect("/thank-you");
  }

  const firstName = name.split(" ")[0] || name;
  const lastName  = name.split(" ").slice(1).join(" ") || "";

  const listIds = [NEW_ENQUIRY_LIST_ID];
  const eventListId = EVENT_TYPE_LISTS[eventType];
  if (eventListId && eventListId !== NEW_ENQUIRY_LIST_ID) {
    listIds.push(eventListId);
  }

  const brevo = (path, body) =>
    fetch(`https://api.brevo.com/v3/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": BREVO_API_KEY },
      body: JSON.stringify(body),
    });

  // 1. Create or update the contact in Brevo.
  try {
    const contactRes = await brevo("contacts", {
      email,
      firstName,
      lastName,
      listIds,
      updateEnabled: true,
      attributes: {
        FIRSTNAME:     firstName,
        LASTNAME:      lastName,
        PHONE:         phone,
        EVENT_TYPE:    eventType,
        EVENT_DATE:    eventDate,
        FLEXIBLE_DATE: flexibleDate === "yes" || flexibleDate === "on" ? "Yes" : "No",
        MESSAGE:       message,
        PACKAGE:       pkg,
      },
    });
    if (!contactRes.ok) console.error("Brevo contact error:", await contactRes.text());
  } catch (err) {
    console.error("Brevo contact exception:", err);
  }

  // 2. Send the enquirer a confirmation email (transactional template).
  try {
    const confRes = await brevo("smtp/email", {
      to: [{ email, name }],
      templateId: CONFIRMATION_TEMPLATE_ID,
      params: { FIRSTNAME: firstName, EVENT_TYPE: eventType, EVENT_DATE: eventDate },
    });
    if (!confRes.ok) console.error("Brevo confirmation error:", await confRes.text());
  } catch (err) {
    console.error("Brevo confirmation exception:", err);
  }

  // 3. Notify the team (Netlify Forms did this automatically before).
  try {
    const rows = [
      ["Name", name], ["Email", email], ["Phone", phone],
      ["Event type", eventType], ["Event date", eventDate],
      ["Flexible date", flexibleDate], ["Package", pkg], ["Message", message],
    ].filter(([, v]) => v)
     .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;font-weight:600">${k}</td><td>${escapeHtml(v)}</td></tr>`)
     .join("");

    const notifyRes = await brevo("smtp/email", {
      sender: { email: NOTIFY_FROM, name: "Slay Entertainment site" },
      to: [{ email: NOTIFY_TO }],
      replyTo: { email, name },
      subject: `New enquiry — ${name || email}${eventType ? " · " + eventType : ""}`,
      htmlContent: `<h2>New enquiry from slayentertainment.co</h2><table>${rows}</table>`,
    });
    if (!notifyRes.ok) console.error("Brevo notify error:", await notifyRes.text());
  } catch (err) {
    console.error("Brevo notify exception:", err);
  }

  return redirect("/thank-you");
}

// A GET to /enquiry (e.g. someone hitting the URL directly) just goes home.
export async function onRequestGet() {
  return redirect("/");
}
