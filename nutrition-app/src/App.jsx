import { useState, useEffect} from "react";
import "./App.css";
import CustomFood from "./assets/CustomFood";
import { searchFoods, getFoodDetails, SEARCH_PAGE_SIZE } from "./api/usda";
import MaintenanceCaloriesForm from "./assets/form";
import {
  getNutritionTotals,
  getCalorieStatus,
  nutrientsToTrack,
} from "./assets/nutritionTracker";
import ProteinCalculator from "./assets/ProteinCalculate";

import chip100 from "./assets/Character/Chip100.png";
import chipTooFull from "./assets/Character/ChipTooFull.png";
import chip50 from "./assets/Character/Chip50.png";
import chipNormal from "./assets/Character/ChipNormal.png";

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

    if (!savedDiary) return [];

    const parsedDiary = JSON.parse(savedDiary);

    if (!Array.isArray(parsedDiary)) return [];

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

  if (!food) return emptyNutrition;

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

    if (!Number.isFinite(amount)) continue;

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

function createEntryId() {
  return typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function App() {
  // Food search state
  const [showFoodSearch, setShowFoodSearch] = useState(false);
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
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showCustomFood, setShowCustomFood] = useState(false);

  // Protein Goal //
  const [proteinGoal, setProteinGoal] = useState(() => {
  try {
    const saved = localStorage.getItem("proteinGoal");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
});

const [showProteinForm, setShowProteinForm] = useState(false);

function handleProteinGoal(result) {
  const goal = Number(result);

  if (!Number.isFinite(goal) || goal <= 0) {
    return;
  }

  setProteinGoal(goal);
  localStorage.setItem("proteinGoal", JSON.stringify(goal));
  setShowProteinForm(false);
}

  // Food diary state
  const [diary, setDiary] = useState(getSavedDiary);
  const [selectedMeal, setSelectedMeal] = useState("Breakfast");
  const [selectedDate, setSelectedDate] = useState(getLocalDateString);

  const selectedEntries = diary.filter((entry) => entry.date === selectedDate);

  const dailyTotals = getNutritionTotals(selectedEntries);

  const [showFoodDiary, setShowFoodDiary] = useState(false);


  async function handleSearch(event) {
    event?.preventDefault();

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
            (Number(nutrition[key]) || 0) *
              selectedServing.factor *
              (Number(servings) || 0),
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

    const foodNutrition = getNutrition(selectedFood);
    const factor = selectedServing?.factor ?? 1;

    const newEntry = {
      id: createEntryId(),
      foodId: selectedFood.fdcId,
      name: selectedFood.description,
      brand: selectedFood.brandOwner ?? "",
      meal: selectedMeal,
      date: selectedDate,
      servings: servingCount,
      servingDescription: selectedServing?.label ?? "serving",
      calories: (foodNutrition.calories ?? 0) * factor * servingCount,
      protein: (foodNutrition.protein ?? 0) * factor * servingCount,
      carbs: (foodNutrition.carbs ?? 0) * factor * servingCount,
      fat: (foodNutrition.fat ?? 0) * factor * servingCount,
      saturatedFat: (foodNutrition.saturatedFat ?? 0) * factor * servingCount,
      fiber: (foodNutrition.fiber ?? 0) * factor * servingCount,
      sugar: (foodNutrition.sugar ?? 0) * factor * servingCount,
      sodium: (foodNutrition.sodium ?? 0) * factor * servingCount,
    };

    saveDiary([...diary, newEntry]);

    setSelectedFood(null);
    setServings(1);
    setSelectedServingIndex(0);
    setError("");
  }

  function addCustomFoodToDiary(food, meal) {
    const newEntry = {
      id: createEntryId(),
      name: food.name,
      meal,
      date: selectedDate,
      servings: 1,
      servingDescription: food.serving || "serving",
      calories: Number(food.calories) || 0,
      protein: Number(food.protein) || 0,
      carbs: Number(food.carbs) || 0,
      fat: Number(food.fat) || 0,
      saturatedFat: Number(food.saturatedFat) || 0,
      fiber: Number(food.fiber) || 0,
      sugar: Number(food.sugar) || 0,
      sodium: Number(food.sodium) || 0,
    };

    saveDiary([...diary, newEntry]);
  }

  function removeFromDiary(id) {
    const updatedDiary = diary.filter((entry) => entry.id !== id);

    saveDiary(updatedDiary);
  }

  const calorieStatus = getCalorieStatus(
  dailyTotals.calories ?? 0,
  goalResult?.goalCalories
);



useEffect(() => {
  const searchTerm = query.trim();

  // Don't search if the input is empty
  if (!searchTerm) {
    setFoods([]);
    setHasMore(false);
    setError("");
    return;
  }

  // Wait 400ms after typing before searching
  const timeoutId = setTimeout(async () => {
    setLoading(true);
    setError("");

    try {
      const results = await searchFoods(searchTerm, 1);

      setFoods(results.foods ?? results.results ?? results);
      setPageNumber(1);
      setHasMore(
        (results.foods ?? results.results ?? results).length >= SEARCH_PAGE_SIZE
      );
    } catch (error) {
      setError("Unable to search for foods. Please try again.");
    } finally {
      setLoading(false);
    }
  }, 400);

  

  // Cancel the pending search if the user types again
  return () => clearTimeout(timeoutId);
}, [query]);





const matchingFoods = query.trim()
  ? foods.filter((food) =>
      (food.description ?? "")
        .toLowerCase()
        .startsWith(query.trim().toLowerCase())
    )
  : [];



  return (
    <main className="app">
      <div className={`goal-card calorie-card ${calorieStatus}`}>
        
        <div className="goal-display">
          <h3>Daily Goal</h3>

          <p className="goal-number">
            {goalResult?.goalCalories != null
              ? `${goalResult.goalCalories.toLocaleString()} kcal`
              : "Set your weight goal"}
          </p>

           <p className="active-num">
          ~Current~ {Number(dailyTotals.calories ?? 0).toFixed(1)} Kcal
          </p>

         </div>


        
        <div className="calorie-character">
          {calorieStatus === "Goal reached" ? (
            <img src={chip100} alt="Goal Reached" />
          ) : calorieStatus === "Too much" ? (
            <img src={chipTooFull} alt="Over Calorie Goal" />
          ) : calorieStatus === "Halfway" ? (
            <img src={chip50} alt="Halfway to Goal" />
          ) : calorieStatus === "Getting started" ? (
            <img src={chipNormal} alt="Getting Started" />
        ) : null}
        </div>
    </div>


      <button
        type="button"
        className="goal-form-block"
        onClick={() => setShowGoalForm(true)}
      >
        <p>Set Calorie Goal</p>
      </button>

    
    
    {/* MAINTENANCE CALORIES POPUP */}
    {showGoalForm && (
      <div className="goal-modal-backdrop">
        <div
          className="goal-modal"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Set your weight goal"
        >

          <div className="goal-modal-content">

            <button
            type="button"
            className="goal-modal-close"
            onClick={() => setShowGoalForm(false)}
          >
            ✕
          </button>

            <MaintenanceCaloriesForm
              onResult={handleGoalResult}
            />
          </div>
        </div>
      </div>
    )}

    {/* FOOD SEARCH TOGGLE */}
<button
  type="button"
  className="food-search-toggle"
  onClick={() => setShowFoodSearch((previous) => !previous)}
  aria-expanded={showFoodSearch}
>
  {showFoodSearch ? "Close" : "+ Add Food"}
</button>

{/* FOOD SEARCH */}
{showFoodSearch && (
  <section className="searchbox">
          {/* FOOD SEARCH */}
      <section className="searchbar">
        
      {!selectedFood && (
        <form onSubmit={handleSearch}>
          <label htmlFor="food-search"></label>

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
      )}

        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
      

        {query.trim() !== "" && foods.length > 0 && !selectedFood && (
          <div className="food-results">
            <h3>Search Results</h3>

            <p className="food-results-count" aria-live="polite">
              Showing {visibleFoods.length} of {foods.length} loaded foods
            </p>
            
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

            
          </div>
        )}

        {detailsLoading && <p>Loading food details...</p>}

        {/* SELECTED FOOD */}
        {selectedFood && estimatedNutrition && (
          <div className="selected-food-layout">
            <div className="scroll-selected">
          <button
          type="button"
          onClick={() => setSelectedFood(null)}
          className="back-to-search-button"
        >
          x
          </button>

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
              min="0.1"
              step="0.1"
              value={servings}
              onChange={(event) => {
                const value = event.target.value;
                setServings(value === "" ? "" : Number(value));
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

            <button className='add-diary' type="button" onClick={addToDiary}>
              Add to Diary
            </button>
            </div>
          </div>
        )}
      </section>

      {/* CUSTOM FOODS */}
      {!selectedFood && query.trim() === "" && (
      <button
        type="button"
        className="custom-button"
        onClick={() => setShowCustomFood((previous) => !previous)}
      >
        {showCustomFood ? "Hide Custom Foods" : "Show Custom Foods"}
      </button>
      )}

      {showCustomFood && (
        <div className="custom-food-panel">
        <CustomFood
          selectedMeal={selectedMeal}
          onAddToDiary={addCustomFoodToDiary}
        />
        </div>
      )}

  </section>
)}
      


{/* DAILY TOTALS */}
      <section className="panel-stats">

        <div className="daily-summary">
          <div className="goals-grid">
            {nutrientsToTrack
            .filter(
              (nutrient) =>
                !["calories", "saturatedFat"].includes(nutrient.key)
            )
            .map((nutrient) => (
              <div className="goal-card" key={nutrient.key}>
                <h3>{nutrient.key === "carbs" ? 'Carbs' : nutrient.label}</h3>

                <p>
                  {Number(dailyTotals[nutrient.key] ?? 0).toFixed(1)}{" "}
                  {nutrient.unit}
                </p>

                {nutrient.key === "protein" && (
                   <p className="protein-goal-number">
                    {proteinGoal !== null ? `${proteinGoal} g` : "Not set"}
                  </p>
                )}

              </div>
            ))}
          </div>
        </div>
      </section>

<button
  type="button"
  className="dairy-button"
  onClick={() => setShowFoodDiary(prev => !prev)}
>
  {showFoodDiary ? "Close Food Diary" : "Open Food Diary"}
</button>

 
      {showFoodDiary && (
      <section className="food-diary">

      <button
        type="button"
        className="diary-back-button"
        onClick={() => setShowFoodDiary(false)}
      >
        ← Back
      </button>

        <div className="date-select">
        <label htmlFor="diary-date"></label>

          <input
            id="diary-date"
            type="date"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
          </div>

        <section className="panel">
          <h2>Food Diary</h2>
          <p>Entries for {selectedDate}</p>

          {selectedEntries.length === 0 ? (
            <p>No foods recorded for this date yet.</p>
          ) : (
           <div className="diary-grid">
          {MEALS.map((meal) => {
            const mealEntries = selectedEntries.filter(
              (entry) => entry.meal === meal
            );

            return (
              <div
                className={`diary-meal diary-meal--${meal.toLowerCase()}`}
                key={meal}
              >
                <h3>{meal}</h3>

                {mealEntries.length === 0 ? (
                  <p>No foods added yet.</p>
                ) : (
                  mealEntries.map((entry) => (
                    <div className="diary-entry" key={entry.id}>
                      <div className="diary-entry-info">
                        <strong>{entry.name}</strong>

                        {entry.brand && <p>{entry.brand}</p>}

                        <p>
                          {entry.servings} ×{" "}
                          {entry.servingDescription || "serving"}
                        </p>

                        <p>Calories: {entry.calories} kcal</p>
                        <p>Protein: {entry.protein} g</p>
                        <p>Carbohydrates: {entry.carbs} g</p>
                        <p>Total fat: {entry.fat} g</p>
                        <p>Saturated fat: {entry.saturatedFat} g</p>
                        <p>Fiber: {entry.fiber} g</p>
                        <p>Sugar: {entry.sugar} g</p>
                        <p>Sodium: {entry.sodium} mg</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromDiary(entry.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            );
          })}
</div>
    )}
  </section>
  </section>
)}



<section className="protein-goal-card">

  <button
    type="button"
    onClick={() => setShowProteinForm(true)}
  >
    {proteinGoal !== null ? "Edit Protein Goal" : "Set Protein Goal"}
  </button>
</section>

{showProteinForm && (
  <section className="protein-form-panel">
    <button
      type="button"
      onClick={() => setShowProteinForm(false)}
    >
      ← Back
    </button>

    <ProteinCalculator
      maintenanceResult={goalResult}
      onResult={handleProteinGoal}
    />

    
  </section>
)}
          
        

    
    </main>
  )
}


export default App;
