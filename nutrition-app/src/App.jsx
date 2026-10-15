import { useState } from "react";
import { searchFoods, getFoodDetails } from "./api/usda";

function App() {
  // Food search state
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);

  const [servings, setServings] = useState(1);
  const [selectedServingIndex, setSelectedServingIndex] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState("Breakfast");

  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  // Food diary state
  const [diary, setDiary] = useState(() => {
    try {
      const savedDiary = localStorage.getItem("nutritionDiary");
      return savedDiary ? JSON.parse(savedDiary) : [];
    } catch {
      return [];
    }
  });

  const [selectedMeal, setSelectedMeal] = useState("Breakfast");

  // Search for foods
  async function handleSearch(event) {
    event.preventDefault();

    const searchTerm = query.trim();

    if (!searchTerm) {
      setError("Enter a food name to search.");
      return;
    }

    setLoading(true);
    setError("");
    setHasSearched(true);
    setSelectedFood(null);
    setFoods([]);

    try {
      const results = await searchFoods(searchTerm);
      setFoods(results);

      if (results.length === 0) {
        setError("No foods found. Try a different search.");
      }
    } catch (err) {
      setError(err.message || "Food search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectFood(foodId) {
    setDetailsLoading(true);
    setError("");
    setSelectedFood(null);
    setServings(1);
    setSelectedServingIndex(0);

    try {
      const food = await getFoodDetails(foodId);

      setSelectedFood(food);

      const defaultIndex = food.servings.findIndex(
        (serving) => serving.isDefault,
      );

      setSelectedServingIndex(defaultIndex >= 0 ? defaultIndex : 0);

      if (food.servings.length === 0) {
        setError("This food has no serving nutrition information available.");
      }
    } catch (err) {
      setError(err.message || "Could not load food details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  // Extract nutrition information from USDA food data
  function getNutrition(food) {
    const nutrients = food.foodNutrients ?? [];

    function findNutrient(names) {
      return nutrients.find((item) => {
        const name =
          item.nutrient?.name ?? item.nutrientName ?? item.name ?? "";

        return names.some(
          (nutrientName) =>
            name === nutrientName || name.startsWith(`${nutrientName} (`),
        );
      });
    }

    function findAmount(names) {
      const nutrient = findNutrient(names);

      return Number(nutrient?.amount ?? nutrient?.value ?? 0);
    }

    // Find an energy value and prefer kcal over kJ.
    const energyCandidates = nutrients.filter((item) => {
      const name = item.nutrient?.name ?? item.nutrientName ?? item.name ?? "";

      return name === "Energy" || name.startsWith("Energy (");
    });

    const caloriesNutrient =
      energyCandidates.find((item) => {
        const unit = item.nutrient?.unitName ?? item.unitName ?? "";

        return unit.toLowerCase() === "kcal";
      }) ?? energyCandidates[0];

    let calories = Number(
      caloriesNutrient?.amount ?? caloriesNutrient?.value ?? 0,
    );

    const calorieUnit =
      caloriesNutrient?.nutrient?.unitName ?? caloriesNutrient?.unitName ?? "";

    if (calorieUnit.toLowerCase() === "kj") {
      calories /= 4.184;
    }

    // Many non-branded USDA records provide values per 100 g.
    const per100g = {
      calories,
      protein: findAmount(["Protein"]),
      carbs: findAmount(["Carbohydrate, by difference"]),
      fat: findAmount(["Total lipid (fat)"]),
    };

    // Branded products may provide nutrition per label serving.
    const label = food.labelNutrients;

    if (food.dataType === "Branded" && label && Object.keys(label).length > 0) {
      const servingSize = Number(food.servingSize);
      const servingUnit = (food.servingSizeUnit || "").toLowerCase();

      // Estimate missing label values from per-100 g values
      // only when the serving weight is known in grams.
      const fallbackFactor =
        servingUnit === "g" && servingSize > 0 ? servingSize / 100 : 0;

      function labelAmount(key, fallback) {
        const value = label[key]?.value;

        return value != null ? Number(value) : fallback * fallbackFactor;
      }

      return {
        calories: labelAmount("calories", per100g.calories),
        protein: labelAmount("protein", per100g.protein),
        carbs: labelAmount("carbohydrates", per100g.carbs),
        fat: labelAmount("fat", per100g.fat),
      };
    }

    return per100g;
  }

  // Build serving options for the selected food
  function getServingOptions(food) {
    const isBranded = food.dataType === "Branded";
    const servingSize = Number(food.servingSize);
    const servingUnit = food.servingSizeUnit || "g";

    // Use the labeled serving when branded label nutrients exist.
    if (
      isBranded &&
      food.labelNutrients &&
      Object.keys(food.labelNutrients).length > 0
    ) {
      const label = food.householdServingFullText || "1 labeled serving";

      const sizeText =
        servingSize > 0 ? ` (${servingSize} ${servingUnit})` : "";

      return [
        {
          label: `${label}${sizeText}`,
          factor: 1,
        },
      ];
    }

    // Otherwise, use the branded product's gram serving if available.
    if (isBranded && servingSize > 0 && servingUnit.toLowerCase() === "g") {
      return [
        {
          label: `1 serving (${servingSize} g)`,
          factor: servingSize / 100,
        },
      ];
    }

    // Use household portions supplied by USDA when available.
    const portions = (food.foodPortions ?? [])
      .filter((portion) => Number(portion.gramWeight) > 0)
      .map((portion) => {
        const amount = Number(portion.amount) || 1;
        const description =
          portion.portionDescription ||
          portion.modifier ||
          portion.measureUnit?.name ||
          "serving";

        return {
          label: `${amount} ${description} (${portion.gramWeight} g)`,
          factor: Number(portion.gramWeight) / 100,
        };
      });

    if (portions.length > 0) {
      return portions;
    }

    // Fallback when no usable serving information is available.
    return [
      {
        label: "100 g",
        factor: 1,
      },
    ];
  }

  // Nutrition for the selected food
  const nutrition = selectedFood ? getNutrition(selectedFood) : null;

  const servingOptions = selectedFood ? getServingOptions(selectedFood) : [];

  const selectedServing = servingOptions[selectedServingIndex] ?? null;

  const estimatedNutrition = selectedServing
    ? {
        calories: selectedServing.calories * servings,
        protein: selectedServing.protein * servings,
        carbs: selectedServing.carbs * servings,
        fat: selectedServing.fat * servings,
      }
    : { ...emptyNutrition };

  function addToDiary() {
    if (!selectedFood || !selectedServing) {
      setError("Select a food with serving information first.");
      return;
    }

    // Get all available nutrients for the selected food.
    const allNutrition = getNutrition(selectedFood);

    const entry = {
      id: crypto.randomUUID(),
      foodId: selectedFood.id,
      name: selectedFood.name,
      brand: selectedFood.brand,
      image: selectedFood.image,
      meal: selectedMeal,
      date: selectedDate,
      servings,
      servingDescription: selectedServing.label,
      calories: estimatedNutrition.calories,
      protein: estimatedNutrition.protein,
      carbs: estimatedNutrition.carbs,
      fat: estimatedNutrition.fat,

      // Additional nutrients, scaled to the selected quantity
      saturatedFat:
        (allNutrition.saturatedFat ?? 0) *
        selectedServing.factor *
        servings,
      fiber:
        (allNutrition.fiber ?? 0) *
        selectedServing.factor *
        servings,
      sugar:
        (allNutrition.sugar ?? 0) *
        selectedServing.factor *
        servings,
      sodium:
        (allNutrition.sodium ?? 0) *
        selectedServing.factor *
        servings,
    };

    const updatedDiary = [...diary, entry];

    setDiary(updatedDiary);

    localStorage.setItem("nutritionDiary", JSON.stringify(updatedDiary));

    setError("");
  }

  function removeFromDiary(entryId) {
    setDiary((currentDiary) =>
      currentDiary.filter((entry) => entry.id !== entryId),
    );
  }

  const selectedEntries = diary.filter((entry) => entry.date === selectedDate);

  function clearDiary() {
    const confirmed = window.confirm(
      `Are you sure you want to clear the diary for ${selectedDate}?`,
    );

    if (confirmed) {
      setDiary((currentDiary) =>
        currentDiary.filter((entry) => entry.date !== selectedDate),
      );
    }
  }

  const dailyTotals = selectedEntries.reduce(
    (totals, entry) => ({
      calories: totals.calories + (Number(entry.calories) || 0),
      protein: totals.protein + (Number(entry.protein) || 0),
      carbs: totals.carbs + (Number(entry.carbs) || 0),
      fat: totals.fat + (Number(entry.fat) || 0),
    }),
    { ...emptyNutrition },
  );

  const goalItems = [
    {
      key: "calories",
      label: "Calories",
      unit: "kcal",
      current: dailyTotals.calories,
      goal: Number(goals.calories) || 0,
    },
    {
      key: "protein",
      label: "Protein",
      unit: "g",
      current: dailyTotals.protein,
      goal: Number(goals.protein) || 0,
    },
    {
      key: "carbs",
      label: "Carbohydrates",
      unit: "g",
      current: dailyTotals.carbs,
      goal: Number(goals.carbs) || 0,
    },
    {
      key: "fat",
      label: "Fat",
      unit: "g",
      current: dailyTotals.fat,
      goal: Number(goals.fat) || 0,
    },
  ];

  return (
    <main>
      <h1>Nutrition App</h1>

      {/* FOOD SEARCH */}
      <form onSubmit={handleSearch}>
        <label htmlFor="food-search">Search for a food</label>

        <input
          id="food-search"
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="e.g. banana"
        />

          <button type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {loading && (
          <p className="status-message">Searching the food database...</p>
        )}

        {!loading && hasSearched && foods.length > 0 && (
          <div className="food-results">
            <h3>Search results</h3>

            {foods.map((food) => (
              <button
                className="food-result"
                key={food.id}
                type="button"
                onClick={() => handleSelectFood(food.id)}
                disabled={detailsLoading}
              >
                <FoodImage
                  src={food.image}
                  alt={food.name}
                  className="food-thumbnail"
                />

                <span className="food-result-info">
                  <strong>{food.name}</strong>
                  {food.brand && (
                    <span className="food-brand">{food.brand}</span>
                  )}
                  <small>
                    {food.type === "Brand" ? "Branded food" : "Generic food"}
                  </small>
                </span>

                <span className="result-arrow" aria-hidden="true">
                  →
                </span>
              </button>
            ))}
          </div>
        )}

        {detailsLoading && (
          <p className="status-message">
            Loading serving sizes and nutrition...
          </p>
        )}
      </section>

      {selectedFood && (
        <section className="panel selected-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SELECTED FOOD</p>
              <h2>{selectedFood.name}</h2>
              {selectedFood.brand && (
                <p className="food-brand">{selectedFood.brand}</p>
              )}
            </div>
          </div>

          <div className="selected-food-layout">
            <FoodImage
              src={selectedFood.image}
              alt={selectedFood.name}
              className="selected-food-image"
            />

            <div className="serving-controls">
              <label htmlFor="serving-select">Serving size</label>

              <select
                id="serving-select"
                value={selectedServingIndex}
                onChange={(event) =>
                  setSelectedServingIndex(Number(event.target.value))
                }
                disabled={servingOptions.length === 0}
              >
                {servingOptions.map((serving, index) => (
                  <option key={serving.id || index} value={index}>
                    {serving.description}
                  </option>
                ))}
              </select>

              <label htmlFor="quantity">Number of servings</label>

              <input
                id="quantity"
                type="number"
                min="0.25"
                max="100"
                step="0.25"
                value={servings}
                onChange={(event) => {
                  const value = Number(event.target.value);

                  if (Number.isFinite(value) && value > 0 && value <= 100) {
                    setServings(value);
                  }
                }}
              />

              <label htmlFor="meal-select">Add to meal</label>

              <select
                id="meal-select"
                value={selectedMeal}
                onChange={(event) => setSelectedMeal(event.target.value)}
              >
                {MEALS.map((meal) => (
                  <option key={meal} value={meal}>
                    {meal}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedServing && (
            <>
              <div className="nutrition-grid">
                <NutritionCard
                  label="Calories"
                  value={formatNumber(estimatedNutrition.calories, 0)}
                  unit="kcal"
                />
                <NutritionCard
                  label="Protein"
                  value={formatNumber(estimatedNutrition.protein)}
                  unit="g"
                />
                <NutritionCard
                  label="Carbs"
                  value={formatNumber(estimatedNutrition.carbs)}
                  unit="g"
                />
                <NutritionCard
                  label="Fat"
                  value={formatNumber(estimatedNutrition.fat)}
                  unit="g"
                />
              </div>

              <button
                type="button"
                className="primary-button add-button"
                onClick={addToDiary}
              >
                + Add to {selectedMeal}
              </button>
            </>
          )}

          {servingOptions.length === 0 && (
            <p className="status-message">
              No serving data was returned for this food.
            </p>
          )}
        </section>
      )}

      {/* FOOD DIARY */}
      <section>
        <h2>Food Diary</h2>

        {["Breakfast", "Lunch", "Dinner", "Snacks"].map((meal) => {
          const mealEntries = diary.filter((entry) => entry.meal === meal);

          return (
            <div key={meal}>
              <h3>{meal}</h3>

              {mealEntries.length === 0 ? (
                <p>No foods added yet.</p>
              ) : (
                <ul>
                  {mealEntries.map((entry) => (
                    <li key={entry.id}>
                      <strong>{entry.name}</strong>
                      {" — "}
                      {entry.servings} serving(s)
                      {entry.servingDescription
                        ? ` (${entry.servingDescription})`
                        : ""}
                      {" | "}
                      Calories: {entry.calories.toFixed(1)} kcal
                      {" | "}
                      Protein: {entry.protein.toFixed(1)} g{" | "}
                      Carbs: {entry.carbs.toFixed(1)} g{" | "}
                      Fat: {entry.fat.toFixed(1)} g{" "}
                      <button
                        type="button"
                        onClick={() => removeFromDiary(entry.id)}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <footer className="app-footer">
        <p>Nutrition values depend on the selected food and serving data.</p>
      </footer>
    </main>
  );
}

function NutritionCard({ label, value, unit }) {
  return (
    <div className="nutrition-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </div>
  );
}

function SummaryMacro({ label, value }) {
  return (
    <div className="summary-macro">
      <span>{label}</span>
      <strong>{formatNumber(value)} g</strong>
    </div>
  );
}
