import { useState } from "react";

function CustomFood({ selectedMeal, onAddToDiary }) {
  const [customFoods, setCustomFoods] = useState(() => {
    try {
      const savedFoods = localStorage.getItem("customFoods");
      return savedFoods ? JSON.parse(savedFoods) : [];
    } catch {
      return [];
    }
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [customMeal, setCustomMeal] = useState(selectedMeal);
  const [foodForm, setFoodForm] = useState({
    name: "",
    serving: "1 serving",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    saturatedFat: "",
    fiber: "",
    sugar: "",
    sodium: "",
  });

  const [error, setError] = useState("");

  function handleChange(event) {
    const { name, value } = event.target;

    setFoodForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const name = foodForm.name.trim();
    const serving = foodForm.serving.trim();

    if (!name || !serving) {
      setError("Enter a food name and serving description.");
      return;
    }
    const numericFields = [
      "calories",
      "protein",
      "carbs",
      "fat",
      "saturatedFat",
      "fiber",
      "sugar",
      "sodium",
    ];

    const hasInvalidValue = numericFields.some((field) => {
      const value = foodForm[field];

      return (
        value === "" ||
        !Number.isFinite(Number(value)) ||
        Number(value) < 0
      );
    });

    if (hasInvalidValue) {
      setError("Enter valid, non-negative nutrition values.");
      return;
    }

    const newFood = {
      id: crypto.randomUUID(),
      name,
      serving,
      calories: Number(foodForm.calories),
      protein: Number(foodForm.protein),
      carbs: Number(foodForm.carbs),
      fat: Number(foodForm.fat),
      saturatedFat: Number(foodForm.saturatedFat),
      fiber: Number(foodForm.fiber),
      sugar: Number(foodForm.sugar),
      sodium: Number(foodForm.sodium),
    };

    const updatedFoods = [...customFoods, newFood];

    setCustomFoods(updatedFoods);
    localStorage.setItem("customFoods", JSON.stringify(updatedFoods));

    setFoodForm({
      name: "",
      serving: "1 serving",
      calories: "",
      protein: "",
      carbs: "",
      fat: "",
      saturatedFat: "",
      fiber: "",
      sugar: "",
      sodium: "",
    });

    setError("");
    setIsFormOpen(false);
  }
  function removeCustomFood(foodId) {
    const updatedFoods = customFoods.filter(
        (food) => food.id !== foodId
    );

    setCustomFoods(updatedFoods);
    localStorage.setItem("customFoods", JSON.stringify(updatedFoods));
    }
  function handleAddToDiary(food) {
    onAddToDiary(food, customMeal);
  }

  return (
    <section className="panel custom-food-section">
      <button
        type="button"
        onClick={() => setIsFormOpen((previous) => !previous)}
        aria-expanded={isFormOpen}
      >
        {isFormOpen ? "- Hide Custom Food Form" : "+ Create a Custom Food"}
      </button>

      {isFormOpen && (
        <div className="custom-food-form">
          <h2>Create a Custom Food</h2>
          <p>Enter nutrition values for one serving of your food.</p>

          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="custom-name">Food Name</label>
              <input
                id="custom-name"
                name="name"
                value={foodForm.name}
                onChange={handleChange}
                placeholder="e.g. Homemade sandwich"
                required
              />
            </div>

            <div>
              <label htmlFor="custom-serving">
                Serving Description
              </label>
              <input
                id="custom-serving"
                name="serving"
                value={foodForm.serving}
                onChange={handleChange}
                placeholder="e.g. 1 sandwich"
                required
              />
            </div>

            {[
              ["calories", "Calories (kcal)"],
              ["protein", "Protein (g)"],
              ["carbs", "Carbohydrates (g)"],
              ["fat", "Total Fat (g)"],
              ["saturatedFat", "Saturated Fat (g)"],
              ["fiber", "Fiber (g)"],
              ["sugar", "Sugar (g)"],
              ["sodium", "Sodium (mg)"],
            ].map(([field, label]) => (
              <div key={field}>
                <label htmlFor={`custom-${field}`}>
                  {label}
                </label>
                <input
                  id={`custom-${field}`}
                  name={field}
                  type="number"
                  min="0"
                  step="any"
                  value={foodForm[field]}
                  onChange={handleChange}
                  required
                />
              </div>
            ))}

            <button type="submit">Save Custom Food</button>
          </form>
        </div>
      )}

      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      <h2>My Custom Foods</h2>

      {customFoods.length === 0 ? (
        <p>You haven't created any custom foods yet.</p>
      ) : (
        <>
          <label htmlFor="custom-meal">Add custom food to:</label>
          <select
            id="custom-meal"
            value={customMeal}
            onChange={(event) => setCustomMeal(event.target.value)}
          >
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
            <option value="Snacks">Snacks</option>
          </select>

          <div className="custom-food-list">
            {customFoods.map((food) => (
              <div className="custom-food-card" key={food.id}>
                <div>
                  <h3>{food.name}</h3>
                  <p>Serving: {food.serving}</p>
                  <p>Calories: {food.calories} kcal</p>
                  <p>Protein: {food.protein} g</p>
                  <p>Carbs: {food.carbs} g</p>
                  <p>Fat: {food.fat} g</p>
                </div>
                <div className="custom-food-actions">
                <button
                    type="button"
                    onClick={() => handleAddToDiary(food)}
                >
                    + Add to {customMeal}
                </button>
                <button
                    type="button"
                    onClick={() => {
                    if (
                        window.confirm(
                        `Are you sure you want to remove ${food.name}?`
                        )
                    ) {
                        removeCustomFood(food.id);
                    }
                    }}
                >
                    Remove
                </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default CustomFood;