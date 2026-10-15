import MaintenanceCalories from "./maintence_calories.jsx";

function calculateGoal(
  height,
  weight,
  gender,
  activity,
  age,
  pounds = 0,
  weeks = 0,
  goalType = "lose"
) {
  // Validate the basic measurements.
  if (
    ![height, weight, age].every(Number.isFinite) ||
    height < 80 ||
    height > 250 ||
    weight < 25 ||
    weight > 350 ||
    age < 18 ||
    age > 120
  ) {
    return {
      error:
        "Enter a valid adult age, height in cm, and weight in kg.",
    };
  }
  // 2. Validate the selected goal.
  if (!["lose", "maintain", "gain"].includes(goalType)) {
    return { error: "Choose lose, maintain, or gain weight." };
  }
  // Calculate estimated maintenance calories.
  const maintenanceCalories = MaintenanceCalories(
    height,
    weight,
    gender,
    activity,
    age
  );
  if (
    !Number.isFinite(maintenanceCalories) ||
    maintenanceCalories <= 0
  ) {
    return {
      error: "Check your gender and activity selections.",
    };
  }

  const maintenance = Math.round(maintenanceCalories);

  // Maintaining weight requires no deficit or surplus.
  if (goalType === "maintain") {
    return {
      goalType,
      maintenanceCalories: maintenance,
      goalCalories: maintenance,
      dailyAdjustment: 0,
      warnings: [],
    };
  }

  // Validate the requested weight change.
  if (
    !Number.isFinite(pounds) ||
    !Number.isFinite(weeks) ||
    pounds <= 0 ||
    pounds > 200 ||
    weeks < 1 ||
    weeks > 104
  ) {
    return {
      error:
        "Enter a weight change above 0 and up to 200 lb, over 1-104 weeks.",
    };
  }

  const poundsPerWeek = pounds / weeks;
  const bodyWeightPounds = weight * 2.20462;
  const weeklyChangePercent =
    (poundsPerWeek / bodyWeightPounds) * 100;
  const warnings = [];
  // Flag ambitious rates of weight change.
  if (goalType === "lose" && weeklyChangePercent > 1) {
    warnings.push(
      "This weight-loss rate exceeds 1% of body weight per week. Consider a slower goal and consult a qualified healthcare professional."
    );
  }
  if (goalType === "gain" && weeklyChangePercent > 0.5) {
    warnings.push(
      "This weight-gain rate exceeds 0.5% of body weight per week. Consider a slower goal and seek professional guidance if needed."
    );
  }
  // Estimate the daily deficit or surplus.
  // The 3,500 kcal/lb rule is approximate and not a
  // reliable prediction of long-term weight change.
  const dailyAdjustment = Math.round(
    (pounds * 3500) / (weeks * 7)
  );
  const goalCalories =
    goalType === "lose"
      ? maintenance - dailyAdjustment
      : maintenance + dailyAdjustment;
  // Do not return an extremely low target as a recommendation.
  // This is a conservative app guardrail, not a universal
  // definition of a safe calorie intake.
  if (goalCalories < 1200) {
    return {
      error:
        "This plan produces an estimated target below 1,200 kcal/day. The app will not recommend this target. Choose a slower rate or seek advice from a registered dietitian or healthcare professional.",
      maintenanceCalories: maintenance,
      warnings,
    };
  }
  return {
    goalType,
    maintenanceCalories: maintenance,
    goalCalories,
    dailyAdjustment,
    poundsPerWeek: Number(poundsPerWeek.toFixed(2)),
    weeklyChangePercent: Number(
      weeklyChangePercent.toFixed(2)
    ),
    weeks,
    warnings,
  };
}

export default calculateGoal;