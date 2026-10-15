import { useState } from "react";
import "./App.css";

import { searchFoods, getFoodDetails } from "./api/usda";
import MaintenanceCaloriesForm from "./assets/form";
import {
  getNutritionTotals,
  nutrientsToTrack,
} from "./assets/nutritionTracker";
import ProteinCalculator from "./assets/ProteinCalculate";

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

function getLocalDateString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getSavedDiary() {
  try {
    const savedDiary = localStorage.getItem("nutritionDiary");

    if (!savedDiary) {
      return [];
    }

    const parsedDiary = JSON.parse(savedDiary);

    if (!Array.isArray(parsedDiary)) {
      return [];
    }

    // Give older entries without a date today's date.
    return parsedDiary.map((entry) => ({
      ...entry,
      date: entry.date || getLocalDateString(),
    }));
  } catch {
    return [];
  }
}

function getNutrition(food) {
  const emptyNutrition = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    saturatedFat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  };

  if (!food) {
    return emptyNutrition;
  }

  // Branded foods may provide nutrition per labeled serving.
  // Those values should not be treated as values per 100 grams.
  if (food.dataType === "Branded" && food.labelNutrients) {
    const labels = food.labelNutrients;

    return {
      calories: Number(labels.calories?.value ?? 0),
      protein: Number(labels.protein?.value ?? 0),
      carbs: Number(labels.carbohydrates?.value ?? 0),
      fat: Number(labels.fat?.value ?? 0),
      saturatedFat: Number(labels.saturatedFat?.value ?? 0),
      fiber: Number(labels.fiber?.value ?? 0),
      sugar: Number(labels.sugars?.value ?? 0),
      sodium: Number(labels.sodium?.value ?? 0),
    };
  }

  // Most other USDA nutrient values are reported per 100 grams.
  const nutrients = food.foodNutrients ?? [];
  const result = { ...emptyNutrition };

  for (const nutrient of nutrients) {
    const name = (nutrient.nutrientName ?? nutrient.name ?? "").toLowerCase();

    const amount = Number(nutrient.value ?? nutrient.amount ?? 0);

    if (!Number.isFinite(amount)) {
      continue;
    }

    if (name === "energy") {
      const unit = (nutrient.unitName ?? "").toLowerCase();

      if (unit === "kcal") {
        result.calories = amount;
      } else if (unit === "kj") {
        // Convert kilojoules to kilocalories.
        result.calories = amount / 4.184;
      }
    } else if (name === "protein") {
      result.protein = amount;
    } else if (name === "carbohydrate, by difference") {
      result.carbs = amount;
    } else if (name === "total lipid (fat)") {
      result.fat = amount;
    } else if (name === "fatty acids, total saturated") {
      result.saturatedFat = amount;
    } else if (name === "fiber, total dietary") {
      result.fiber = amount;
    } else if (name === "sugars, total including nlea") {
      result.sugar = amount;
    } else if (name === "sodium, na") {
      result.sodium = amount;
    }
  }

  return result;
}

function getServingOptions(food) {
  if (!food) {
    return [{ label: "100 g", factor: 1 }];
  }

  // Labeled nutrition for branded products is already
  // measured per labeled serving.
  if (food.dataType === "Branded" && food.labelNutrients) {
    const label =
      food.householdServingFullText ||
      (food.servingSize
        ? `${food.servingSize} ${food.servingSizeUnit ?? "g"}`
        : "1 serving");

    return [{ label, factor: 1 }];
  }

  // For branded foods without label nutrients, use the
  // listed serving size to scale per-100-gram nutrition.
  if (
    food.dataType === "Branded" &&
    Number(food.servingSize) > 0 &&
    String(food.servingSizeUnit ?? "g").toLowerCase() === "g"
  ) {
    return [
      {
        label: food.householdServingFullText || `${food.servingSize} g`,
        factor: Number(food.servingSize) / 100,
      },
    ];
  }

  // Generic foods can have several serving options.
  const portions = (food.foodPortions ?? [])
    .filter((portion) => Number(portion.gramWeight) > 0)
    .map((portion, index) => ({
      label:
        portion.portionDescription ||
        portion.modifier ||
        `Serving ${index + 1}`,
      factor: Number(portion.gramWeight) / 100,
    }));

  return [{ label: "100 g", factor: 1 }, ...portions];
}

