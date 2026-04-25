const https = require("https");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let params;
  const contentType = event.headers["content-type"] || "";

  if (contentType.includes("application/json")) {
    const body = JSON.parse(event.body || "{}");
    params = { get: (k) => body[k] ?? null };
  } else {
    const urlParams = new URLSearchParams(event.body || "");
    params = { get: (k) => urlParams.get(k) };
  }

  const name       = params.get("name")       || "";
  const email      = params.get("email")      || "";
  const phone      = params.get("phone")      || "";
  const eventDate  = params.get("event-date") || "";
  const eventType  = params.get("event-type") || "";
  const message    = params.get("message")    || "";

  if (!email) {
    return { statusCode: 400, body: "Email is required" };
  }

  const [firstName, ...rest] = name.trim().split(" ");
  const lastName = rest.join(" ") || "-";

  const contact = {
    email,
    firstName,
    lastName,
    attributes: {
      PHONE:      phone,
      EVENT_TYPE: eventType,
      EVENT_DATE: eventDate,
      MESSAGE:    message,
    },
    listIds: [Number(process.env.BREVO_LIST_ID || 2)],
    updateEnabled: true,
  };

  await brevoRequest("POST", "/v3/contacts", contact);

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true }),
  };
};

function brevoRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: "api.brevo.com",
      path,
      method,
      headers: {
        "Content-Type":  "application/json",
        "Content-Length": Buffer.byteLength(data),
        "api-key": process.env.BREVO_API_KEY,
      },
    };
    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => { raw += chunk; });
      res.on("end", () => {
        if (res.statusCode >= 400) {
          reject(new Error(`Brevo ${res.statusCode}: ${raw}`));
        } else {
          resolve(JSON.parse(raw || "{}"));
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}
