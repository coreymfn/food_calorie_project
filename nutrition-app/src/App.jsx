import { useState } from "react";
import { searchFoods, getFoodDetails } from "./api/usda";

function App() {
  const [query, setQuery] = useState("");
  const [foods, setFoods] = useState([]);
  const [selectedFood, setSelectedFood] = useState(null);
  const [servings, setServings] = useState(1);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");

  const [diary, setDiary] = useState(() => {
    try {
      const savedDiary = localStorage.getItem("nutritionDiary");
      return savedDiary ? JSON.parse(savedDiary) : [];
    } catch {
      return [];
    }
  });

  const [selectedMeal, setSelectedMeal] = useState("Breakfast");

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

  async function handleSelectFood(fdcId) {
    setDetailsLoading(true);
    setError("");
    setSelectedFood(null);
    setServings(1);

    try {
      const details = await getFoodDetails(fdcId);
      setSelectedFood(details);
    } catch (err) {
      setError(err.message || "Could not load food details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  function getNutrition(food) {
    const nutrients = food.foodNutrients ?? [];

    function findAmount(names) {
      const nutrient = nutrients.find((item) => {
        const name = item.nutrient?.name ?? item.nutrientName ?? item.name;

        return names.includes(name);
      });

      return Number(nutrient?.amount ?? nutrient?.value ?? 0);
    }

    return {
      calories: findAmount(["Energy"]),
      protein: findAmount(["Protein"]),
      carbs: findAmount(["Carbohydrate, by difference"]),
      fat: findAmount(["Total lipid (fat)"]),
    };
  }

  const nutrition = selectedFood ? getNutrition(selectedFood) : null;

  function addToDiary() {
    if (!selectedFood || !nutrition || servings <= 0) {
      setError("Enter a quantity greater than zero.");
      return;
    }

    const entry = {
      id: `${Date.now()}-${Math.random()}`,
      name: selectedFood.description,
      meal: selectedMeal,
      servings: servings,
      calories: nutrition.calories * servings,
      protein: nutrition.protein * servings,
      carbs: nutrition.carbs * servings,
      fat: nutrition.fat * servings,
    };

    const updatedDiary = [...diary, entry];

    setDiary(updatedDiary);
    localStorage.setItem("nutritionDiary", JSON.stringify(updatedDiary));

    setError("");
  }

  function removeFromDiary(id) {
    const updatedDiary = diary.filter((entry) => entry.id !== id);

    setDiary(updatedDiary);
    localStorage.setItem("nutritionDiary", JSON.stringify(updatedDiary));
  }

  return (
    <main>
      <h1>Nutrition App</h1>

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

      <h2>Search Results</h2>

      <ul>
        {foods.map((food) => (
          <li key={food.fdcId}>
            <span>
              {food.description} ({food.dataType})
            </span>{" "}
            <button type="button" onClick={() => handleSelectFood(food.fdcId)}>
              View Nutrition
            </button>
          </li>
        ))}
      </ul>

      {detailsLoading && <p>Loading nutrition details...</p>}

      {selectedFood && nutrition && (
        <section>
          <h2>{selectedFood.description}</h2>

          <p>Food category: {selectedFood.dataType}</p>

          <h3>Nutrition per 100 g (when applicable)</h3>

          <ul>
            <li>Calories: {nutrition.calories} kcal</li>
            <li>Protein: {nutrition.protein} g</li>
            <li>Carbohydrates: {nutrition.carbs} g</li>
            <li>Fat: {nutrition.fat} g</li>
          </ul>

          <label htmlFor="servings">Quantity (multiples of 100 g)</label>

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

          <h3>Estimated nutrition for this quantity</h3>

          <ul>
            <li>Calories: {(nutrition.calories * servings).toFixed(1)} kcal</li>
            <li>Protein: {(nutrition.protein * servings).toFixed(1)} g</li>
            <li>Carbohydrates: {(nutrition.carbs * servings).toFixed(1)} g</li>
            <li>Fat: {(nutrition.fat * servings).toFixed(1)} g</li>
          </ul>

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
    </main>
  );
}

export default App;
