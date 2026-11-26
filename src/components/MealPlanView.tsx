import React, { useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Calculator,
  Calendar,
  Check,
  ChefHat,
  Clock,
  ExternalLink,
  Leaf,
  Loader2,
  RefreshCw,
  ShoppingCart,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppData } from '../context/AppDataContext';
import {
  DIET_LABELS,
  DietType,
  MEAL_SLOT_LABELS,
  MealPlan,
  PlannedMeal,
} from '../types';
import { buildGoogleCalendarUrl, downloadWeeklyPlanIcs } from '../lib/calendarExport';
import { getIsoWeekNumber, getMondayIso, RECIPE_IMAGES } from '../data/seedData';
import { RecipeImage } from './PWAComponents';

const MACRO_COLORS = ['#0F766E', '#0284C7', '#D97706'];

function pickFallbackImage(meal: PlannedMeal): string {
  if (meal.imageUrl) return meal.imageUrl;
  const title = meal.title.toLowerCase();
  if (meal.slot === 'breakfast') return RECIPE_IMAGES.oats;
  if (title.includes('laks') || title.includes('fisk')) return RECIPE_IMAGES.salmon;
  if (title.includes('curry') || title.includes('wok') || title.includes('kikært')) return RECIPE_IMAGES.curry;
  if (title.includes('risotto') || title.includes('svamp') || title.includes('suppe')) return RECIPE_IMAGES.risotto;
  if (title.includes('pasta') || title.includes('bolognese') || title.includes('linse')) return RECIPE_IMAGES.bolognese;
  return RECIPE_IMAGES.chicken;
}

