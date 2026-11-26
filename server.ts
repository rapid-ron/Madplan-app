import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MODEL_FREE = 'gemini-4-hydrogen';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY er ikke konfigureret på serveren. Kontrollér Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const VALID_CATEGORIES = [
  'Frugt & Grønt',
  'Mejeri & Æg',
  'Kød & Fisk',
  'Plantebaseret',
  'Kolonial',
  'Brød & Bageri',
  'Drikkevarer',
  'Frost',
  'Husholdning',
  'Snacks & Sødt',
];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // 1. Generate 7-day Danish meal plan using free-tier Gemini 4 Flash (gemini-4-hydrogen)
  app.post('/api/meal-plan/generate', async (req, res) => {
    try {
      const {
        dietType = 'vegetarisk',
        dailyCalories = 2100,
        proteinTarget = 105,
        householdSize = 2,
        weeklyBudgetDkk = 750,
        allergies = [],
        maxPrepMinutes = 35,
        fridgeIngredients = '',
        startDate = new Date().toISOString().slice(0, 10),
        weekLabel = 'Ugeplan',
      } = req.body ?? {};

      const ai = getAiClient();

      const prompt = `Lav en komplet, realistisk og varieret dansk 7-dages madplan (Mandag til Søndag) med 3 måltider om dagen (breakfast, lunch, dinner).
Krav fra brugeren:
- Kosttype: ${dietType} (hvis vegetarisk: INGEN kød eller fisk; hvis vegansk: INGEN animalske produkter; hvis glutenfri: INGEN gluten).
- Dagligt kaloriebudget pr. person: ca. ${dailyCalories} kcal (summen af dagens 3 måltider skal ramme tæt på ${dailyCalories} kcal).
- Dagligt proteinmål pr. person: ca. ${proteinTarget} g.
- Husstandsstørrelse: ${householdSize} personer (angiv ingrediensmængder til ${householdSize} personer og realistiske danske supermarkedspriser i DKK).
- Ugentligt madbudget: ca. ${weeklyBudgetDkk} kr.
- Allergier / fravalg: ${Array.isArray(allergies) && allergies.length > 0 ? allergies.join(', ') : 'Ingen'}.
- Maks tilberedningstid i hverdagen: ca. ${maxPrepMinutes} minutter.
- Rester i køleskabet der gerne må bruges (madspilds-reduktion): ${fridgeIngredients || 'Ingen angivet'}.

Skriv alt på naturligt dansk. Brug kun disse kategorier til ingredienser: ${VALID_CATEGORIES.join(', ')}.
Returnér KUN valid JSON der matcher schemaet.`;

      const mealSchema = {
        type: Type.OBJECT,
        properties: {
          slot: { type: Type.STRING, description: 'breakfast, lunch, eller dinner' },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          prepMinutes: { type: Type.INTEGER },
          estimatedCostDkk: { type: Type.INTEGER },
          calories: { type: Type.INTEGER },
          protein: { type: Type.INTEGER },
          carbs: { type: Type.INTEGER },
          fat: { type: Type.INTEGER },
          fiber: { type: Type.INTEGER },
          micronutrients: { type: Type.STRING, description: 'Kort oversigt over vigtige vitaminer/mineraler i retten' },
          ingredients: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                amount: { type: Type.STRING },
                category: { type: Type.STRING },
                estimatedPriceDkk: { type: Type.INTEGER },
              },
              required: ['name', 'amount', 'category', 'estimatedPriceDkk'],
            },
          },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          'slot',
          'title',
          'description',
          'prepMinutes',
          'estimatedCostDkk',
          'calories',
          'protein',
          'carbs',
          'fat',
          'fiber',
          'micronutrients',
          'ingredients',
          'steps',
        ],
      };

      const response = await ai.models.generateContent({
        model: MODEL_FREE,
        contents: prompt,
        config: {
          systemInstruction:
            'Du er en dansk autoriseret klinisk diætist og hverdags-kok. Du laver budgetvenlige, velsmagende, næringsberegnede 7-dages madplaner til danske supermarkeder (Rema 1000, Netto, Føtex, Coop).',
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              estimatedWeeklyCostDkk: { type: Type.INTEGER },
              mealPrepTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              days: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    dayIndex: { type: Type.INTEGER },
                    dayName: { type: Type.STRING },
                    meals: {
                      type: Type.ARRAY,
                      items: mealSchema,
                    },
                  },
                  required: ['dayIndex', 'dayName', 'meals'],
                },
              },
            },
            required: ['estimatedWeeklyCostDkk', 'mealPrepTips', 'days'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const dayNames = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
      const baseDate = new Date(`${startDate}T12:00:00Z`);

      const normalizedDays = (parsed.days ?? []).slice(0, 7).map((d: any, idx: number) => {
        const dt = new Date(baseDate);
        dt.setUTCDate(dt.getUTCDate() + idx);
        const dateIso = dt.toISOString().slice(0, 10);
        return {
          dayIndex: idx,
          dayName: d.dayName || dayNames[idx],
          dateIso,
          meals: (d.meals ?? []).slice(0, 3).map((m: any, mIdx: number) => ({
            id: `ai-${Date.now()}-${idx}-${mIdx}`,
            slot: m.slot === 'breakfast' || m.slot === 'lunch' || m.slot === 'dinner'
              ? m.slot
              : mIdx === 0 ? 'breakfast' : mIdx === 1 ? 'lunch' : 'dinner',
            title: String(m.title ?? 'Dagens ret').slice(0, 130),
            description: String(m.description ?? '').slice(0, 300),
            prepMinutes: Math.max(5, Math.min(180, Number(m.prepMinutes) || 25)),
            estimatedCostDkk: Math.max(10, Number(m.estimatedCostDkk) || 45),
            calories: Math.max(150, Number(m.calories) || 550),
            protein: Math.max(5, Number(m.protein) || 25),
            carbs: Math.max(0, Number(m.carbs) || 55),
            fat: Math.max(2, Number(m.fat) || 18),
            fiber: Math.max(0, Number(m.fiber) || 8),
            micronutrients: String(m.micronutrients ?? 'Vitaminer og mineraler').slice(0, 120),
            ingredients: (Array.isArray(m.ingredients) ? m.ingredients : []).slice(0, 14).map((ing: any) => ({
              name: String(ing.name ?? 'Ingrediens').slice(0, 100),
              amount: String(ing.amount ?? '1 stk').slice(0, 50),
              category: VALID_CATEGORIES.includes(ing.category) ? ing.category : 'Kolonial',
              estimatedPriceDkk: Math.max(1, Number(ing.estimatedPriceDkk) || 15),
            })),
            steps: (Array.isArray(m.steps) ? m.steps : []).slice(0, 8).map((s: any) => String(s).slice(0, 140)),
            eaten: false,
          })),
        };
      });

      res.json({
        weekLabel,
        startDate,
        dietType,
        targetCalories: dailyCalories,
        householdSize,
        estimatedWeeklyCostDkk: Number(parsed.estimatedWeeklyCostDkk) || weeklyBudgetDkk,
        mealPrepTips: (Array.isArray(parsed.mealPrepTips) ? parsed.mealPrepTips : []).slice(0, 5).map((t: any) => String(t).slice(0, 140)),
        days: normalizedDays,
      });
    } catch (error: any) {
      console.error('Meal plan generation error:', error);
      res.status(500).json({
        error: error?.message || 'Kunne ikke generere madplan med Gemini. Prøv igen.',
      });
    }
  });

  // 2. Swap a single meal with Gemini
  app.post('/api/meal-plan/swap', async (req, res) => {
    try {
      const {
        dietType = 'vegetarisk',
        slot = 'dinner',
        targetMealCalories = 650,
        householdSize = 2,
        currentTitle = '',
        preferenceNote = '',
      } = req.body ?? {};

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_FREE,
        contents: `Foreslå én ny dansk ret til måltidet "${slot}" som erstatning for "${currentTitle}".
Kosttype: ${dietType}. Ca. ${targetMealCalories} kcal pr. person. Husstand: ${householdSize} personer.
Ekstra ønske: ${preferenceNote || 'Noget velsmagende, nemt og budgetvenligt'}.
Brug kun disse ingredienskategorier: ${VALID_CATEGORIES.join(', ')}.`,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              prepMinutes: { type: Type.INTEGER },
              estimatedCostDkk: { type: Type.INTEGER },
              calories: { type: Type.INTEGER },
              protein: { type: Type.INTEGER },
              carbs: { type: Type.INTEGER },
              fat: { type: Type.INTEGER },
              fiber: { type: Type.INTEGER },
              micronutrients: { type: Type.STRING },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    amount: { type: Type.STRING },
                    category: { type: Type.STRING },
                    estimatedPriceDkk: { type: Type.INTEGER },
                  },
                  required: ['name', 'amount', 'category', 'estimatedPriceDkk'],
                },
              },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['title', 'description', 'prepMinutes', 'estimatedCostDkk', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'micronutrients', 'ingredients', 'steps'],
          },
        },
      });

      const m = JSON.parse((response.text ?? '{}').trim());
      res.json({
        id: `swap-${Date.now()}`,
        slot,
        title: String(m.title ?? 'Ny ret').slice(0, 130),
        description: String(m.description ?? '').slice(0, 300),
        prepMinutes: Math.max(5, Number(m.prepMinutes) || 25),
        estimatedCostDkk: Math.max(10, Number(m.estimatedCostDkk) || 48),
        calories: Math.max(150, Number(m.calories) || targetMealCalories),
        protein: Math.max(5, Number(m.protein) || 25),
        carbs: Math.max(0, Number(m.carbs) || 55),
        fat: Math.max(2, Number(m.fat) || 18),
        fiber: Math.max(0, Number(m.fiber) || 8),
        micronutrients: String(m.micronutrients ?? 'Vitaminer og mineraler').slice(0, 120),
        ingredients: (Array.isArray(m.ingredients) ? m.ingredients : []).slice(0, 14).map((ing: any) => ({
          name: String(ing.name ?? 'Ingrediens').slice(0, 100),
          amount: String(ing.amount ?? '1 stk').slice(0, 50),
          category: VALID_CATEGORIES.includes(ing.category) ? ing.category : 'Kolonial',
          estimatedPriceDkk: Math.max(1, Number(ing.estimatedPriceDkk) || 15),
        })),
        steps: (Array.isArray(m.steps) ? m.steps : []).slice(0, 8).map((s: any) => String(s).slice(0, 140)),
        eaten: false,
      });
    } catch (error: any) {
      console.error('Meal swap error:', error);
      res.status(500).json({ error: error?.message || 'Kunne ikke udskifte måltidet.' });
    }
  });

  // 3. Receipt Scanner (Vision + Auto-Categorization) with Gemini
  app.post('/api/receipt/scan', async (req, res) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', receiptText = '' } = req.body ?? {};
      if (!imageBase64 && !receiptText) {
        res.status(400).json({ error: 'Upload et billede af kvitteringen eller indsæt kvitteringstekst.' });
        return;
      }

      const ai = getAiClient();
      const instructions = `Analyser denne danske dagligvarekvittering og udtræk alle oplysninger nøjagtigt.
- Udtræk butiksnavn (fx Netto, Rema 1000, Føtex, Bilka, Lidl, Coop 365, Meny, SuperBrugsen).
- Udtræk dato i formatet YYYY-MM-DD (brug dagens dato ${new Date().toISOString().slice(0, 10)} hvis datoen ikke er læsbar).
- Udtræk totalbeløb i DKK som tal.
- Udtræk hver varelinje med navn, mængde, pris i DKK og AUTOMATISK kategori.
- Tilladte kategorier: ${VALID_CATEGORIES.join(', ')}.
- Vælg den primære kategori (den kategori med højest beløb) og foreslå 2-4 relevante danske tags (fx økologisk, tilbud, hverdag, madpakke, gæster).`;

      const parts: any[] = [];
      if (imageBase64) {
        const cleanBase64 = String(imageBase64).replace(/^data:[^;]+;base64,/, '');
        parts.push({
          inlineData: {
            mimeType: String(mimeType),
            data: cleanBase64,
          },
        });
      }
      parts.push({
        text: receiptText ? `${instructions}\n\nKvitteringstekst:\n${receiptText}` : instructions,
      });

      const response = await ai.models.generateContent({
        model: MODEL_FREE,
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              storeName: { type: Type.STRING },
              purchaseDate: { type: Type.STRING },
              totalDkk: { type: Type.NUMBER },
              primaryCategory: { type: Type.STRING },
              suggestedTags: { type: Type.ARRAY, items: { type: Type.STRING } },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    quantity: { type: Type.STRING },
                    priceDkk: { type: Type.NUMBER },
                    category: { type: Type.STRING },
                  },
                  required: ['name', 'quantity', 'priceDkk', 'category'],
                },
              },
            },
            required: ['storeName', 'purchaseDate', 'totalDkk', 'primaryCategory', 'suggestedTags', 'items'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.purchaseDate))
        ? String(parsed.purchaseDate)
        : new Date().toISOString().slice(0, 10);

      const items = (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 55).map((item: any) => ({
        name: String(item.name ?? 'Dagligvare').slice(0, 100),
        quantity: String(item.quantity ?? '1 stk').slice(0, 40),
        priceDkk: Math.max(0, Math.round((Number(item.priceDkk) || 0) * 100) / 100),
        category: VALID_CATEGORIES.includes(item.category) ? item.category : 'Kolonial',
      }));

      const computedTotal = items.reduce((sum: number, i: any) => sum + i.priceDkk, 0);
      const totalDkk = Number(parsed.totalDkk) > 0 ? Math.round(Number(parsed.totalDkk) * 100) / 100 : Math.round(computedTotal * 100) / 100;

      res.json({
        storeName: String(parsed.storeName || 'Supermarked').slice(0, 95),
        purchaseDate: dateStr,
        totalDkk,
        primaryCategory: VALID_CATEGORIES.includes(parsed.primaryCategory) ? parsed.primaryCategory : (items[0]?.category || 'Kolonial'),
        tags: (Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : ['hverdag']).slice(0, 8).map((t: any) => String(t).toLowerCase().replace(/^#/, '').slice(0, 40)),
        items,
      });
    } catch (error: any) {
      console.error('Receipt scan error:', error);
      res.status(500).json({ error: error?.message || 'Kunne ikke aflæse kvitteringen. Prøv et tydeligere billede.' });
    }
  });

  // 4. Auto-categorize grocery item(s)
  app.post('/api/grocery/categorize', async (req, res) => {
    try {
      const { items = [] } = req.body ?? {};
      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Ingen varer angivet.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_FREE,
        contents: `Kategorisér følgende danske dagligvarer og estimér en realistisk pris i DKK: ${items.join(', ')}.
Brug kun disse kategorier: ${VALID_CATEGORIES.join(', ')}.`,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                category: { type: Type.STRING },
                estimatedPriceDkk: { type: Type.INTEGER },
              },
              required: ['name', 'category', 'estimatedPriceDkk'],
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '[]').trim());
      res.json({
        categorized: parsed.map((row: any) => ({
          name: String(row.name ?? '').slice(0, 100),
          category: VALID_CATEGORIES.includes(row.category) ? row.category : 'Kolonial',
          estimatedPriceDkk: Math.max(5, Number(row.estimatedPriceDkk) || 20),
        })),
      });
    } catch (error: any) {
      console.error('Categorize error:', error);
      res.status(500).json({ error: error?.message || 'Kunne ikke kategorisere varer.' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MadPlan Nord server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
