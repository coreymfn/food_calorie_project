import { useEffect, useState } from "react";
import { searchFoods, getFoodDetails } from "./api/fatsecret";
import "./App.css";

const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

const emptyNutrition = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
};

const DEFAULT_GOALS = {
  calories: 2000,
  protein: 150,
  carbs: 250,
  fat: 65,
};

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function readSavedDiary() {
  try {
    const saved = localStorage.getItem("nutritionDiary");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function readSavedGoals() {
  try {
    const saved = localStorage.getItem("nutritionGoals");
    return saved ? { ...DEFAULT_GOALS, ...JSON.parse(saved) } : DEFAULT_GOALS;
  } catch {
    return DEFAULT_GOALS;
  }
}

function formatNumber(value, digits = 1) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(digits);
}

function FoodImage({ src, alt, className = "" }) {
  const [failedSrc, setFailedSrc] = useState("");

  if (!src || failedSrc === src) {
    return (
      <div
        className={`food-image-placeholder ${className}`}
        aria-label="Food image unavailable"
      >
        <span>🍽️</span>
        <small>No image</small>
      </div>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
    />
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);

  const [servings, setServings] = useState(1);
  const [selectedServingIndex, setSelectedServingIndex] = useState(0);
  const [selectedMeal, setSelectedMeal] = useState("Breakfast");

  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const [diary, setDiary] = useState(readSavedDiary);
  const [goals, setGoals] = useState(readSavedGoals);
  const [selectedDate, setSelectedDate] = useState(() => getLocalDateString());

  useEffect(() => {
    localStorage.setItem("nutritionDiary", JSON.stringify(diary));
  }, [diary]);

  useEffect(() => {
    localStorage.setItem("nutritionGoals", JSON.stringify(goals));
  }, [goals]);

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

  const servingOptions = selectedFood?.servings ?? [];

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

    const entry = {
      id: crypto.randomUUID(),
      foodId: selectedFood.id,
      name: selectedFood.name,
      brand: selectedFood.brand,
      image: selectedFood.image,
      meal: selectedMeal,
      date: selectedDate,
      servings,
      servingDescription: selectedServing.description,
      calories: estimatedNutrition.calories,
      protein: estimatedNutrition.protein,
      carbs: estimatedNutrition.carbs,
      fat: estimatedNutrition.fat,
    };

    setDiary((currentDiary) => [...currentDiary, entry]);
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
    <main className="app">
      <header className="app-header">
        <div>
          <p className="eyebrow">YOUR DAILY FOOD TRACKER</p>
          <h1>Nutrition Diary</h1>
          <p className="subtitle">
            Search foods, track portions, and keep up with your nutrition.
          </p>
        </div>
      </header>

      {error && (
        <div className="message error-message" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="message-close"
            onClick={() => setError("")}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <section className="panel search-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FOOD DATABASE</p>
            <h2>Find a food</h2>
          </div>
        </div>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try banana, oatmeal, or a brand name..."
            aria-label="Search for a food"
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

      <section className="panel diary-panel">
        <div className="section-heading diary-heading">
          <div>
            <p className="eyebrow">YOUR FOOD LOG</p>

            <h2>
              {selectedDate === getLocalDateString()
                ? "Today's diary"
                : "Diary history"}
            </h2>

            <p className="subtitle">Your entries are saved in this browser.</p>

            <label htmlFor="diary-date">Choose a date</label>
            <input
              id="diary-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </div>

          {selectedEntries.length > 0 && (
            <button
              type="button"
              className="secondary-button"
              onClick={clearDiary}
            >
              Clear diary
            </button>
          )}
        </div>

        <div className="daily-summary">
          <div className="daily-calories">
            <span>Total calories</span>
            <strong>{formatNumber(dailyTotals.calories, 0)}</strong>
            <small>kcal</small>
          </div>

          <div className="summary-macros">
            <SummaryMacro label="Protein" value={dailyTotals.protein} />
            <SummaryMacro label="Carbs" value={dailyTotals.carbs} />
            <SummaryMacro label="Fat" value={dailyTotals.fat} />
          </div>
        </div>

        <section className="daily-goals">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR DAILY TARGETS</p>
              <h3>Nutrition goals</h3>
              <p className="subtitle">
                Update your targets and track your progress.
              </p>
            </div>
          </div>

          <div className="goals-grid">
            {goalItems.map((item) => {
              const progress =
                item.goal > 0 ? (item.current / item.goal) * 100 : 0;

              const remaining = Math.max(0, item.goal - item.current);

              return (
                <article className="goal-card" key={item.key}>
                  <div className="goal-card-heading">
                    <label htmlFor={`goal-${item.key}`}>{item.label}</label>

                    <strong>
                      {Math.round(item.current).toLocaleString()}
                      {" / "}
                      {item.goal.toLocaleString()} {item.unit}
                    </strong>
                  </div>

                  <div
                    className="goal-progress-track"
                    role="progressbar"
                    aria-label={`${item.label} progress`}
                    aria-valuemin={0}
                    aria-valuemax={item.goal}
                    aria-valuenow={Math.min(item.current, item.goal)}
                  >
                    <div
                      className="goal-progress-fill"
                      style={{
                        width: `${Math.min(100, progress)}%`,
                      }}
                    />
                  </div>

                  <div className="goal-card-footer">
                    <span>{Math.round(progress)}% of goal</span>
                    <span>
                      {remaining > 0
                        ? `${remaining.toLocaleString(undefined, {
                            maximumFractionDigits: 1,
                          })} ${item.unit} left`
                        : "Goal reached!"}
                    </span>
                  </div>

                  <label
                    className="goal-input-label"
                    htmlFor={`goal-${item.key}`}
                  >
                    Daily target
                  </label>

                  <input
                    id={`goal-${item.key}`}
                    type="number"
                    min="1"
                    step="any"
                    value={goals[item.key] || ""}
                    onChange={(event) => {
                      const value = event.target.value;

                      setGoals((current) => ({
                        ...current,
                        [item.key]: value === "" ? 0 : Number(value),
                      }));
                    }}
                    onBlur={() => {
                      setGoals((current) => ({
                        ...current,
                        [item.key]:
                          Number(current[item.key]) > 0
                            ? Number(current[item.key])
                            : DEFAULT_GOALS[item.key],
                      }));
                    }}
                  />
                </article>
              );
            })}
          </div>
        </section>

        {selectedEntries.length === 0 ? (
          <div className="empty-diary">
            <span className="empty-icon">🥗</span>
            <h3>Your diary is empty</h3>
            <p>Search for a food above and add it to a meal.</p>
          </div>
        ) : (
          <div className="meal-list">
            {MEALS.map((meal) => {
              const entries = selectedEntries.filter(
                (entry) => entry.meal === meal,
              );

              return (
                <section className="meal-section" key={meal}>
                  <div className="meal-heading">
                    <h3>{meal}</h3>
                    <span>
                      {formatNumber(
                        entries.reduce(
                          (sum, entry) => sum + (Number(entry.calories) || 0),
                          0,
                        ),
                        0,
                      )}{" "}
                      kcal
                    </span>
                  </div>

                  {entries.length === 0 ? (
                    <p className="empty-meal">No foods added yet.</p>
                  ) : (
                    entries.map((entry) => (
                      <article className="diary-entry" key={entry.id}>
                        <FoodImage
                          src={entry.image}
                          alt={entry.name}
                          className="diary-thumbnail"
                        />

                        <div className="diary-entry-info">
                          <strong>{entry.name}</strong>
                          {entry.brand && <small>{entry.brand}</small>}
                          <small>
                            {formatNumber(entry.servings)} ×{" "}
                            {entry.servingDescription || "serving"}
                          </small>
                          <span className="entry-macros">
                            {formatNumber(entry.calories, 0)} kcal · P{" "}
                            {formatNumber(entry.protein)}g · C{" "}
                            {formatNumber(entry.carbs)}g · F{" "}
                            {formatNumber(entry.fat)}g
                          </span>
                        </div>

                        <button
                          type="button"
                          className="remove-button"
                          onClick={() => removeFromDiary(entry.id)}
                          aria-label={`Remove ${entry.name}`}
                          title="Remove food"
                        >
                          ×
                        </button>
                      </article>
                    ))
                  )}
                </section>
              );
            })}
          </div>
        )}
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