export const MealPlanView: React.FC<{ onNavigateToShopping: () => void }> = ({
  onNavigateToShopping,
}) => {
  const {
    profile,
    activeMealPlan,
    mealPlans,
    setActivePlanId,
    saveMealPlan,
    updateMealPlan,
    updateProfile,
    rebuildShoppingListFromPlan,
    saveRecipe,
    user,
  } = useAppData();

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showCalorieCalc, setShowCalorieCalc] = useState(false);
  const [expandedMealId, setExpandedMealId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [swappingMealId, setSwappingMealId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Generator form state
  const [genDiet, setGenDiet] = useState<DietType>(profile.dietType);
  const [genCalories, setGenCalories] = useState<number>(profile.dailyCalories);
  const [genHousehold, setGenHousehold] = useState<number>(profile.householdSize);
  const [genBudget, setGenBudget] = useState<number>(profile.weeklyMealBudgetDkk);
  const [genMaxPrep, setGenMaxPrep] = useState<number>(30);
  const [genAllergies, setGenAllergies] = useState<string>(profile.allergies.join(', '));
  const [genFridge, setGenFridge] = useState<string>('');

  // Calorie calculator (Mifflin-St Jeor)
  const [calcGender, setCalcGender] = useState<'female' | 'male'>('female');
  const [calcAge, setCalcAge] = useState(34);
  const [calcWeight, setCalcWeight] = useState(72);
  const [calcHeight, setCalcHeight] = useState(172);
  const [calcActivity, setCalcActivity] = useState(1.55);
  const [calcGoal, setCalcGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');

  const computedTarget = useMemo(() => {
    const bmr =
      calcGender === 'male'
        ? 10 * calcWeight + 6.25 * calcHeight - 5 * calcAge + 5
        : 10 * calcWeight + 6.25 * calcHeight - 5 * calcAge - 161;
    let tdee = Math.round(bmr * calcActivity);
    if (calcGoal === 'lose') tdee = Math.max(1350, tdee - 350);
    if (calcGoal === 'gain') tdee = tdee + 300;
    const protein = Math.round((tdee * 0.24) / 4);
    const fat = Math.round((tdee * 0.28) / 9);
    const carbs = Math.round((tdee - protein * 4 - fat * 9) / 4);
    return { tdee, protein, carbs, fat };
  }, [calcGender, calcAge, calcWeight, calcHeight, calcActivity, calcGoal]);

  const currentDay = activeMealPlan?.days[selectedDayIdx] || activeMealPlan?.days[0];

  const dayTotals = useMemo(() => {
    if (!currentDay) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, cost: 0, eatenKcal: 0 };
    }
    return currentDay.meals.reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein: acc.protein + m.protein,
        carbs: acc.carbs + m.carbs,
        fat: acc.fat + m.fat,
        fiber: acc.fiber + m.fiber,
        cost: acc.cost + m.estimatedCostDkk,
        eatenKcal: acc.eatenKcal + (m.eaten ? m.calories : 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, cost: 0, eatenKcal: 0 }
    );
  }, [currentDay]);

  const weeklyChartData = useMemo(() => {
    if (!activeMealPlan) return [];
    return activeMealPlan.days.map((d) => ({
      day: d.dayName.slice(0, 3),
      kcal: d.meals.reduce((sum, m) => sum + m.calories, 0),
      protein: d.meals.reduce((sum, m) => sum + m.protein, 0),
    }));
  }, [activeMealPlan]);

  const macroPieData = useMemo(
    () => [
      { name: 'Protein (g)', value: dayTotals.protein },
      { name: 'Kulhydrat (g)', value: dayTotals.carbs },
      { name: 'Fedt (g)', value: dayTotals.fat },
    ],
    [dayTotals]
  );

  const handleGeneratePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setErrorMsg(null);
    setStatusMessage(null);

    try {
      const allergiesArr = genAllergies
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await updateProfile({
        dietType: genDiet,
        dailyCalories: genCalories,
        householdSize: genHousehold,
        weeklyMealBudgetDkk: genBudget,
        allergies: allergiesArr,
      });

      const startDate = getMondayIso();
      const weekLabel = `Uge ${getIsoWeekNumber()} (${DIET_LABELS[genDiet]})`;

      const res = await fetch('/api/meal-plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dietType: genDiet,
          dailyCalories: genCalories,
          proteinTarget: profile.proteinTarget,
          householdSize: genHousehold,
          weeklyBudgetDkk: genBudget,
          allergies: allergiesArr,
          maxPrepMinutes: genMaxPrep,
          fridgeIngredients: genFridge,
          startDate,
          weekLabel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Fejl ved generering af madplan.');
      }

      const newPlan: MealPlan = {
        id: `plan-${Date.now()}`,
        ownerId: user?.uid || 'local-user',
        weekLabel: data.weekLabel || weekLabel,
        startDate: data.startDate || startDate,
        dietType: genDiet,
        targetCalories: genCalories,
        householdSize: genHousehold,
        estimatedWeeklyCostDkk: data.estimatedWeeklyCostDkk || genBudget,
        days: data.days,
        mealPrepTips: data.mealPrepTips || [],
        createdAtIso: new Date().toISOString(),
      };

      await saveMealPlan(newPlan, true);
      setSelectedDayIdx(0);
      setShowGenerator(false);
      setStatusMessage('Ny 7-dages madplan og automatisk indkøbsliste er klar.');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Kunne ikke generere madplan.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleEaten = async (mealId: string) => {
    if (!activeMealPlan || !currentDay) return;
    const nextDays = activeMealPlan.days.map((d, idx) =>
      idx === selectedDayIdx
        ? {
            ...d,
            meals: d.meals.map((m) => (m.id === mealId ? { ...m, eaten: !m.eaten } : m)),
          }
        : d
    );
    await updateMealPlan({ ...activeMealPlan, days: nextDays });
  };

  const handleSwapMeal = async (meal: PlannedMeal) => {
    if (!activeMealPlan || !currentDay) return;
    setSwappingMealId(meal.id);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/meal-plan/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dietType: activeMealPlan.dietType,
          slot: meal.slot,
          targetMealCalories: meal.calories,
          householdSize: activeMealPlan.householdSize,
          currentTitle: meal.title,
        }),
      });
      const replacement = await res.json();
      if (!res.ok) throw new Error(replacement.error || 'Kunne ikke skifte ret.');

      const nextDays = activeMealPlan.days.map((d, idx) =>
        idx === selectedDayIdx
          ? {
              ...d,
              meals: d.meals.map((m) => (m.id === meal.id ? replacement : m)),
            }
          : d
      );
      await updateMealPlan({ ...activeMealPlan, days: nextDays });
      setStatusMessage(`Udskiftede måltidet med "${replacement.title}".`);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Fejl ved udskiftning af ret.');
    } finally {
      setSwappingMealId(null);
    }
  };

  const handleSaveMealToRecipes = async (meal: PlannedMeal) => {
    await saveRecipe({
      id: `rec-${Date.now()}`,
      title: meal.title,
      description: meal.description,
      imageUrl: pickFallbackImage(meal),
      dietType: activeMealPlan?.dietType || profile.dietType,
      mealType: meal.slot,
      prepMinutes: meal.prepMinutes,
      servings: activeMealPlan?.householdSize || profile.householdSize,
      estimatedCostDkk: meal.estimatedCostDkk,
      calories: meal.calories,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat,
      fiber: meal.fiber,
      ingredients: meal.ingredients.map((i) => `${i.amount} ${i.name}`.trim()),
      steps: meal.steps,
      tags: [activeMealPlan?.dietType || profile.dietType, 'madplan'],
      isFavorite: true,
    });
    setStatusMessage(`"${meal.title}" er gemt i din opskriftsdatabase.`);
  };

  const handleApplyCalorieCalc = async () => {
    setGenCalories(computedTarget.tdee);
    await updateProfile({
      dailyCalories: computedTarget.tdee,
      proteinTarget: computedTarget.protein,
      carbsTarget: computedTarget.carbs,
      fatTarget: computedTarget.fat,
    });
    setShowCalorieCalc(false);
    setStatusMessage(`Nyt kalorie- og makromål gemt: ${computedTarget.tdee} kcal / ${computedTarget.protein} g protein.`);
  };

  return (
    <div className="space-y-6">
      {/* Header Action Strip */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{activeMealPlan?.weekLabel || 'Ugeplan'}</span>
            <span aria-hidden="true">·</span>
            <span>{DIET_LABELS[activeMealPlan?.dietType || profile.dietType]}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{profile.householdSize} pers.</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
            Ugens Madplan & Næring
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowCalorieCalc(true)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            <Calculator className="w-4 h-4 text-teal-700" />
            <span>Kalorieberegner</span>
          </button>

          {activeMealPlan && (
            <button
              onClick={() => {
                downloadWeeklyPlanIcs(activeMealPlan, profile.mealTimes);
                setStatusMessage('Kalenderfil (.ics) med 30 min påmindelser er downloadet.');
              }}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Calendar className="w-4 h-4 text-teal-700" />
              <span>Eksportér til kalender (.ics)</span>
            </button>
          )}

          <button
            onClick={() => {
              setGenDiet(profile.dietType);
              setGenCalories(profile.dailyCalories);
              setGenHousehold(profile.householdSize);
              setGenBudget(profile.weeklyMealBudgetDkk);
              setShowGenerator(true);
            }}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0"
          >
            <ChefHat className="w-4 h-4" />
            <span>Generér 1 uge med Gemini</span>
          </button>
        </div>
      </div>

      {/* Feedback banners */}
      {statusMessage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-900">
          <span>{statusMessage}</span>
          <button onClick={() => setStatusMessage(null)} className="p-1 text-teal-700 hover:text-teal-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="p-1 text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Quick Diet Switch & Plan History Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/80">
        <div className="flex items-center gap-1 overflow-x-auto pb-2 sm:pb-0">
          {(['vegetarisk', 'almindelig', 'vegansk', 'pesketarisk', 'lowcarb'] as DietType[]).map((dt) => (
            <button
              key={dt}
              onClick={() => {
                updateProfile({ dietType: dt });
                setGenDiet(dt);
              }}
              className={`min-h-[40px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                profile.dietType === dt
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              }`}
            >
              {DIET_LABELS[dt]}
            </button>
          ))}
        </div>

        {mealPlans.length > 1 && (
          <select
            aria-label="Vælg gemt ugeplan"
            value={activeMealPlan?.id || ''}
            onChange={(e) => setActivePlanId(e.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
          >
            {mealPlans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.weekLabel} ({p.startDate})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* 4-column Nutrition & Weekly Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="rounded-2xl bg-white border border-slate-200/80 p-4">
          <p className="text-xs text-slate-500">Dagens energi / Mål</p>
          <p className="mt-1.5 text-xl md:text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {dayTotals.calories} <span className="text-sm font-normal text-slate-400">/ {profile.dailyCalories} kcal</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Spist i dag: {dayTotals.eatenKcal} kcal
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/80 p-4">
          <p className="text-xs text-slate-500">Protein & Kostfibre</p>
          <p className="mt-1.5 text-xl md:text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {dayTotals.protein} g <span className="text-sm font-normal text-slate-400">protein</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Mål {profile.proteinTarget} g · Fibre {dayTotals.fiber} g
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/80 p-4">
          <p className="text-xs text-slate-500">Kulhydrat & Fedt</p>
          <p className="mt-1.5 text-xl md:text-2xl font-semibold font-mono tabular-nums text-slate-900">
            {dayTotals.carbs} g <span className="text-sm font-normal text-slate-400">/ {dayTotals.fat} g</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Mål {profile.carbsTarget} g KH · {profile.fatTarget} g fedt
          </p>
        </div>

        <div className="rounded-2xl bg-white border border-slate-200/80 p-4">
          <p className="text-xs text-slate-500">Estimeret ugepris</p>
          <p className="mt-1.5 text-xl md:text-2xl font-semibold font-mono tabular-nums text-teal-800">
            {activeMealPlan?.estimatedWeeklyCostDkk ?? 0} kr.
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Ugebudget: {profile.weeklyMealBudgetDkk} kr.
          </p>
        </div>
      </div>

      {/* Horizontal 7-day selector */}
      {activeMealPlan && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {activeMealPlan.days.map((day, idx) => {
            const active = idx === selectedDayIdx;
            const totalKcal = day.meals.reduce((s, m) => s + m.calories, 0);
            return (
              <button
                key={day.dateIso + idx}
                onClick={() => setSelectedDayIdx(idx)}
                className={`min-h-[56px] min-w-[92px] flex-1 flex flex-col items-center justify-center rounded-xl border px-3 py-2 transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-teal-700 border-teal-700 text-white'
                    : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300'
                }`}
              >
                <span className="text-xs font-semibold">{day.dayName}</span>
                <span
                  className={`text-[11px] font-mono tabular-nums mt-0.5 ${
                    active ? 'text-teal-100' : 'text-slate-500'
                  }`}
                >
                  {totalKcal} kcal
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Split: Selected Day Meals (Left 8 cols) + Nutrition Analytics & Meal Prep (Right 4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {currentDay?.meals.map((meal) => {
            const expanded = expandedMealId === meal.id;
            const isSwapping = swappingMealId === meal.id;
            const gcalUrl = buildGoogleCalendarUrl(currentDay.dateIso, meal, profile.mealTimes);

            return (
              <article
                key={meal.id}
                className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12">
                  <div className="sm:col-span-4 relative">
                    <RecipeImage
                      src={pickFallbackImage(meal)}
                      alt={meal.title}
                      className="w-full h-44 sm:h-full object-cover"
                    />
                  </div>

                  <div className="sm:col-span-8 p-5 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-teal-800">
                            {MEAL_SLOT_LABELS[meal.slot]}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">kl. {profile.mealTimes[meal.slot]}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                            <Clock className="w-3.5 h-3.5" />
                            {meal.prepMinutes} min
                          </span>
                        </div>
                        <span className="font-mono tabular-nums font-medium text-slate-700">
                          ~{meal.estimatedCostDkk} kr.
                        </span>
                      </div>

                      <h3 className="text-lg font-semibold text-slate-900 leading-snug">
                        {meal.title}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {meal.description}
                      </p>

                      {/* Clean unboxed nutrition metadata row */}
                      <div className="pt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono tabular-nums text-slate-600">
                        <strong className="text-slate-900">{meal.calories} kcal</strong>
                        <span aria-hidden="true" className="text-slate-300">/</span>
                        <span>Protein {meal.protein}g</span>
                        <span aria-hidden="true" className="text-slate-300">/</span>
                        <span>Kulh. {meal.carbs}g</span>
                        <span aria-hidden="true" className="text-slate-300">/</span>
                        <span>Fedt {meal.fat}g</span>
                        <span aria-hidden="true" className="text-slate-300">/</span>
                        <span>Fibre {meal.fiber}g</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Næringsfokus: {meal.micronutrients}
                      </p>
                    </div>

                    {/* Action row */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => handleToggleEaten(meal.id)}
                        className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          meal.eaten
                            ? 'bg-emerald-700 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{meal.eaten ? 'Spist' : 'Marker spist'}</span>
                      </button>

                      <button
                        onClick={() => setExpandedMealId(expanded ? null : meal.id)}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <span>{expanded ? 'Skjul opskrift' : 'Se ingredienser & trin'}</span>
                      </button>

                      <button
                        onClick={() => handleSwapMeal(meal)}
                        disabled={isSwapping}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        {isSwapping ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        <span>Skift ret</span>
                      </button>

                      <button
                        onClick={() => handleSaveMealToRecipes(meal)}
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        <span>Gem opskrift</span>
                      </button>

                      <a
                        href={gcalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-50 whitespace-nowrap shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Google Kalender</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Expandable recipe steps & ingredients */}
                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 mb-2">Ingredienser</h4>
                      {meal.ingredients.length > 0 ? (
                        <ul className="space-y-1.5 text-sm text-slate-700">
                          {meal.ingredients.map((ing, i) => (
                            <li key={i} className="flex items-center justify-between gap-2">
                              <span>
                                {ing.amount} {ing.name}
                              </span>
                              <span className="text-xs text-slate-400 font-mono tabular-nums">
                                ~{ing.estimatedPriceDkk} kr.
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-slate-500">Basisvarer fra ugens fælles indkøbsliste.</p>
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-900 mb-2">Fremgangsmåde</h4>
                      <ol className="space-y-1.5 text-sm text-slate-700 list-decimal pl-4">
                        {meal.steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* Right Column: Visual Nutrient Charts & Meal Prep */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Macro Distribution Chart */}
          <div className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Næringsstoffordeling</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {currentDay?.dayName}s makronæringsstoffer i gram
              </p>
            </div>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={macroPieData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {macroPieData.map((entry, idx) => (
                      <Cell key={entry.name} fill={MACRO_COLORS[idx % MACRO_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
              <div>
                <p className="text-xs text-slate-500">Protein</p>
                <p className="text-sm font-semibold font-mono tabular-nums text-teal-800">
                  {dayTotals.protein} g
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Kulhydrat</p>
                <p className="text-sm font-semibold font-mono tabular-nums text-sky-700">
                  {dayTotals.carbs} g
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Fedt</p>
                <p className="text-sm font-semibold font-mono tabular-nums text-amber-700">
                  {dayTotals.fat} g
                </p>
              </div>
            </div>
          </div>

          {/* 7-Day Calorie Curve */}
          <div className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Ugens kalorier pr. dag</h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                Mål: {profile.dailyCalories} kcal/dag
              </p>
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyChartData} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="kcal" fill="#0F766E" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Smart Meal-Prep & Auto Shopping Sync */}
          <div className="rounded-2xl bg-white border border-slate-200/80 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Leaf className="w-4 h-4 text-teal-700 shrink-0" />
              <h2 className="text-base font-semibold text-slate-900">Smarte meal-prep tips</h2>
            </div>
            <ul className="space-y-2.5 text-sm text-slate-600">
              {(activeMealPlan?.mealPrepTips || []).map((tip, idx) => (
                <li key={idx} className="leading-relaxed pb-2.5 border-b border-slate-100 last:border-0 last:pb-0">
                  {tip}
                </li>
              ))}
            </ul>
            <button
              onClick={async () => {
                if (activeMealPlan) {
                  await rebuildShoppingListFromPlan(activeMealPlan);
                  onNavigateToShopping();
                }
              }}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Synkronisér indkøbsliste</span>
            </button>
          </div>
        </aside>
      </div>

      {/* Gemini 1-Week Meal Plan Generator Modal */}
      {showGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleGeneratePlan}
            className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 p-6 space-y-5 my-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Generér ny 7-dages madplan
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Gratis AI-planlægning med automatisk indkøbsliste og næringsberegning.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerator(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">Kosttype</span>
                <select
                  value={genDiet}
                  onChange={(e) => setGenDiet(e.target.value as DietType)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900"
                >
                  {(Object.keys(DIET_LABELS) as DietType[]).map((k) => (
                    <option key={k} value={k}>
                      {DIET_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">Dagligt kaloriebudget (kcal)</span>
                <input
                  type="number"
                  min={1200}
                  max={4500}
                  step={50}
                  value={genCalories}
                  onChange={(e) => setGenCalories(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums text-slate-900"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">Antal personer</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={genHousehold}
                  onChange={(e) => setGenHousehold(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums text-slate-900"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">Ugentligt madbudget (DKK)</span>
                <input
                  type="number"
                  min={200}
                  max={6000}
                  step={50}
                  value={genBudget}
                  onChange={(e) => setGenBudget(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums text-slate-900"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">Maks tilberedningstid (min)</span>
                <input
                  type="number"
                  min={15}
                  max={90}
                  step={5}
                  value={genMaxPrep}
                  onChange={(e) => setGenMaxPrep(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums text-slate-900"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-700">Allergier / fravalg (komma)</span>
                <input
                  type="text"
                  placeholder="fx nødder, koriander, laktose"
                  value={genAllergies}
                  onChange={(e) => setGenAllergies(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
                />
              </label>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-700">
                Køleskabs-tømmer (valgfrit — undgå madspild)
              </span>
              <input
                type="text"
                placeholder="fx et halvt blomkål, 3 gulerødder, en rest feta..."
                value={genFridge}
                onChange={(e) => setGenFridge(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm text-slate-900"
              />
            </label>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGenerator(false)}
                className="min-h-[44px] rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Annuller
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Genererer 7 dages plan...</span>
                  </>
                ) : (
                  <>
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Skab madplan</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Calorie & Macro Calculator Modal */}
      {showCalorieCalc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 space-y-5 my-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Personlig kalorieberegner</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Beregner dit daglige energi- og proteinbehov (Mifflin-St Jeor).
                </p>
              </div>
              <button
                onClick={() => setShowCalorieCalc(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Køn</span>
                <select
                  value={calcGender}
                  onChange={(e) => setCalcGender(e.target.value as 'female' | 'male')}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="female">Kvinde</option>
                  <option value="male">Mand</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Alder (år)</span>
                <input
                  type="number"
                  min={16}
                  max={95}
                  value={calcAge}
                  onChange={(e) => setCalcAge(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Vægt (kg)</span>
                <input
                  type="number"
                  min={40}
                  max={200}
                  value={calcWeight}
                  onChange={(e) => setCalcWeight(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Højde (cm)</span>
                <input
                  type="number"
                  min={130}
                  max={220}
                  value={calcHeight}
                  onChange={(e) => setCalcHeight(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Aktivitetsniveau</span>
                <select
                  value={calcActivity}
                  onChange={(e) => setCalcActivity(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value={1.2}>Stillesiddende (kontor)</option>
                  <option value={1.375}>Let aktiv (1–2x/uge)</option>
                  <option value={1.55}>Moderat aktiv (3–4x/uge)</option>
                  <option value={1.725}>Meget aktiv (5–6x/uge)</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700">Mål</span>
                <select
                  value={calcGoal}
                  onChange={(e) => setCalcGoal(e.target.value as 'lose' | 'maintain' | 'gain')}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="lose">Vægttab (-350 kcal)</option>
                  <option value="maintain">Vedligehold vægt</option>
                  <option value="gain">Muskelopbygning (+300 kcal)</option>
                </select>
              </label>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-4 grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[11px] text-slate-500">Kalorier</p>
                <p className="text-base font-semibold font-mono tabular-nums text-teal-800">{computedTarget.tdee}</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Protein</p>
                <p className="text-base font-semibold font-mono tabular-nums text-slate-900">{computedTarget.protein}g</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Kulhydrat</p>
                <p className="text-base font-semibold font-mono tabular-nums text-slate-900">{computedTarget.carbs}g</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Fedt</p>
                <p className="text-base font-semibold font-mono tabular-nums text-slate-900">{computedTarget.fat}g</p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCalorieCalc(false)}
                className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700"
              >
                Luk
              </button>
              <button
                onClick={handleApplyCalorieCalc}
                className="min-h-[44px] rounded-xl bg-teal-700 px-5 text-sm font-medium text-white hover:bg-teal-800"
              >
                Brug som mit mål
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
