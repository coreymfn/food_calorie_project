import { useState } from "react";

function ProteinForm({ onCalculate }) {
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState("general");

  function handleSubmit(event) {
    event.preventDefault();

    const bodyWeight = Number(weight);

    if (
      !Number.isFinite(bodyWeight) ||
      bodyWeight < 25 ||
      bodyWeight > 350
    ) {
      onCalculate({ error: "Enter a weight between 25 and 350 kg." });
      return;
    }

    const proteinRanges = {
      general: { min: 0.8, max: 1.0, label: "General Health" },
      lose: { min: 1.2, max: 1.6, label: "Weight Loss" },
      muscle: { min: 1.6, max: 2.2, label: "Muscle Gain" },
      athletic: { min: 1.2, max: 2.0, label: "Athletic Performance" },
    };

    const range = proteinRanges[goal];
    const minimum = Math.round(bodyWeight * range.min);
    const maximum = Math.round(bodyWeight * range.max);

    onCalculate({
      minimum,
      maximum,
      target: Math.round((minimum + maximum) / 2),
      goal: range.label,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="protein-weight">Current Weight (kg)</label>
        <input
          id="protein-weight"
          type="number"
          min="25"
          max="350"
          step="0.1"
          placeholder="e.g. 75"
          value={weight}
          onChange={(event) => setWeight(event.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="protein-goal">Your Goal</label>
        <select
          id="protein-goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
        >
          <option value="general">General Health</option>
          <option value="lose">Weight Loss</option>
          <option value="muscle">Muscle Gain</option>
          <option value="athletic">Athletic Performance</option>
        </select>
      </div>

      <button type="submit">Calculate Protein Needs</button>
    </form>
  );
}
function ProteinCalculator() {
  const [result, setResult] = useState(null);
  return (
    <section>
      <h2>Daily Protein Calculator</h2>
      <p>
        Estimate your daily protein needs based on your weight and goal.
      </p>
      <ProteinForm onCalculate={setResult} />
      {result && (
        <section aria-live="polite">
          {result.error ? (
            <>
              <h3>Check Your Information</h3>
              <p>{result.error}</p>
            </>
          ) : (
            <>
              <h3>Your Estimated Protein Needs</h3>
              <p>
                <strong>Goal:</strong> {result.goal}
              </p>
              <p>
                <strong>Daily range:</strong>{" "}
                {result.minimum}–{result.maximum} grams
              </p>
              <p>
                <strong>Midpoint target:</strong>{" "}
                {result.target} grams per day
              </p>
              <p>
                These are general estimates for adults. Individual needs
                vary. Consult a healthcare professional if you have a
                condition that affects protein intake.
              </p>
            </>
          )}
        </section>
      )}
    </section>
  );
}

export default ProteinCalculator;