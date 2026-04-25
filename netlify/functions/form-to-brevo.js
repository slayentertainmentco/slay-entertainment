exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const CONFIRMATION_TEMPLATE_ID = 2;

    // Map event-type values to Brevo list IDs
    // Replace these numbers with your actual list IDs from Brevo → Contacts → Lists
    const EVENT_TYPE_LISTS = {
      "Corporate event or gala":            3,
      "Brand activation":                   4,
      "Nightclub or venue booking":         5,
      "Race day or motorsport event":       6,
      "Hens party":                         7,
      "Wedding":                            8,
      "Festival or outdoor event":          9,
      "Private event":                      10,
      "Not sure yet — happy to discuss":    11
    };

    const NEW_ENQUIRY_LIST_ID = 2; // Your "Enquiries - New" list ID

    // Parse form fields from Netlify's URL-encoded POST body
    const params = new URLSearchParams(event.body);
    const name         = params.get("name")         || "";
    const email        = params.get("email")        || "";
    const eventType    = params.get("event-type")   || "";
    const eventDate    = params.get("event-date")   || "";
    const flexibleDate = params.get("flexible-date") || "";
    const message      = params.get("message")      || "";

    if (!email) {
      return { statusCode: 400, body: "No email provided" };
    }

    const firstName = name.split(" ")[0] || name;
    const lastName  = name.split(" ").slice(1).join(" ") || "";

    // Always add to "Enquiries - New", plus the matching event type list
    const listIds = [NEW_ENQUIRY_LIST_ID];
    if (EVENT_TYPE_LISTS[eventType]) {
      listIds.push(EVENT_TYPE_LISTS[eventType]);
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
          FIRSTNAME:      firstName,
          LASTNAME:       lastName,
          EVENT_TYPE:     eventType,
          EVENT_DATE:     eventDate,
          FLEXIBLE_DATE:  flexibleDate === "yes" ? "Yes" : "No",
          MESSAGE:        message
        }
      })
    });

    if (!contactRes.ok) {
      const err = await contactRes.text();
      console.error("Brevo contact error:", err);
      // Don't return error — still try to send the confirmation email
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
