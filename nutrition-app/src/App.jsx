import { useState } from "react";
import "./App.css";

import { searchFoods, getFoodDetails, SEARCH_PAGE_SIZE } from "./api/usda";
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

    // Keep existing entries and add dates to older entries.
    return parsedDiary.map((entry) => ({
      ...entry,
      date: entry.date || getLocalDateString(),
    }));
  } catch {
    return [];
  }
}

function getSavedGoalResult() {
  try {
    const savedResult = localStorage.getItem("maintenanceGoalResult");
    return savedResult ? JSON.parse(savedResult) : null;
  } catch {
    return null;
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

  const labels = food.labelNutrients;

  // Branded label nutrients are already per labeled serving.
  if (food.dataType === "Branded" && labels && Object.keys(labels).length > 0) {
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

  // Other USDA nutrient values are generally per 100 grams.
  const nutrients = food.foodNutrients ?? [];
  const result = { ...emptyNutrition };

  for (const nutrient of nutrients) {
    const name = (
      nutrient.nutrient?.name ??
      nutrient.nutrientName ??
      nutrient.name ??
      ""
    ).toLowerCase();

    const amount = Number(nutrient.amount ?? nutrient.value ?? 0);

    if (!Number.isFinite(amount)) {
      continue;
    }

    const unit = (
      nutrient.nutrient?.unitName ??
      nutrient.unitName ??
      ""
    ).toLowerCase();

    if (name === "energy" || name.startsWith("energy (")) {
      if (unit === "kcal") {
        result.calories = amount;
      } else if (unit === "kj") {
        result.calories = amount / 4.184;
      }
    } else if (name === "protein") {
      result.protein = amount;
    } else if (name.startsWith("carbohydrate, by difference")) {
      result.carbs = amount;
    } else if (name.startsWith("total lipid (fat)")) {
      result.fat = amount;
    } else if (name.startsWith("fatty acids, total saturated")) {
      result.saturatedFat = amount;
    } else if (name.startsWith("fiber, total dietary")) {
      result.fiber = amount;
    } else if (
      name.startsWith("sugars, total including nlea") ||
      name.startsWith("sugars, total")
    ) {
      result.sugar = amount;
    } else if (name === "sodium" || name === "sodium, na") {
      result.sodium = amount;
    }
  }

  return result;
}

function getServingOptions(food) {
  if (!food) {
    return [{ label: "100 g", factor: 1 }];
  }

  // Branded label nutrition is per labeled serving.
  if (
    food.dataType === "Branded" &&
    food.labelNutrients &&
    Object.keys(food.labelNutrients).length > 0
  ) {
    const label =
      food.householdServingFullText ||
      (food.servingSize
        ? `${food.servingSize} ${food.servingSizeUnit ?? "g"}`
        : "1 serving");

    return [{ label, factor: 1 }];
  }

  // Scale per-100-gram nutrition for a branded gram serving.
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

  // Generic foods may have several USDA portion options.
  const portions = (food.foodPortions ?? [])
    .filter((portion) => Number(portion.gramWeight) > 0)
    .map((portion, index) => {
      const amount = Number(portion.amount) || 1;
      const description =
        portion.portionDescription ||
        portion.modifier ||
        portion.measureUnit?.name ||
        `Serving ${index + 1}`;

      return {
        label: `${amount} ${description} (${portion.gramWeight} g)`,
        factor: Number(portion.gramWeight) / 100,
      };
    });

  return [{ label: "100 g", factor: 1 }, ...portions];
}

function App() {
  // Food search state
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [sortBy, setSortBy] = useState("relevance");
  const [foodTypeFilter, setFoodTypeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [servings, setServings] = useState(1);
  const [selectedServingIndex, setSelectedServingIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  // Maintenance-calorie goal state
  const [goalResult, setGoalResult] = useState(getSavedGoalResult);

  // Food diary state
  const [diary, setDiary] = useState(getSavedDiary);
  const [selectedMeal, setSelectedMeal] = useState("Breakfast");
  const [selectedDate, setSelectedDate] = useState(getLocalDateString);

  // Only show entries recorded for the selected date.
  const selectedEntries = diary.filter((entry) => entry.date === selectedDate);

  const dailyTotals = getNutritionTotals(selectedEntries);

  async function handleSearch(event) {
    event.preventDefault();

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setError("Enter a food name to search.");
      setFoods([]);
      setHasMore(false);
      return;
    }

    setLoading(true);
    setError("");
    setFoods([]);
    setSelectedFood(null);
    setPageNumber(1);
    setHasMore(false);

    try {
      const results = await searchFoods(trimmedQuery, 1);

      setFoods(results);
      setHasMore(results.length === SEARCH_PAGE_SIZE);

      if (results.length === 0) {
        setError("No foods found. Try another search.");
      }
    } catch (err) {
      setError(err.message || "Unable to search for foods.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    if (loading || !hasMore) return;

    const nextPage = pageNumber + 1;

    setLoading(true);
    setError("");

    try {
      const results = await searchFoods(query.trim(), nextPage);

      setFoods((currentFoods) => {
        const existingIds = new Set(currentFoods.map((food) => food.fdcId));

        const newFoods = results.filter((food) => !existingIds.has(food.fdcId));

        return [...currentFoods, ...newFoods];
      });

      setPageNumber(nextPage);
      setHasMore(results.length === SEARCH_PAGE_SIZE);

      if (results.length === 0) {
        setHasMore(false);
      }
    } catch (err) {
      setError(err.message || "Unable to load more foods.");
    } finally {
      setLoading(false);
    }
  }

  const visibleFoods = foods
    .filter((food) => {
      if (foodTypeFilter === "branded") {
        return food.dataType === "Branded";
      }

      if (foodTypeFilter === "generic") {
        return food.dataType !== "Branded";
      }

      return true;
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === "name") {
        return (a.description ?? "").localeCompare(b.description ?? "");
      }

      if (sortBy === "brand") {
        const brandA = a.brandName || a.brandOwner || "";
        const brandB = b.brandName || b.brandOwner || "";

        return brandA.localeCompare(brandB);
      }

      if (sortBy === "category") {
        return (a.brandedFoodCategory ?? "").localeCompare(
          b.brandedFoodCategory ?? "",
        );
      }

      // Relevance: preserve the order returned by USDA.
      return 0;
    });

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

  function handleGoalResult(result) {
    setGoalResult(result);

    try {
      if (result == null) {
        localStorage.removeItem("maintenanceGoalResult");
      } else {
        localStorage.setItem("maintenanceGoalResult", JSON.stringify(result));
      }
    } catch {
      setError("Your goal was calculated, but could not be saved.");
    }
  }

  function saveDiary(updatedDiary) {
    setDiary(updatedDiary);

    try {
      localStorage.setItem("nutritionDiary", JSON.stringify(updatedDiary));
    } catch {
      setError("Your diary changed, but the browser could not save it.");
    }
  }

  function addToDiary() {
    if (!selectedFood) {
      setError("Please select a food first.");
      return;
    }

    const servingCount = Number(servings);

    if (!Number.isFinite(servingCount) || servingCount <= 0) {
      setError("Please enter a valid serving amount.");
      return;
    }

    // Generate the ID inside the click handler.
    const entryId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const nutrition = getNutrition(selectedFood);

    const newEntry = {
      id: entryId,
      foodId: selectedFood.fdcId,
      name: selectedFood.description,
      brand: selectedFood.brandOwner ?? "",
      meal: selectedMeal,
      date: selectedDate,
      servings: servingCount,
      calories: (nutrition.calories ?? 0) * servingCount,
      protein: (nutrition.protein ?? 0) * servingCount,
      carbs: (nutrition.carbs ?? 0) * servingCount,
      fat: (nutrition.fat ?? 0) * servingCount,
      saturatedFat: (nutrition.saturatedFat ?? 0) * servingCount,
      fiber: (nutrition.fiber ?? 0) * servingCount,
      sugar: (nutrition.sugar ?? 0) * servingCount,
      sodium: (nutrition.sodium ?? 0) * servingCount,
    };

    setDiary((previousDiary) => [...previousDiary, newEntry]);

    setSelectedFood(null);
    setServings("1");
    setSelectedServingIndex(0);
    setError("");
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

      {/* FOOD SEARCH */}
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

            <div className="food-results-toolbar">
              <div>
                <label htmlFor="food-sort">Sort by</label>
                <select
                  id="food-sort"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option value="relevance">Relevance</option>
                  <option value="name">Food name (A–Z)</option>
                  <option value="brand">Brand (A–Z)</option>
                  <option value="category">Category (A–Z)</option>
                </select>
              </div>

              <div>
                <label htmlFor="food-type-filter">Food type</label>
                <select
                  id="food-type-filter"
                  value={foodTypeFilter}
                  onChange={(event) => setFoodTypeFilter(event.target.value)}
                >
                  <option value="all">All foods</option>
                  <option value="branded">Branded foods</option>
                  <option value="generic">Generic / other foods</option>
                </select>
              </div>
            </div>

            <p className="food-results-count" aria-live="polite">
              Showing {visibleFoods.length} of {foods.length} loaded foods
            </p>

            <div className="food-results-list">
              {visibleFoods.length === 0 ? (
                <p>No foods match the selected filter.</p>
              ) : (
                visibleFoods.map((food) => (
                  <button
                    className="food-result"
                    key={food.fdcId}
                    type="button"
                    onClick={() => handleSelectFood(food.fdcId)}
                    disabled={detailsLoading}
                  >
                    <span className="food-result-title">
                      {food.description || "Unnamed food"}
                    </span>

                    <span className="food-result-meta">
                      <strong>Brand:</strong>{" "}
                      {food.brandName || food.brandOwner || "No brand listed"}
                    </span>

                    <span className="food-result-meta">
                      <strong>Branded Food Category:</strong>{" "}
                      {food.brandedFoodCategory || "Not provided"}
                    </span>

                    <span className="food-result-meta">
                      <strong>Food type:</strong>{" "}
                      {food.dataType || "Not specified"}
                    </span>

                    <span className="food-result-select">Select food →</span>
                  </button>
                ))
              )}
            </div>

            {hasMore && (
              <button
                className="load-more-button"
                type="button"
                onClick={handleLoadMore}
                disabled={loading || detailsLoading}
              >
                {loading ? "Loading..." : "Load More Foods"}
              </button>
            )}
          </div>
        )}

        {detailsLoading && <p>Loading food details...</p>}

        {/* SELECTED FOOD */}
        {selectedFood && estimatedNutrition && (
          <div className="selected-food-layout">
            <h3>{selectedFood.description}</h3>

            {selectedFood.brandOwner && <p>Brand: {selectedFood.brandOwner}</p>}

            <label htmlFor="serving-size">Serving size</label>

            <select
              id="serving-size"
              value={selectedServingIndex}
              onChange={(event) => {
                setSelectedServingIndex(Number(event.target.value));
              }}
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
              min="0.1"
              step="0.1"
              value={servings}
              onChange={(event) => {
                const value = Number(event.target.value);
                setServings(Number.isFinite(value) && value >= 0 ? value : 0);
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

      {/* DAILY TOTALS */}
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

      {/* FOOD DIARY */}
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
                        {entry.servings} ×{" "}
                        {entry.servingDescription || "serving"}
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

      {/* MAINTENANCE CALORIES */}
      <section className="panel">
        <MaintenanceCaloriesForm onResult={handleGoalResult} />
      </section>

      {/* PROTEIN CALCULATOR */}
      <section className="panel">
        <ProteinCalculator maintenanceResult={goalResult} />
      </section>
    </main>
  );
}

export default App;
