function MaintenanceCalories(height, weight, gender, activity, age) {
  if (activity === "Sedentary") {
    activity = 1.2;
  } else if (activity === "lightly active") {
    activity = 1.375;
  } else if (activity === "moderately active") {
    activity = 1.55;
  } else if (activity === "very active") {
    activity = 1.725;} 
    else if (activity === "extra active"){
    activity = 1.9;}
     else {
    return null;}
  if (gender === "Male") {
    return (height * 6.25 + weight * 10 - age * 5 + 5) * activity;}
     else if (gender === "Female") {
    return (height * 6.25 + weight * 10 - age * 5 - 161) * activity;}
  return null;
}

export default MaintenanceCalories;