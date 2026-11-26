import React, { useMemo, useState } from 'react';
import {
  CalendarPlus,
  Clock,
  Heart,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import {
  DIET_LABELS,
  DietType,
  MEAL_SLOT_LABELS,
  MealSlot,
  Recipe,
} from '../types';
import { RECIPE_IMAGES } from '../data/seedData';
import { RecipeImage } from './PWAComponents';

export const RecipesView: React.FC = () => {
  const {
    recipes,
    activeMealPlan,
    saveRecipe,
    toggleRecipeFavorite,
    deleteRecipe,
    updateMealPlan,
  } = useAppData();

  const [search, setSearch] = useState('');
  const [dietFilter, setDietFilter] = useState<'alle' | 'favoritter' | DietType>('alle');
  const [tagFilter, setTagFilter] = useState<string>('alle');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [assignDayIdx, setAssignDayIdx] = useState(0);
  const [assignSlot, setAssignSlot] = useState<MealSlot>('dinner');
  const [toast, setToast] = useState<string | null>(null);

  // Add Recipe Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dietType, setDietType] = useState<DietType>('vegetarisk');
  const [mealType, setMealType] = useState<MealSlot>('dinner');
  const [prepMinutes, setPrepMinutes] = useState(25);
  const [calories, setCalories] = useState(580);
  const [protein, setProtein] = useState(28);
  const [carbs, setCarbs] = useState(64);
  const [fat, setFat] = useState(20);
  const [fiber, setFiber] = useState(10);
  const [costDkk, setCostDkk] = useState(55);
  const [imageUrl, setImageUrl] = useState<string>(RECIPE_IMAGES.curry);
  const [ingredientsText, setIngredientsText] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [tagsText, setTagsText] = useState('vegetarisk, hverdag');

  const allTags = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => r.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => {
      if (dietFilter === 'favoritter' && !r.isFavorite) return false;
      if (dietFilter !== 'alle' && dietFilter !== 'favoritter' && r.dietType !== dietFilter) {
        return false;
      }
      if (tagFilter !== 'alle' && !r.tags.includes(tagFilter)) return false;
      if (
        q &&
        !r.title.toLowerCase().includes(q) &&
        !r.description.toLowerCase().includes(q) &&
        !r.tags.some((t) => t.toLowerCase().includes(q)) &&
        !r.ingredients.some((i) => i.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });
  }, [recipes, search, dietFilter, tagFilter]);

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await saveRecipe({
      id: `rec-${Date.now()}`,
      title: title.trim(),
      description: description.trim() || 'Hjemmelavet opskrift',
      imageUrl,
      dietType,
      mealType,
      prepMinutes,
      servings: 2,
      estimatedCostDkk: costDkk,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      ingredients: ingredientsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      steps: stepsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      tags: tagsText
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      isFavorite: false,
    });
    setTitle('');
    setDescription('');
    setIngredientsText('');
    setStepsText('');
    setShowAddForm(false);
    setToast('Opskriften er gemt i din opskriftsdatabase.');
  };

  const handleInsertIntoMealPlan = async (rec: Recipe) => {
    if (!activeMealPlan) return;
    const nextDays = activeMealPlan.days.map((d, idx) => {
      if (idx !== assignDayIdx) return d;
      const newMeal = {
        id: `from-rec-${Date.now()}`,
        slot: assignSlot,
        title: rec.title,
        description: rec.description,
        prepMinutes: rec.prepMinutes,
        estimatedCostDkk: rec.estimatedCostDkk,
        calories: rec.calories,
        protein: rec.protein,
        carbs: rec.carbs,
        fat: rec.fat,
        fiber: rec.fiber,
        micronutrients: `Fra opskriftsdatabase (${DIET_LABELS[rec.dietType]})`,
        imageUrl: rec.imageUrl,
        ingredients: rec.ingredients.map((line) => ({
          name: line,
          amount: '1 portion',
          category: 'Kolonial' as const,
          estimatedPriceDkk: Math.max(8, Math.round(rec.estimatedCostDkk / Math.max(1, rec.ingredients.length))),
        })),
        steps: rec.steps,
        eaten: false,
      };
      return {
        ...d,
        meals: d.meals.map((m) => (m.slot === assignSlot ? newMeal : m)),
      };
    });

    await updateMealPlan({ ...activeMealPlan, days: nextDays });
    const dayName = activeMealPlan.days[assignDayIdx]?.dayName || 'valgt dag';
    setToast(`"${rec.title}" blev indsat på ${dayName} (${MEAL_SLOT_LABELS[assignSlot]}).`);
    setSelectedRecipe(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500 font-mono tabular-nums">
            {recipes.length} opskrifter med næringsberegning og billeder
          </p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 mt-1">
            Opskriftsdatabase
          </h1>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Ny opskrift</span>
        </button>
      </div>

      {toast && (
        <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-sm text-teal-900">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            placeholder="Søg på titel, ingrediens eller tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          {(['alle', 'favoritter', 'vegetarisk', 'pesketarisk', 'almindelig', 'vegansk'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDietFilter(f)}
              className={`min-h-[44px] px-3.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                dietFilter === f
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {f === 'alle' ? 'Alle' : f === 'favoritter' ? 'Favoritter' : DIET_LABELS[f]}
            </button>
          ))}
        </div>

        <select
          aria-label="Filtrér efter tag"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
        >
          <option value="alle">Alle tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </select>
      </div>

      {/* Recipe Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-white border border-slate-200/80 p-10 text-center space-y-2">
          <p className="text-base font-semibold text-slate-900">Ingen opskrifter matchede din søgning</p>
          <p className="text-sm text-slate-500">Prøv et andet filter eller tilføj din egen favoritopskrift.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((rec) => (
            <article
              key={rec.id}
              className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden flex flex-col justify-between group"
            >
              <div>
                <div className="relative cursor-pointer" onClick={() => setSelectedRecipe(rec)}>
                  <RecipeImage
                    src={rec.imageUrl}
                    alt={rec.title}
                    className="w-full h-48 object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleRecipeFavorite(rec.id);
                    }}
                    aria-label={rec.isFavorite ? 'Fjern fra favoritter' : 'Tilføj til favoritter'}
                    className="absolute top-3 right-3 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-white/90 backdrop-blur-xs text-slate-700 hover:text-rose-600 transition-colors"
                  >
                    <Heart className={`w-4 h-4 ${rec.isFavorite ? 'fill-rose-600 text-rose-600' : ''}`} />
                  </button>
                </div>

                <div className="p-5 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-teal-800">{DIET_LABELS[rec.dietType]}</span>
                    <span aria-hidden="true">·</span>
                    <span>{MEAL_SLOT_LABELS[rec.mealType]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                      <Clock className="w-3.5 h-3.5" />
                      {rec.prepMinutes} min
                    </span>
                  </div>

                  <h3
                    onClick={() => setSelectedRecipe(rec)}
                    className="text-lg font-semibold text-slate-900 leading-snug cursor-pointer hover:text-teal-800 transition-colors"
                  >
                    {rec.title}
                  </h3>
                  <p className="text-sm text-slate-600 line-clamp-2">{rec.description}</p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <div className="text-xs font-mono tabular-nums text-slate-600">
                  <strong className="text-slate-900">{rec.calories} kcal</strong> · {rec.protein}g P · ~{rec.estimatedCostDkk} kr.
                </div>
                <button
                  onClick={() => setSelectedRecipe(rec)}
                  className="text-xs font-semibold text-teal-800 hover:underline whitespace-nowrap shrink-0"
                >
                  Åbn opskrift
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white border border-slate-200 overflow-hidden my-8">
            <div className="relative">
              <RecipeImage
                src={selectedRecipe.imageUrl}
                alt={selectedRecipe.title}
                className="w-full h-60 object-cover"
              />
              <button
                onClick={() => setSelectedRecipe(null)}
                aria-label="Luk opskrift"
                className="absolute top-3 right-3 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-white/90 text-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-medium text-teal-800">{DIET_LABELS[selectedRecipe.dietType]}</span>
                  <span>·</span>
                  <span>{selectedRecipe.prepMinutes} min</span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">{selectedRecipe.servings} portioner</span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">~{selectedRecipe.estimatedCostDkk} kr.</span>
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 mt-1">{selectedRecipe.title}</h2>
                <p className="text-sm text-slate-600 mt-1.5">{selectedRecipe.description}</p>
              </div>

              <div className="grid grid-cols-5 gap-2 rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-center font-mono tabular-nums">
                <div>
                  <p className="text-[11px] text-slate-500 font-sans">Energi</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedRecipe.calories}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-sans">Protein</p>
                  <p className="text-sm font-semibold text-teal-800">{selectedRecipe.protein}g</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-sans">Kulh.</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedRecipe.carbs}g</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-sans">Fedt</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedRecipe.fat}g</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-sans">Fibre</p>
                  <p className="text-sm font-semibold text-slate-900">{selectedRecipe.fiber}g</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Ingredienser</h3>
                  <ul className="space-y-1.5 text-sm text-slate-700 list-disc pl-4">
                    {selectedRecipe.ingredients.map((ing, i) => (
                      <li key={i}>{ing}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">Fremgangsmåde</h3>
                  <ol className="space-y-2 text-sm text-slate-700 list-decimal pl-4">
                    {selectedRecipe.steps.map((st, i) => (
                      <li key={i}>{st}</li>
                    ))}
                  </ol>
                </div>
              </div>

              {/* Insert into active weekly meal plan */}
              {activeMealPlan && (
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <select
                    value={assignDayIdx}
                    onChange={(e) => setAssignDayIdx(Number(e.target.value))}
                    className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  >
                    {activeMealPlan.days.map((d, idx) => (
                      <option key={d.dateIso + idx} value={idx}>
                        {d.dayName} ({d.dateIso})
                      </option>
                    ))}
                  </select>
                  <select
                    value={assignSlot}
                    onChange={(e) => setAssignSlot(e.target.value as MealSlot)}
                    className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="breakfast">Morgenmad</option>
                    <option value="lunch">Frokost</option>
                    <option value="dinner">Aftensmad</option>
                  </select>
                  <button
                    onClick={() => handleInsertIntoMealPlan(selectedRecipe)}
                    className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800"
                  >
                    <CalendarPlus className="w-4 h-4" />
                    <span>Indsæt i ugeplan</span>
                  </button>
                  <button
                    onClick={async () => {
                      await deleteRecipe(selectedRecipe.id);
                      setSelectedRecipe(null);
                    }}
                    aria-label="Slet opskrift"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Recipe Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateRecipe}
            className="w-full max-w-xl rounded-2xl bg-white border border-slate-200 p-6 space-y-4 my-8"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">Tilføj ny opskrift</h2>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="sm:col-span-2 space-y-1">
                <span className="text-xs font-medium text-slate-700">Titel</span>
                <input
                  required
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="fx Bagt græskarsuppe med ristede kerner"
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm"
                />
              </label>

              <label className="sm:col-span-2 space-y-1">
                <span className="text-xs font-medium text-slate-700">Kort beskrivelse</span>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-700">Kosttype</span>
                <select
                  value={dietType}
                  onChange={(e) => setDietType(e.target.value as DietType)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  {(Object.keys(DIET_LABELS) as DietType[]).map((k) => (
                    <option key={k} value={k}>
                      {DIET_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-700">Måltid</span>
                <select
                  value={mealType}
                  onChange={(e) => setMealType(e.target.value as MealSlot)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="breakfast">Morgenmad</option>
                  <option value="lunch">Frokost</option>
                  <option value="dinner">Aftensmad</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-700">Vælg billede</span>
                <select
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value={RECIPE_IMAGES.curry}>Vegetarisk curry</option>
                  <option value={RECIPE_IMAGES.bolognese}>Linsebolognese & pasta</option>
                  <option value={RECIPE_IMAGES.risotto}>Svamperisotto</option>
                  <option value={RECIPE_IMAGES.salmon}>Nordisk laks</option>
                  <option value={RECIPE_IMAGES.chicken}>Kylling & quinoa bowl</option>
                  <option value={RECIPE_IMAGES.oats}>Morgenmadsskål</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-medium text-slate-700">Tid (min) / Pris (kr.)</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={prepMinutes}
                    onChange={(e) => setPrepMinutes(Number(e.target.value))}
                    className="min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums"
                  />
                  <input
                    type="number"
                    value={costDkk}
                    onChange={(e) => setCostDkk(Number(e.target.value))}
                    className="min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm font-mono tabular-nums"
                  />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[
                { label: 'Kcal', val: calories, set: setCalories },
                { label: 'Prot (g)', val: protein, set: setProtein },
                { label: 'Kulh (g)', val: carbs, set: setCarbs },
                { label: 'Fedt (g)', val: fat, set: setFat },
                { label: 'Fibre (g)', val: fiber, set: setFiber },
              ].map((m) => (
                <label key={m.label} className="space-y-1">
                  <span className="text-[11px] font-medium text-slate-600">{m.label}</span>
                  <input
                    type="number"
                    value={m.val}
                    onChange={(e) => m.set(Number(e.target.value))}
                    className="w-full min-h-[40px] rounded-lg border border-slate-200 px-2 text-xs font-mono tabular-nums"
                  />
                </label>
              ))}
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Ingredienser (én pr. linje)</span>
              <textarea
                rows={3}
                value={ingredientsText}
                onChange={(e) => setIngredientsText(e.target.value)}
                placeholder={'400 g hokkaido græskar\n1 løg\n1 dåse kokosmælk'}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Fremgangsmåde (ét trin pr. linje)</span>
              <textarea
                rows={3}
                value={stepsText}
                onChange={(e) => setStepsText(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-medium text-slate-700">Tags (komma-separeret)</span>
              <input
                type="text"
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3 text-sm"
              />
            </label>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="min-h-[44px] rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700"
              >
                Annuller
              </button>
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-teal-700 px-5 text-sm font-medium text-white hover:bg-teal-800"
              >
                Gem opskrift
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
