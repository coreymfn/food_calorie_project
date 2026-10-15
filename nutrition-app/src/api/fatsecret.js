const API_BASE_URL = "http://localhost:3001/api/foods";

async function request(url) {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Unable to retrieve food data.");
  }

  return data;
}

export async function searchFoods(query) {
  const params = new URLSearchParams({ query });
  const data = await request(`${API_BASE_URL}/search?${params.toString()}`);

  const results =
    data.foods_search?.results?.food ??
    data.foods_search?.food ??
    data.foods?.food ??
    [];

  // FatSecret may return one object or an array.
  return (Array.isArray(results) ? results : results ? [results] : []).map(
    (food) => ({
      id: String(food.food_id),
      fdcId: String(food.food_id),
      name: food.food_name,
      brand: food.brand_name || "",
      type: food.food_type || "Generic",
      description: food.food_description || "",
      image: getFoodImage(food),
      original: food,
    }),
  );
}

export async function getFoodDetails(foodId) {
  const data = await request(`${API_BASE_URL}/${encodeURIComponent(foodId)}`);

  const food = data.food || data.food_get?.food;

  if (!food) {
    throw new Error("Food details were not found in the API response.");
  }

  const servingData = food.servings?.serving ?? [];
  const servings = Array.isArray(servingData) ? servingData : [servingData];

  return {
    id: String(food.food_id),
    fdcId: String(food.food_id),
    name: food.food_name,
    brand: food.brand_name || "",
    type: food.food_type || "Generic",
    image: getFoodImage(food),
    servings: servings.filter(Boolean).map((serving) => ({
      id: String(serving.serving_id || ""),
      description: serving.serving_description || "Serving",
      calories: Number(serving.calories) || 0,
      protein: Number(serving.protein) || 0,
      carbs: Number(serving.carbohydrate) || 0,
      fat: Number(serving.fat) || 0,
      grams: Number(serving.metric_serving_amount) || null,
      metricUnit: serving.metric_serving_unit || "",
      isDefault: String(serving.is_default) === "1",
    })),
    original: food,
  };
}

function getFoodImage(food) {
  const imageData = food.food_images?.food_image ?? food.food_image ?? [];
  const images = Array.isArray(imageData)
    ? imageData
    : imageData
      ? [imageData]
      : [];

  return images.find((item) => item.image_url)?.image_url || "";
}
