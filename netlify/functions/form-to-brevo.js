exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const CONFIRMATION_TEMPLATE_ID = 2;

    // Brevo list IDs from your account
    const NEW_ENQUIRY_LIST_ID = 2; // Enquiries - New

    const EVENT_TYPE_LISTS = {
      "Corporate event or gala":          3,
      "Nightclub or venue booking":       4,
      "Race day or motorsport event":     5,
      "Hens party":                       6,
      "Wedding":                          7,
      "Festival or outdoor event":        8,
      "Private event":                    9,
      "Brand activation":                 10,
      "Not sure yet — happy to discuss":  2
    };

    // Netlify outgoing webhooks send JSON with form fields inside a "data" object
    let name, email, phone, eventType, eventDate, flexibleDate, message;

    try {
      const payload = JSON.parse(event.body);
      const data = payload.data || payload;
      name         = data["name"]          || "";
      email        = data["email"]         || "";
      phone        = data["phone"]         || "";
      eventType    = data["event-type"]    || "";
      eventDate    = data["event-date"]    || "";
      flexibleDate = data["flexible-date"] || "";
      message      = data["message"]       || "";
    } catch (e) {
      // Fallback: URL-encoded
      const params = new URLSearchParams(event.body);
      name         = params.get("name")          || "";
      email        = params.get("email")         || "";
      phone        = params.get("phone")         || "";
      eventType    = params.get("event-type")    || "";
      eventDate    = params.get("event-date")    || "";
      flexibleDate = params.get("flexible-date") || "";
      message      = params.get("message")       || "";
    }

    if (!email) {
      return { statusCode: 400, body: "No email provided" };
    }

    const firstName = name.split(" ")[0] || name;
    const lastName  = name.split(" ").slice(1).join(" ") || "";

    // Always add to Enquiries - New, plus event type list if different
    const listIds = [NEW_ENQUIRY_LIST_ID];
    const eventListId = EVENT_TYPE_LISTS[eventType];
    if (eventListId && eventListId !== NEW_ENQUIRY_LIST_ID) {
      listIds.push(eventListId);
    }

    // 1. Create or update contact in Brevo
    const contactRes = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY
      },
      body: JSON.stringify({
        email:         email,
        firstName:     firstName,
        lastName:      lastName,
        listIds:       listIds,
        updateEnabled: true,
        attributes: {
          FIRSTNAME:     firstName,
          LASTNAME:      lastName,
          PHONE:         phone,
          EVENT_TYPE:    eventType,
          EVENT_DATE:    eventDate,
          FLEXIBLE_DATE: flexibleDate === "yes" ? "Yes" : "No",
          MESSAGE:       message
        }
      })
    });

    if (!contactRes.ok) {
      const err = await contactRes.text();
      console.error("Brevo contact error:", err);
    }

    // 2. Send confirmation email via transactional template
    const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": BREVO_API_KEY
      },
      body: JSON.stringify({
        to: [{ email: email, name: name }],
        templateId: CONFIRMATION_TEMPLATE_ID,
        params: {
          FIRSTNAME:  firstName,
          EVENT_TYPE: eventType,
          EVENT_DATE: eventDate
        }
      })
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error("Brevo email error:", err);
    }

    return { statusCode: 200, body: "OK" };

  } catch (err) {
    console.error("Function error:", err);
    return { statusCode: 500, body: "Server error" };
  }
};
