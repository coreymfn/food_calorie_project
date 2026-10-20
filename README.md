<div align="center">

  <img width="30%" src="./nutrition-app/Fitty.png" alt="Fitty!">

  # My Fitty

  ## My Fitty

  Nutrition Diary is a web application that helps users track their daily food intake and nutrition. Users can search for foods, create custom foods, add meals to their diary, and view their daily nutrition totals. The app also includes tools to calculate daily calorie goals and estimate protein needs.

  | COLOR PALETTE | DEMO |
  |:---:|:---:|
  | ![Color Palette](./nutrition-app/Warm%20Earth-Tone%20Color%20Palette.png) | ![Demo](./nutrition-app/Recording%202026-10-20%20084122.mp4) |

</div>

## KEY FEATURES

- **Food Search:** Search for foods using data from the USDA FoodData Central API.
- **Nutrition Tracking:** Track calories, protein, carbohydrates, fat, saturated fat, fiber, sugar, and sodium.
- **Food Diary:** Add and remove foods from your diary and organize them by meal and date.
- **Serving Sizes:** Choose serving sizes and adjust the number of servings.
- **Custom Foods:** Create your own foods by entering the food name, serving size, and nutrition information. Save them and add them directly to your diary.
- **Calorie Calculator:** Estimate daily maintenance calories using height, weight, age, gender, and activity level.
- **Weight Goals:** Calculate calorie goals for losing, maintaining, or gaining weight.
- **Protein Calculator:** Estimate daily protein needs based on weight and goals.
- **Saved Data:** Store diary entries, custom foods, and calorie goal results in browser local storage.

The project was created to make tracking food intake easier and help users understand their daily nutrition.

## HOW TO USE (Visual Studio Code)

### Requirements

- [Visual Studio Code](https://code.visualstudio.com/)
- [Node.js](https://nodejs.org/)
- npm, which comes with Node.js

### Setup Instructions

1. Download or clone the project repository to your computer.
2. Open Visual Studio Code.
3. Select **File → Open Folder** and open the project folder.
4. Open the terminal in Visual Studio Code.
5. Navigate to the folder containing the React application.
6. Install the project dependencies:

   ```bash
   npm install
   ```

7. Start the development server:

   ```bash
   npm run dev
   ```

8. Open the local URL displayed in the terminal to use the application.


### Using the Application

#### Searching for Food

1. Enter a food name in the search bar.
2. Choose a food from the search results.
3. Select a serving size and number of servings.
4. Choose a meal and date, then add the food to your diary.

#### Creating Custom Foods

1. Open the custom food section.
2. Enter the food's name and serving size.
3. Enter its nutrition information, such as calories, protein, carbohydrates, and fat.
4. Save the custom food.
5. Add it to your diary and select the meal it belongs to.

#### Tracking Daily Nutrition

1. Select the date you want to view.
2. Add foods from the search results or your custom foods.
3. Review your daily nutrition totals.
4. Remove diary entries when needed.

#### Calculating Calorie Goals

1. Enter your height, weight, age, gender, and activity level.
2. Choose whether you want to lose, maintain, or gain weight.
3. Enter the requested weight change and time frame if needed.
4. View your estimated calorie goal.

#### Calculating Protein Needs

1. Calculate your maintenance calories and weight goal.
2. Open the protein calculator.
3. Review your estimated daily protein range.

## TECHNOLOGIES USED

- React
- JavaScript
- HTML and CSS
- USDA FoodData Central API
- Browser local storage

## LICENSE

No license has been specified yet. Add your chosen license here if required.