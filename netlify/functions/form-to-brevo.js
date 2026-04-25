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
      "Corporate event or gala":          3,  // Enquiries - Corporate
      "Nightclub or venue booking":       4,  // Enquiries - Nightclub
      "Race day or motorsport event":     5,  // Enquiries - Race Day
      "Hens party":                       6,  // Enquiries - Hens
      "Wedding":                          7,  // Enquiries - Wedding
      "Festival or outdoor event":        8,  // Enquiries - Festival
      "Private event":                    9,  // Enquiries - Private
      "Brand activation":                 10, // Enquiries - Brand Activation
      "Not sure yet — happy to discuss":  2   // Falls back to Enquiries - New only
    };

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
