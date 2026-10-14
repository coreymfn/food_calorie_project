const nutrientsToTrack = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein", label: "Protein", unit: "g" },
  { key: "carbs", label: "Carbohydrates", unit: "g" },
  { key: "fat", label: "Total Fat", unit: "g" },
  { key: "saturatedFat", label: "Saturated Fat", unit: "g" },
  { key: "fiber", label: "Fiber", unit: "g" },
  { key: "sugar", label: "Sugar", unit: "g" },
  { key: "sodium", label: "Sodium", unit: "mg" },
];
export function getNutritionTotals(foods) {
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  };
  for (const food of foods) {
    for (const nutrient of nutrientsToTrack) {
      const amount = Number(food[nutrient.key]);

      if (Number.isFinite(amount)) {
        totals[nutrient.key] += amount;
      }
    }
  }
  return Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [
      key,
      Math.round(value * 10) / 10,
    ])
  );
}

export { nutrientsToTrack };