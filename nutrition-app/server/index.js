import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const clientId = process.env.FATSECRET_CLIENT_ID;
  const clientSecret = process.env.FATSECRET_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("FatSecret credentials are missing. Check your .env file.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "premier",
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("FatSecret token error:", details);
    throw new Error(`Authentication failed with status ${response.status}.`);
  }

  const data = await response.json();

  cachedToken = data.access_token;

  // Refresh one minute before the token expires.
  tokenExpiresAt = Date.now() + Math.max(0, data.expires_in - 60) * 1000;

  return cachedToken;
}

async function requestFatSecret(path, parameters = {}) {
  const token = await getAccessToken();

  const url = new URL(`https://platform.fatsecret.com/rest/${path}`);

  for (const [key, value] of Object.entries(parameters)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("FatSecret API error:", details);
    throw new Error(`Food service returned status ${response.status}.`);
  }

  return response.json();
}

// Search for foods.
app.get("/api/foods/search", async (req, res) => {
  try {
    const query = String(req.query.query || "").trim();

    if (!query) {
      return res.status(400).json({
        error: "Please enter a food to search for.",
      });
    }

    const data = await requestFatSecret("foods/search/v5", {
      search_expression: query,
      max_results: 10,
      page_number: 0,
      format: "json",
      include_food_images: true,
      flag_default_serving: true,
      region: "US",
    });

    res.json(data);
  } catch (error) {
    console.error("Food search failed:", error.message);

    res.status(502).json({
      error: error.message || "Unable to search foods.",
    });
  }
});

// Retrieve the details and serving options for one food.
app.get("/api/foods/:foodId", async (req, res) => {
  try {
    const foodId = String(req.params.foodId);

    if (!/^\d+$/.test(foodId)) {
      return res.status(400).json({
        error: "The food ID is invalid.",
      });
    }

    const data = await requestFatSecret("food/v5", {
      food_id: foodId,
      format: "json",
      include_food_images: true,
      flag_default_serving: true,
      region: "US",
    });

    res.json(data);
  } catch (error) {
    console.error("Food details failed:", error.message);

    res.status(502).json({
      error: error.message || "Unable to retrieve food details.",
    });
  }
});

app.listen(PORT, () => {
  console.log(`FatSecret backend running at http://localhost:${PORT}`);
});