function App() {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);

  const [servings, setServings] = useState(1);
  const [selectedServingIndex, setSelectedServingIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  const [diary, setDiary] = useState(getSavedDiary);
  const [selectedMeal, setSelectedMeal] = useState("Breakfast");
  const [selectedDate, setSelectedDate] = useState(getLocalDateString);

  // Show entries and totals for the selected date only.
  const selectedEntries = diary.filter((entry) => entry.date === selectedDate);

  const dailyTotals = getNutritionTotals(selectedEntries);

  async function handleSearch(event) {
    event.preventDefault();

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError("Enter a food name to search.");
      setFoods([]);
      return;
    }

    setLoading(true);
    setError("");
    setFoods([]);
    setSelectedFood(null);

    try {
      const results = await searchFoods(trimmedQuery);
      setFoods(results);

      if (results.length === 0) {
        setError("No foods found. Try another search.");
      }
    } catch (err) {
      setError(err.message || "Unable to search for foods.");
    } finally {
      setLoading(false);
    }
  }

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
      setError(err.message || "Unable to load food details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  const nutrition = selectedFood ? getNutrition(selectedFood) : null;

  const servingOptions = selectedFood ? getServingOptions(selectedFood) : [];

  const selectedServing =
    servingOptions[selectedServingIndex] ?? servingOptions[0];

  const estimatedNutrition =
    nutrition && selectedServing
      ? Object.fromEntries(
          nutrientsToTrack.map(({ key }) => [
            key,
            (Number(nutrition[key]) || 0) * selectedServing.factor * servings,
          ]),
        )
      : null;

  function saveDiary(updatedDiary) {
    setDiary(updatedDiary);

    try {
      localStorage.setItem("nutritionDiary", JSON.stringify(updatedDiary));
    } catch {
      setError("Your diary changed, but the browser could not save it.");
    }
  }

  function addToDiary() {
    if (!selectedFood || !estimatedNutrition) {
      return;
    }

    const entry = {
      id: crypto.randomUUID(),
      foodId: selectedFood.fdcId,
      name: selectedFood.description,
      brand: selectedFood.brandOwner ?? "",
      date: selectedDate,
      meal: selectedMeal,
      servings,
      servingDescription: selectedServing.label,
      ...estimatedNutrition,
    };

    saveDiary([...diary, entry]);

    setSelectedFood(null);
    setServings(1);
    setSelectedServingIndex(0);
  }

  function removeFromDiary(id) {
    const updatedDiary = diary.filter((entry) => entry.id !== id);

    saveDiary(updatedDiary);
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Nutrition Diary</h1>
        <p>Track your food and daily nutrition.</p>
      </header>

      <section className="panel">
        <h2>Search for Food</h2>

        <form onSubmit={handleSearch}>
          <label htmlFor="food-search">Food name</label>

          <div className="search-row">
            <input
              id="food-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try apple, oatmeal, or bread"
            />

            <button type="submit" disabled={loading}>
              {loading ? "Searching..." : "Search"}
            </button>
          </div>
        </form>

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}

        {foods.length > 0 && (
          <div className="food-results">
            <h3>Search Results</h3>

            {foods.map((food) => (
              <button
                className="food-result"
                key={food.fdcId}
                type="button"
                onClick={() => handleSelectFood(food.fdcId)}
              >
                <span>{food.description}</span>

                {food.brandOwner && <small>{food.brandOwner}</small>}
              </button>
            ))}
          </div>
        )}

        {detailsLoading && <p>Loading food details...</p>}

        {selectedFood && estimatedNutrition && (
          <div className="selected-food-layout">
            <h3>{selectedFood.description}</h3>

            {selectedFood.brandOwner && <p>Brand: {selectedFood.brandOwner}</p>}

            <label htmlFor="serving-size">Serving size</label>

            <select
              id="serving-size"
              value={selectedServingIndex}
              onChange={(event) =>
                setSelectedServingIndex(Number(event.target.value))
              }
            >
              {servingOptions.map((option, index) => (
                <option key={`${option.label}-${index}`} value={index}>
                  {option.label}
                </option>
              ))}
            </select>

            <label htmlFor="serving-count">Number of servings</label>

            <input
              id="serving-count"
              type="number"
              min="0.25"
              step="0.25"
              value={servings}
              onChange={(event) => {
                const value = Number(event.target.value);

                setServings(Number.isFinite(value) && value > 0 ? value : 0.25);
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

            <h4>Estimated Nutrition</h4>

            <ul>
              {nutrientsToTrack.map((nutrient) => (
                <li key={nutrient.key}>
                  {nutrient.label}:{" "}
                  {Number(estimatedNutrition[nutrient.key] ?? 0).toFixed(1)}{" "}
                  {nutrient.unit}
                </li>
              ))}
            </ul>

            <button type="button" onClick={addToDiary}>
              Add to Diary
            </button>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Daily Nutrition</h2>

        <label htmlFor="diary-date">Diary date</label>

        <input
          id="diary-date"
          type="date"
          value={selectedDate}
          onChange={(event) => setSelectedDate(event.target.value)}
        />

        <div className="daily-summary">
          <div className="goals-grid">
            {nutrientsToTrack.map((nutrient) => (
              <div className="goal-card" key={nutrient.key}>
                <h3>{nutrient.label}</h3>

                <p>
                  {Number(dailyTotals[nutrient.key] ?? 0).toFixed(1)}{" "}
                  {nutrient.unit}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Food Diary</h2>

        <p>Entries for {selectedDate}</p>

        {selectedEntries.length === 0 ? (
          <p>No foods recorded for this date yet.</p>
        ) : (
          MEALS.map((meal) => {
            const mealEntries = selectedEntries.filter(
              (entry) => entry.meal === meal,
            );

            if (mealEntries.length === 0) {
              return null;
            }

            return (
              <div className="diary-meal" key={meal}>
                <h3>{meal}</h3>

                {mealEntries.map((entry) => (
                  <div className="diary-entry" key={entry.id}>
                    <div>
                      <strong>{entry.name}</strong>

                      {entry.brand && <p>{entry.brand}</p>}

                      <p>
                        {entry.servings} × {entry.servingDescription}
                      </p>

                      <p>
                        Calories: {Number(entry.calories ?? 0).toFixed(1)} kcal
                      </p>

                      <p>Protein: {Number(entry.protein ?? 0).toFixed(1)} g</p>

                      <p>
                        Carbohydrates: {Number(entry.carbs ?? 0).toFixed(1)} g
                      </p>

                      <p>Total fat: {Number(entry.fat ?? 0).toFixed(1)} g</p>

                      <p>
                        Saturated fat:{" "}
                        {Number(entry.saturatedFat ?? 0).toFixed(1)} g
                      </p>

                      <p>Fiber: {Number(entry.fiber ?? 0).toFixed(1)} g</p>

                      <p>Sugar: {Number(entry.sugar ?? 0).toFixed(1)} g</p>

                      <p>Sodium: {Number(entry.sodium ?? 0).toFixed(1)} mg</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFromDiary(entry.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </section>

      <section className="panel">
        <MaintenanceCaloriesForm />
      </section>

      <section className="panel">
        <ProteinCalculator />
      </section>
    </main>
  );
}

export default App;
