import MaintenanceCalories from "./MaintenanceCalories";

function calculateGoal(height, weight, gender, activity, age, pounds, weeks) {
  const maintenanceCalories = MaintenanceCalories(
    height,
    weight,
    gender,
    activity,
    age
  );
  if (
    maintenanceCalories === null ||
    !Number.isFinite(pounds) ||
    !Number.isFinite(weeks) ||
    pounds <= 0 ||
    weeks <= 0
  ) {
    return "Please enter valid information.";
  }
  const poundsPerWeek = pounds / weeks;
  return {
    maintenanceCalories: Math.round(maintenanceCalories),
    poundsPerWeek: Number(poundsPerWeek.toFixed(2)),
    weeks: weeks,
  };
}

export default calculateGoal;