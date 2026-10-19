import { useState } from "react";
import calculateGoal from "./calculateGoal";

function MaintenanceCaloriesForm({ onResult }) {
  const [goalForm, setGoalForm] = useState(() => {
    const defaultForm = {
      height: "",
      weight: "",
      gender: "",
      activity: "",
      age: "",
      goalType: "lose",
      pounds: "",
      weeks: "",
    };
    try {
      const savedForm = localStorage.getItem("maintenanceGoalForm");

      return savedForm
        ? { ...defaultForm, ...JSON.parse(savedForm) }
        : defaultForm;
    } catch {
      return defaultForm;
    }
  });
  const [result, setResult] = useState(() => {
    try {
      const savedResult = localStorage.getItem("maintenanceGoalResult");
      return savedResult ? JSON.parse(savedResult) : null;
    } catch {
      return null;
    }
  });
  function handleGoalChange(event) {
    const { name, value } = event.target;
    const updatedForm = {
      ...goalForm,
      [name]: value,
    };
    // Calculate the weeks automatically.
    if (name === "pounds" || name === "goalType") {
      updatedForm.weeks =
        updatedForm.goalType !== "maintain" &&
        Number(updatedForm.pounds) > 0
          ? String(Math.ceil(Number(updatedForm.pounds) / 1))
          : "";
    }
    setGoalForm(updatedForm);
    localStorage.setItem(
      "maintenanceGoalForm",
      JSON.stringify(updatedForm)
    );
    setResult(null);
    localStorage.removeItem("maintenanceGoalResult");
    onResult?.(null);
  }
  function handleGoalSubmit(event) {
    event.preventDefault();
    const {
      height,
      weight,
      gender,
      activity,
      age,
      goalType,
      pounds,
    } = goalForm;
    const calculatedWeeks =
      goalType === "maintain"
        ? 0
        : Number(pounds) > 0
          ? Math.ceil(Number(pounds) / 1)
          : 0;
    const calculation = calculateGoal(
      Number(height),
      Number(weight),
      gender,
      activity,
      Number(age),
      pounds === "" ? 0 : Number(pounds),
      calculatedWeeks,
      goalType
    );
    const sharedResult = {
      ...calculation,
      weight: Number(weight),
    };
    setResult(sharedResult);
    localStorage.setItem(
      "maintenanceGoalResult",
      JSON.stringify(sharedResult)
    );
    // Save the automatically calculated weeks too.
    const updatedForm = {
      ...goalForm,
      weeks: String(calculatedWeeks),
    };
    setGoalForm(updatedForm);
    localStorage.setItem(
      "maintenanceGoalForm",
      JSON.stringify(updatedForm)
    );
    onResult?.(sharedResult);
  }


function handleEditGoal() {
  setResult(null);
  localStorage.removeItem("maintenanceGoalResult");
  onResult?.(null);
}

  return (
      <section>
      {!result ? (
      // Show the form when there are no results
      <form className="formy" onSubmit={handleGoalSubmit}>
        <h2>Maintenance Calories and Weight Goals</h2>

      <p>
        Enter your information to estimate your daily maintenance
        calories and set a weight goal.
      </p>
        <div>
          <label htmlFor="height">Height (cm)</label>
          <input
            id="height"
            name="height"
            type="number"
            min="80"
            max="250"
            step="0.1"
            placeholder="e.g. 175"
            value={goalForm.height}
            onChange={handleGoalChange}
            required
          />
        </div>
        <div>
          <label htmlFor="weight">Current Weight (kg)</label>
          <input
            id="weight"
            name="weight"
            type="number"
            min="25"
            max="350"
            step="0.1"
            placeholder="e.g. 75"
            value={goalForm.weight}
            onChange={handleGoalChange}
            required
          />
        </div>
        <div>
          <label htmlFor="age">Age (years)</label>
          <input
            id="age"
            name="age"
            type="number"
            min="18"
            max="120"
            placeholder="Enter your age"
            value={goalForm.age}
            onChange={handleGoalChange}
            required
          />
        </div>
        <div>
          <label htmlFor="gender">Gender</label>
          <select
            id="gender"
            name="gender"
            value={goalForm.gender}
            onChange={handleGoalChange}
            required
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
        <div className="activity"> 
          <label htmlFor="activity">Activity Level</label>
          <select
            id="activity"
            name="activity"
            value={goalForm.activity}
            onChange={handleGoalChange}
            required
          >
            <option value="">Select activity level</option>
            <option value="sedentary">
              Sedentary — little or no exercise
            </option>
            <option value="lightly active">
              Lightly Active — light exercise 1-3 days/week
            </option>
            <option value="moderately active">
              Moderately Active — moderate exercise 3-5 days/week
            </option>
            <option value="very active">
              Very Active — hard exercise 6-7 days/week
            </option>
            <option value="extra active">
              Extra Active — very hard exercise or physical job
            </option>
          </select>
        </div>
        <div>
          <label htmlFor="goalType">Weight Goal</label>
          <select
            id="goalType"
            name="goalType"
            value={goalForm.goalType}
            onChange={handleGoalChange}
            required
          >
            <option value="lose">Lose Weight</option>
            <option value="maintain">Maintain Weight</option>
            <option value="gain">Gain Weight</option>
          </select>
        </div>
        {goalForm.goalType !== "maintain" && (
          <>
            <div>
              <label htmlFor="pounds">
                Pounds to {goalForm.goalType === "lose" ? "Lose" : "Gain"}
              </label>
              <input
                id="pounds"
                name="pounds"
                type="number"
                min="0.1"
                max="200"
                step="0.1"
                placeholder="e.g. 10"
                value={goalForm.pounds}
                onChange={handleGoalChange}
                required
              />
            </div>
            <div>
              <label htmlFor="weeks">Estimated Number of Weeks</label>
              <input
                id="weeks"
                name="weeks"
                type="number"
                value={
                  Number(goalForm.pounds) > 0
                    ? Math.ceil(Number(goalForm.pounds) / 1)
                    : ""
                }
                readOnly
              />
              <p>
                This is a mathematical estimate, not a prediction
                of how your body will change.
              </p>
            </div>
          </>
        )}
        <button className="calc-cal" type="submit">Calculate Calories</button>
      </form>
  
) : (
  // Show the results when result exists
  <section className="result-From-Calcs" aria-live="polite">
    {result.error ? (
      <>
        <h3>Check Your Information</h3>
        <p>{result.error}</p>

        {result.maintenanceCalories != null && (
          <p>
            Estimated maintenance calories:{" "}
            <strong>
              {result.maintenanceCalories.toLocaleString()} kcal/day
            </strong>
          </p>
        )}

        {result.warnings?.map((warning, index) => (
          <p key={index}>{warning}</p>
        ))}
      </>
    ) : (
      <>
        <h3>Your Estimated Results</h3>

        <p>
          <strong>Maintenance Calories:</strong>{" "}
          {result.maintenanceCalories.toLocaleString()} kcal/day
        </p>

        <p>
          <strong>Daily Calorie Goal:</strong>{" "}
          {result.goalCalories.toLocaleString()} kcal/day
        </p>

        <p>
          <strong>Weight Goal:</strong>{" "}
          {result.goalType === "lose"
            ? "Lose Weight"
            : result.goalType === "gain"
              ? "Gain Weight"
              : "Maintain Weight"}
        </p>

        {result.goalType !== "maintain" && (
          <>
            <p>
              <strong>Daily Calorie Adjustment:</strong>{" "}
              {result.dailyAdjustment.toLocaleString()} kcal{" "}
              {result.goalType === "lose" ? "below" : "above"} maintenance
            </p>

            <p>
              <strong>Planned Weekly Change:</strong>{" "}
              {result.poundsPerWeek} lb/week
            </p>

            <p>
              <strong>Timeframe:</strong> {result.weeks} weeks
            </p>
          </>
        )}

        {result.warnings?.map((warning, index) => (
          <p key={index}>{warning}</p>
        ))}

        <p>
          These are estimates, not medical advice. Actual calorie
          needs vary. Consult a qualified healthcare professional
          for individualized guidance.
        </p>
      </>
    )}

    <button type="button"  className="edit-info-button" onClick={handleEditGoal}>
      Edit Information
    </button>
  </section>
)}
</section>
)}
    
export default MaintenanceCaloriesForm;