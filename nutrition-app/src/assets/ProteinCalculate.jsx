function ProteinCalculator({ maintenanceResult, onResult }) {
  if (!maintenanceResult) {
    return (
      <section>
        <h2>Daily Protein Calculator</h2>
        <p>
          Enter your information in Maintenance Calories and Weight
          Goals first to see your estimated protein range.
        </p>
      </section>
    );
  }

  if (maintenanceResult.error) {
    return (
      <section>
        <h2>Daily Protein Calculator</h2>
        <p>
          Please correct the information in Maintenance Calories
          and Weight Goals before calculating protein needs.
        </p>
      </section>
    );
  }

  const { weight, goalType, maintenanceCalories, goalCalories } =
    maintenanceResult;

  const proteinRanges = {
    lose: { min: 1.2, max: 1.6, label: "Lose Weight" },
    maintain: { min: 0.8, max: 1.0, label: "Maintain Weight" },
    gain: { min: 1.6, max: 2.2, label: "Gain Weight" },
  };

  const range = proteinRanges[goalType];

  if (!range || !Number.isFinite(weight) || weight <= 0) {
    return (
      <section>
        <h2>Daily Protein Calculator</h2>
        <p>Check your information in the maintenance form.</p>
      </section>
    );
  }

  const minimum = Math.round(weight * range.min);
  const maximum = Math.round(weight * range.max);
  const target = Math.round((minimum + maximum) / 2);

  return (
    <section>
      <h2>Daily Protein Calculator</h2>
      <p>
        Your protein estimate is connected to the information
        entered in Maintenance Calories and Weight Goals.
      </p>

      <h3>Your Shared Information</h3>
      <p>
        <strong>Weight goal:</strong> {range.label}
      </p>
      <p>
        <strong>Current weight:</strong> {weight} kg
      </p>

      <h3>Your Estimated Results</h3>
      <p>
        <strong>Maintenance calories:</strong>{" "}
        {maintenanceCalories?.toLocaleString() ?? "Not available"} kcal/day
      </p>
      <p>
        <strong>Daily calorie goal:</strong>{" "}
        {goalCalories?.toLocaleString() ?? "Not available"} kcal/day
      </p>
      <p>
        <strong>Estimated protein range:</strong> {minimum}–{maximum} grams/day
      </p>
      <p>
        <strong>Midpoint of range:</strong> {target} grams/day
      </p>

      <button
        type="button"
        onClick={() => onResult?.(target)}
      >
        Set This as My Protein Goal
      </button>

      <p>
        Protein values are general estimates, not personalized medical
        recommendations. Individual needs vary.
      </p>
    </section>
  );
}

export default ProteinCalculator;