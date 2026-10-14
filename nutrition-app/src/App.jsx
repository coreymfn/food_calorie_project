import { useState } from "react";
import { searchFoods, getFoodDetails } from "./api/usda";
import MaintenanceCaloriesForm from "./assets/form";
import {
  getNutritionTotals,
  nutrientsToTrack,
} from "./assets/nutritionTracker";
import ProteinCalculator from "./assets/ProteinCalculate";
function App() {
  // Food search state
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [servings, setServings] = useState(1);
  const [selectedServingIndex, setSelectedServingIndex] = useState(0);
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
  const dailyTotals = getNutritionTotals(diary);
  const [selectedMeal, setSelectedMeal] = useState("Breakfast");

  // Search for foods
  async function handleSearch(event) {
    event.preventDefault();

    if (!query.trim()) {
      setError("Enter a food to search for.");
      return;
    }

    setLoading(true);
    setError("");
    setFoods([]);
    setSelectedFood(null);

    try {
      const results = await searchFoods(query.trim());
      setFoods(results);

      if (results.length === 0) {
        setError("No matching foods found.");
      }
    } catch (err) {
      setError(err.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  // Load details for the selected food
  async function handleSelectFood(fdcId) {
    setDetailsLoading(true);
    setError("");
    setSelectedFood(null);
    setServings(1);
    setSelectedServingIndex(0);

    try {
      const details = await getFoodDetails(fdcId);
      setSelectedFood(details);
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
          item.nutrient?.name ??
          item.nutrientName ??
          item.name ??
          "";

        return names.some(
          (nutrientName) =>
            name === nutrientName ||
            name.startsWith(`${nutrientName} (`),
        );
      });
    }

    function findAmount(names) {
      const nutrient = findNutrient(names);
      return Number(nutrient?.amount ?? nutrient?.value ?? 0);
    }

    const energyCandidates = nutrients.filter((item) => {
      const name =
        item.nutrient?.name ??
        item.nutrientName ??
        item.name ??
        "";

      return name === "Energy" || name.startsWith("Energy (");
    });

    const caloriesNutrient =
      energyCandidates.find((item) => {
        const unit =
          item.nutrient?.unitName ?? item.unitName ?? "";

        return unit.toLowerCase() === "kcal";
      }) ?? energyCandidates[0];

    let calories = Number(
      caloriesNutrient?.amount ?? caloriesNutrient?.value ?? 0,
    );

    const calorieUnit =
      caloriesNutrient?.nutrient?.unitName ??
      caloriesNutrient?.unitName ??
      "";

    if (calorieUnit.toLowerCase() === "kj") {
      calories /= 4.184;
    }

    const per100g = {
      calories,
      protein: findAmount(["Protein"]),
      carbs: findAmount(["Carbohydrate, by difference"]),
      fat: findAmount(["Total lipid (fat)"]),
      saturatedFat: findAmount(["Fatty acids, total saturated"]),
      fiber: findAmount(["Fiber, total dietary"]),
      sugar: findAmount(["Sugars, total including NLEA", "Sugars, total"]),
      sodium: findAmount(["Sodium"]),
    };

    const label = food.labelNutrients;

    if (
      food.dataType === "Branded" &&
      label &&
      Object.keys(label).length > 0
    ) {
      const servingSize = Number(food.servingSize);
      const servingUnit = (food.servingSizeUnit || "").toLowerCase();

      const fallbackFactor =
        servingUnit === "g" && servingSize > 0
          ? servingSize / 100
          : 0;

      function labelAmount(key, fallback) {
        const value = label[key]?.value;

        return value != null
          ? Number(value)
          : fallback * fallbackFactor;
      }

      return {
        calories: labelAmount("calories", per100g.calories),
        protein: labelAmount("protein", per100g.protein),
        carbs: labelAmount("carbohydrates", per100g.carbs),
        fat: labelAmount("fat", per100g.fat),
        saturatedFat: labelAmount(
          "saturatedFat",
          per100g.saturatedFat,
        ),
        fiber: labelAmount("fiber", per100g.fiber),
        sugar: labelAmount("sugars", per100g.sugar),
        sodium: labelAmount("sodium", per100g.sodium),
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

  const selectedServing =
    servingOptions[selectedServingIndex] ?? servingOptions[0];

  // Calculate nutrition for the selected serving and quantity.
  const estimatedNutrition =
    nutrition && selectedServing
      ? {
          calories: nutrition.calories * selectedServing.factor * servings,
          protein: nutrition.protein * selectedServing.factor * servings,
          carbs: nutrition.carbs * selectedServing.factor * servings,
          fat: nutrition.fat * selectedServing.factor * servings,
        }
      : null;

  // Add the selected food to the diary
  function addToDiary() {
    if (!selectedFood || !estimatedNutrition || servings <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }

    // Get all available nutrients for the selected food.
    const allNutrition = getNutrition(selectedFood);

    const entry = {
      id: crypto.randomUUID(),
      name: selectedFood.description,
      meal: selectedMeal,
      servings,
      servingDescription: selectedServing.label,

      // Nutrients calculated for the selected serving and quantity
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

  // Remove a food from the diary
  function removeFromDiary(id) {
    const updatedDiary = diary.filter((entry) => entry.id !== id);

    setDiary(updatedDiary);

    localStorage.setItem("nutritionDiary", JSON.stringify(updatedDiary));
  }

  // Render the app
  return (
    <main>
      <h1>Nutrition App</h1>
        
      <MaintenanceCaloriesForm />
      <ProteinCalculator />
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

      {error && <p role="alert">{error}</p>}

      {/* SEARCH RESULTS */}
      <h2>Search Results</h2>

      <ul>
        {foods.map((food) => (
          <li key={food.fdcId}>
            <span>
              {food.description} ({food.dataType})
            </span>{" "}
            <button
              type="button"
              onClick={() => handleSelectFood(food.fdcId)}
              disabled={detailsLoading}
            >
              View Nutrition
            </button>
          </li>
        ))}
      </ul>

      {detailsLoading && <p>Loading nutrition details...</p>}

      {/* SELECTED FOOD AND NUTRITION */}
      {selectedFood && nutrition && (
        <section>
          <h2>{selectedFood.description}</h2>

          <p>Food category: {selectedFood.dataType}</p>

          <h3>
            {selectedFood.dataType === "Branded"
              ? "Nutrition per labeled serving"
              : "Nutrition per 100 g"}
          </h3>

          <ul>
            <li>Calories: {nutrition.calories.toFixed(1)} kcal</li>
            <li>Protein: {nutrition.protein.toFixed(1)} g</li>
            <li>Carbohydrates: {nutrition.carbs.toFixed(1)} g</li>
            <li>Fat: {nutrition.fat.toFixed(1)} g</li>
          </ul>

          {/* SERVING SIZE SELECTOR */}
          <label htmlFor="serving-option">Serving size</label>

          <select
            id="serving-option"
            value={selectedServingIndex}
            onChange={(event) => {
              setSelectedServingIndex(Number(event.target.value));
              setServings(1);
            }}
          >
            {servingOptions.map((option, index) => (
              <option key={`${option.label}-${index}`} value={index}>
                {option.label}
              </option>
            ))}
          </select>

          {/* QUANTITY */}
          <label htmlFor="servings">Number of servings</label>

          <input
            id="servings"
            type="number"
            min="0.1"
            step="0.1"
            value={servings}
            onChange={(event) =>
              setServings(Math.max(0, Number(event.target.value)))
            }
          />

          {/* CALCULATED NUTRITION */}
          <h3>Estimated nutrition for this quantity</h3>

          {estimatedNutrition && (
            <ul>
              <li>Calories: {estimatedNutrition.calories.toFixed(1)} kcal</li>
              <li>Protein: {estimatedNutrition.protein.toFixed(1)} g</li>
              <li>Carbohydrates: {estimatedNutrition.carbs.toFixed(1)} g</li>
              <li>Fat: {estimatedNutrition.fat.toFixed(1)} g</li>
            </ul>
          )}

          {/* MEAL SELECTION */}
          <h3>Add to Food Diary</h3>

          <label htmlFor="meal">Choose a meal:</label>

          <select
            id="meal"
            value={selectedMeal}
            onChange={(event) => setSelectedMeal(event.target.value)}
          >
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
            <option value="Snacks">Snacks</option>
          </select>

          <button type="button" onClick={addToDiary}>
            Add to Diary
          </button>
        </section>
      )}

      {/* DAILY NUTRITION TOTALS */}
      <section>
        <h2>Daily Nutrition Totals</h2>
        <ul>
          {nutrientsToTrack.map((nutrient) => (
            <li key={nutrient.key}>
              {nutrient.label}:{" "}
              {Number(dailyTotals[nutrient.key] ?? 0).toFixed(1)}
              {" "}
              {nutrient.unit}
            </li>
          ))}
        </ul>
      </section>
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
                      {" | "}
                      Saturated Fat: {(entry.saturatedFat ?? 0).toFixed(1)} g
                      {" | "}
                      Fiber: {(entry.fiber ?? 0).toFixed(1)} g
                      {" | "}
                      Sugar: {(entry.sugar ?? 0).toFixed(1)} g
                      {" | "}
                      Sodium: {(entry.sodium ?? 0).toFixed(1)} mg
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
    </main>
  );
}

export default App;
