import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Recipes } from './pages/Recipes';
import { RecipeForm } from './pages/RecipeForm';
import { RecipeDetail } from './pages/RecipeDetail';
import { Inventory } from './pages/Inventory';
import { InventoryForm } from './pages/InventoryForm';
import { Grocery } from './pages/Grocery';
import { MealPlan } from './pages/MealPlan';
import { MealForm } from './pages/MealForm';
import { MealDetail } from './pages/MealDetail';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="recipes" element={<Recipes />} />
          <Route path="recipes/new" element={<RecipeForm />} />
          <Route path="recipes/:id" element={<RecipeDetail />} />
          <Route path="recipes/:id/edit" element={<RecipeForm />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="inventory/new" element={<InventoryForm />} />
          <Route path="inventory/batch/:id" element={<InventoryForm />} />
          <Route path="grocery" element={<Grocery />} />
          <Route path="meal-plan" element={<MealPlan />} />
          <Route path="meal-plan/add" element={<MealForm />} />
          <Route path="meal-plan/:id" element={<MealDetail />} />
          <Route path="meal-plan/:id/edit" element={<MealForm />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
