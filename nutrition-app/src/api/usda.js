const API_KEY = import.meta.env.VITE_USDA_API_KEY;

const BASE_URL = "https://api.nal.usda.gov/fdc/v1";

export async function searchFoods(query) {
  if (!API_KEY) {
    throw new Error("Missing USDA API key. Check your .env file.");
  }

  const response = await fetch(
    `${BASE_URL}/foods/search?api_key=${encodeURIComponent(API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        pageSize: 10,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`USDA API error: ${response.status}`);
  }

  const data = await response.json();

  return data.foods ?? [];
}

export async function getFoodDetails(fdcId) {
  if (!API_KEY) {
    throw new Error("Missing USDA API key. Check your .env file.");
  }

  const response = await fetch(
    `${BASE_URL}/food/${fdcId}?api_key=${encodeURIComponent(API_KEY)}`,
  );

  if (!response.ok) {
    throw new Error(`USDA API error: ${response.status}`);
  }

  return await response.json();
}
