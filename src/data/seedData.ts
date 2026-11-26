import { MealPlan, Receipt, Recipe, ShoppingItem, UserProfile } from '../types';

export const RECIPE_IMAGES = {
  salmon: '/src/assets/images/recipe_nordic_salmon_1795712775553.jpg',
  curry: '/src/assets/images/recipe_veggie_curry_1795712775686.jpg',
  risotto: '/src/assets/images/recipe_mushroom_risotto_1795712777831.jpg',
  chicken: '/src/assets/images/recipe_chicken_bowl_1795712778026.jpg',
  bolognese: '/src/assets/images/recipe_lentil_bolognese_1795712779937.jpg',
  oats: '/src/assets/images/recipe_oat_bowl_1795712780137.jpg',
} as const;

export function getMondayIso(refDate = new Date()): string {
  const d = new Date(refDate);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getIsoWeekNumber(date = new Date()): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export const DEFAULT_PROFILE: UserProfile = {
  uid: 'local-user',
  displayName: 'Nordisk Husstand',
  email: '',
  dietType: 'vegetarisk',
  dailyCalories: 2100,
  proteinTarget: 110,
  carbsTarget: 245,
  fatTarget: 70,
  householdSize: 2,
  monthlyBudgetDkk: 3800,
  weeklyMealBudgetDkk: 750,
  allergies: [],
  customTags: ['økologisk', 'tilbud', 'hverdag', 'madpakke', 'gæster', 'hurtig'],
  mealTimes: {
    breakfast: '07:30',
    lunch: '12:00',
    dinner: '18:00',
  },
  budgetAlertThreshold: 85,
  notificationsEnabled: true,
};

export const INITIAL_RECIPES: Recipe[] = [
  {
    id: 'rec-nordic-salmon',
    ownerId: 'local-user',
    title: 'Stegt nordisk laks med dildkartofler & asparges',
    description: 'Sprødstegt laksefilet serveret med nye kartofler vendt i frisk dild, grillede grønne asparges og citron-yoghurtdressing.',
    imageUrl: RECIPE_IMAGES.salmon,
    dietType: 'pesketarisk',
    mealType: 'dinner',
    prepMinutes: 25,
    servings: 2,
    estimatedCostDkk: 88,
    calories: 640,
    protein: 44,
    carbs: 46,
    fat: 30,
    fiber: 7,
    ingredients: [
      '300 g laksefilet med skind',
      '400 g små kartofler',
      '1 bundt grønne asparges',
      '150 g græsk yoghurt 2%',
      '1 bundt frisk dild',
      '1 økologisk citron',
      '1 spsk olivenolie',
    ],
    steps: [
      'Kog de små kartofler møre i letsaltet vand i 14 minutter.',
      'Rør græsk yoghurt med finthakket dild, revet citronskal, salt og peber.',
      'Steg laksen på skindsiden i 5 minutter til skindet er sprødt, vend og steg 2 minutter.',
      'Rist asparges på panden i 3 minutter og vend kartoflerne med dild inden servering.',
    ],
    tags: ['højt-protein', 'omega-3', 'hurtig'],
    isFavorite: true,
  },
  {
    id: 'rec-veggie-curry',
    ownerId: 'local-user',
    title: 'Cremet kikærte- & sødkartoffelcurry med spinat',
    description: 'Fyldig vegetarisk kokoscurry med bagt sød kartoffel, kikærter, frisk babyspinat, lime og dampede jasminris.',
    imageUrl: RECIPE_IMAGES.curry,
    dietType: 'vegetarisk',
    mealType: 'dinner',
    prepMinutes: 30,
    servings: 2,
    estimatedCostDkk: 54,
    calories: 615,
    protein: 21,
    carbs: 84,
    fat: 20,
    fiber: 14,
    ingredients: [
      '1 dåse kikærter (240 g drænet)',
      '350 g sød kartoffel i tern',
      '1 dåse let kokosmælk (400 ml)',
      '100 g frisk babyspinat',
      '150 g basmati- eller jasminris',
      '2 spsk rød eller gul karrypasta',
      '1 lime & frisk koriander',
    ],
    steps: [
      'Sæt risene over at koge efter anvisning på pakken.',
      'Svits karrypasta og søde kartofler i en gryde med lidt olie i 3 minutter.',
      'Tilsæt kokosmælk og kikærter, og lad retten simre 18 minutter til kartoflerne er møre.',
      'Vend babyspinat og limesaft i lige før servering og top med frisk koriander.',
    ],
    tags: ['vegetarisk', 'budgetvenlig', 'meal-prep'],
    isFavorite: true,
  },
  {
    id: 'rec-mushroom-risotto',
    ownerId: 'local-user',
    title: 'Svamperisotto med timian, parmesan & hasselnødder',
    description: 'Nordisk cremet risotto med ristede skovsvampe, frisk timian, lagret parmesan og knasende ristede hasselnødder.',
    imageUrl: RECIPE_IMAGES.risotto,
    dietType: 'vegetarisk',
    mealType: 'dinner',
    prepMinutes: 35,
    servings: 2,
    estimatedCostDkk: 62,
    calories: 590,
    protein: 22,
    carbs: 72,
    fat: 22,
    fiber: 6,
    ingredients: [
      '180 g arborio risottoris',
      '300 g blandede svampe (champignon/kantarel)',
      '7 dl varm grøntsagsbouillon',
      '50 g friskrevet parmesan',
      '30 g ristede hasselnødder',
      '1 skalotteløg & 2 fed hvidløg',
      'Frisk timian & citronsaft',
    ],
    steps: [
      'Rist svampene gyldne på en varm pande med timian og sæt til side.',
      'Sauter finthakket skalotteløg og hvidløg, tilsæt risottoris og rør i 2 minutter.',
      'Tilsæt varm bouillon én øse ad gangen under jævnlig omrøring i ca. 20 minutter.',
      'Vend parmesan og svampe i, smag til med citron og top med hakkede hasselnødder.',
    ],
    tags: ['vegetarisk', 'gæster', 'økologisk'],
    isFavorite: false,
  },
  {
    id: 'rec-chicken-bowl',
    ownerId: 'local-user',
    title: 'Nordisk kyllingebowl med quinoa, avocado & rødkål',
    description: 'Proteinrig hverdagsbowl med urtestegt kyllingebryst, varm quinoa, syltet rødkål, bagte gulerødder og tahindressing.',
    imageUrl: RECIPE_IMAGES.chicken,
    dietType: 'almindelig',
    mealType: 'lunch',
    prepMinutes: 25,
    servings: 2,
    estimatedCostDkk: 74,
    calories: 585,
    protein: 46,
    carbs: 48,
    fat: 22,
    fiber: 11,
    ingredients: [
      '280 g kyllingebrystfilet',
      '120 g quinoa',
      '1 moden avocado',
      '150 g fintsnittet rødkål',
      '250 g gulerødder',
      '2 spsk lys tahin + citronsaft',
      '2 spsk græskarkerner',
    ],
    steps: [
      'Skyl quinoa grundigt og kog i 12 minutter i letsaltet vand.',
      'Bag gulerødder i ovn ved 200°C i 18 minutter med lidt honning og timian.',
      'Steg kyllingen med rosmarin, salt og peber til gennemstegt og skær i skiver.',
      'Anret i skåle med rødkål, avocado, græskarkerner og tahindressing.',
    ],
    tags: ['højt-protein', 'madpakke', 'glutenfri'],
    isFavorite: true,
  },
  {
    id: 'rec-lentil-bolognese',
    ownerId: 'local-user',
    title: 'Rød linsebolognese med fuldkornstagliatelle',
    description: 'Klassisk italiensk-inspireret hverdagssauce på røde linser, rodfrugter og hakkede tomater — rig på plantebaseret protein og fibre.',
    imageUrl: RECIPE_IMAGES.bolognese,
    dietType: 'vegetarisk',
    mealType: 'dinner',
    prepMinutes: 25,
    servings: 2,
    estimatedCostDkk: 44,
    calories: 610,
    protein: 27,
    carbs: 92,
    fat: 12,
    fiber: 16,
    ingredients: [
      '150 g tørrede røde linser',
      '1 dåse hakkede tomater (400 g)',
      '160 g fuldkornstagliatelle',
      '2 gulerødder & 1 løg',
      '2 spsk tomatpuré & oregano',
      'Frisk basilikum & 25 g parmesan',
    ],
    steps: [
      'Svits finthakket løg, hvidløg og revet gulerod i olivenolie i 4 minutter.',
      'Tilsæt tomatpuré, oregano, skyllede røde linser, hakkede tomater og 2 dl vand.',
      'Lad saucen simre 16 minutter mens fuldkornspastaen koger al dente.',
      'Vend pasta og bolognese sammen og top med frisk basilikum og parmesan.',
    ],
    tags: ['vegetarisk', 'budgetvenlig', 'hurtig'],
    isFavorite: true,
  },
  {
    id: 'rec-oat-bowl',
    ownerId: 'local-user',
    title: 'Skyr- & havreskål med blåbær, figner & mandler',
    description: 'Mættende nordisk morgenmadsskål med cremet skyr, grovvalsede havregryn, friske bær, ristede mandler og græskarkerner.',
    imageUrl: RECIPE_IMAGES.oats,
    dietType: 'vegetarisk',
    mealType: 'breakfast',
    prepMinutes: 8,
    servings: 1,
    estimatedCostDkk: 19,
    calories: 440,
    protein: 28,
    carbs: 52,
    fat: 13,
    fiber: 9,
    ingredients: [
      '200 g skyr naturel',
      '50 g grovvalsede havregryn',
      '75 g friske blåbær',
      '1 frisk figen eller æble',
      '15 g ristede mandler',
      '10 g græskarkerner & 1 tsk honning',
    ],
    steps: [
      'Rør skyr let op med en skefuld mælk eller vand for en cremet konsistens.',
      'Anret havregryn og skyr i en dyb skål.',
      'Top med blåbær, skivede figner, ristede mandler, græskarkerner og lidt honning.',
    ],
    tags: ['vegetarisk', 'hurtig', 'højt-protein'],
    isFavorite: true,
  },
];

export function createInitialMealPlan(ownerId = 'local-user'): MealPlan {
  const startDate = getMondayIso();
  const weekNum = getIsoWeekNumber();
  const dayNames = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];

  const dinners = [
    {
      title: 'Cremet kikærte- & sødkartoffelcurry med spinat',
      desc: 'Varme krydderier, kokosmælk, kikærter og dampede jasminris.',
      prep: 30, cost: 54, kcal: 640, p: 24, c: 84, f: 21, fib: 14,
      micro: 'A-vitamin, jern og folat',
      img: RECIPE_IMAGES.curry,
      ing: [
        { name: 'Kikærter på dåse', amount: '2 dåser', category: 'Kolonial' as const, estimatedPriceDkk: 18 },
        { name: 'Søde kartofler', amount: '500 g', category: 'Frugt & Grønt' as const, estimatedPriceDkk: 16 },
        { name: 'Let kokosmælk', amount: '1 dåse', category: 'Kolonial' as const, estimatedPriceDkk: 14 },
        { name: 'Frisk babyspinat', amount: '125 g', category: 'Frugt & Grønt' as const, estimatedPriceDkk: 15 },
      ],
      steps: ['Svits karrypasta og søde kartofler.', 'Tilsæt kokosmælk og kikærter og simre 18 min.', 'Vend spinat og lime i før servering med ris.'],
    },
    {
      title: 'Rød linsebolognese med fuldkornstagliatelle',
      desc: 'Fyldig plantebaseret bolognese med rodfrugter, tomater og frisk basilikum.',
      prep: 25, cost: 44, kcal: 620, p: 28, c: 90, f: 14, fib: 16,
      micro: 'Jern, zink og B-vitaminer',
      img: RECIPE_IMAGES.bolognese,
      ing: [
        { name: 'Røde linser', amount: '300 g', category: 'Kolonial' as const, estimatedPriceDkk: 16 },
        { name: 'Hakkede tomater', amount: '2 dåser', category: 'Kolonial' as const, estimatedPriceDkk: 14 },
        { name: 'Fuldkornstagliatelle', amount: '250 g', category: 'Kolonial' as const, estimatedPriceDkk: 16 },
        { name: 'Gulerødder', amount: '500 g', category: 'Frugt & Grønt' as const, estimatedPriceDkk: 10 },
      ],
      steps: ['Svits løg, hvidløg og revet gulerod.', 'Simre linser og tomater i 16 min.', 'Vend med kogt fuldkornspasta og frisk basilikum.'],
    },
    {
      title: 'Svamperisotto med timian & ristede hasselnødder',
      desc: 'Cremet risotto med gyldne svampe, parmesan og sprøde nødder.',
      prep: 35, cost: 62, kcal: 610, p: 23, c: 74, f: 22, fib: 7,
      micro: 'D-vitamin, calcium og selen',
      img: RECIPE_IMAGES.risotto,
      ing: [
        { name: 'Arborio risottoris', amount: '250 g', category: 'Kolonial' as const, estimatedPriceDkk: 18 },
        { name: 'Blandede svampe', amount: '350 g', category: 'Frugt & Grønt' as const, estimatedPriceDkk: 24 },
        { name: 'Parmesan', amount: '80 g', category: 'Mejeri & Æg' as const, estimatedPriceDkk: 25 },
        { name: 'Hasselnødder', amount: '50 g', category: 'Kolonial' as const, estimatedPriceDkk: 12 },
      ],
      steps: ['Rist svampene gyldne med timian.', 'Tilbered risotto med varm bouillon i 20 min.', 'Vend parmesan og svampe i og top med hasselnødder.'],
    },
    {
      title: 'Ovnbagt blomkål & halloumi med quinoasalat',
      desc: 'Krydret bagt blomkål med sprødstegt halloumi, quinoa, granatæble og urtedressing.',
      prep: 25, cost: 58, kcal: 650, p: 32, c: 58, f: 30, fib: 11,
      micro: 'Calcium, C-vitamin og magnesium',
      img: RECIPE_IMAGES.chicken,
      ing: [
        { name: 'Blomkål', amount: '1 stk', category: 'Frugt & Grønt' as const, estimatedPriceDkk: 18 },
        { name: 'Halloumi ost', amount: '200 g', category: 'Mejeri & Æg' as const, estimatedPriceDkk: 26 },
        { name: 'Quinoa', amount: '200 g', category: 'Kolonial' as const, estimatedPriceDkk: 20 },
      ],
      steps: ['Bag blomkålsbuketter med spidskommen ved 210°C i 20 min.', 'Kog quinoa og steg halloumi gylden.', 'Anret med frisk persille og citrondressing.'],
    },
    {
      title: 'Hjemmelavet fuldkornspizza med artiskok & mozzarella',
      desc: 'Sprød fuldkornsbund med tomatsauce, frisk mozzarella, artiskokhjerter og rucola.',
      prep: 30, cost: 56, kcal: 690, p: 29, c: 82, f: 24, fib: 10,
      micro: 'Calcium, lycopen og kostfibre',
      img: RECIPE_IMAGES.bolognese,
      ing: [
        { name: 'Fuldkornspizzadej', amount: '1 rulle', category: 'Brød & Bageri' as const, estimatedPriceDkk: 18 },
        { name: 'Frisk mozzarella', amount: '250 g', category: 'Mejeri & Æg' as const, estimatedPriceDkk: 20 },
        { name: 'Rucola', amount: '75 g', category: 'Frugt & Grønt' as const, estimatedPriceDkk: 12 },
      ],
      steps: ['Rul dejen ud og smør med krydret tomatsauce.', 'Top med mozzarella og artiskok og bag 14 min ved 230°C.', 'Top med frisk rucola og olivenolie.'],
    },
    {
      title: 'Thai grøn grøntsagswok med tofu & cashewnødder',
      desc: 'Sprøde sukkerærter, broccoli og marineret tofu vendt i ingefær-sojasauce.',
      prep: 20, cost: 64, kcal: 630, p: 31, c: 68, f: 24, fib: 12,
      micro: 'Jern, magnesium og K-vitamin',
      img: RECIPE_IMAGES.curry,
      ing: [
        { name: 'Fast økologisk tofu', amount: '250 g', category: 'Plantebaseret' as const, estimatedPriceDkk: 24 },
        { name: 'Broccoli', amount: '1 stk', category: 'Frugt & Grønt' as const, estimatedPriceDkk: 14 },
        { name: 'Cashewnødder', amount: '60 g', category: 'Kolonial' as const, estimatedPriceDkk: 16 },
      ],
      steps: ['Steg tofuterninger sprøde med sesamolie.', 'Lynsteg broccoli, peberfrugt og ingefær i 4 min.', 'Vend med sojasauce, lime og cashewnødder.'],
    },
    {
      title: 'Nordisk rodfrugtsuppe med ristede kikærter & surdejsbrød',
      desc: 'Fløjlsblød suppe på bagte pastinakker, gulerødder og timian med sprøde proteintoppings.',
      prep: 30, cost: 42, kcal: 570, p: 22, c: 76, f: 18, fib: 15,
      micro: 'A-vitamin, kalium og kostfibre',
      img: RECIPE_IMAGES.risotto,
      ing: [
        { name: 'Pastinakker & knoldselleri', amount: '600 g', category: 'Frugt & Grønt' as const, estimatedPriceDkk: 22 },
        { name: 'Surdejsbrød', amount: '1 stk', category: 'Brød & Bageri' as const, estimatedPriceDkk: 26 },
      ],
      steps: ['Bag rodfrugter med hvidløg og timian i 25 min.', 'Blend glat med varm grøntsagsbouillon.', 'Server med sprøde kikærter og varmt surdejsbrød.'],
    },
  ];

  const days = dayNames.map((dayName, idx) => {
    const dinner = dinners[idx];
    const dateIso = addDaysIso(startDate, idx);
    return {
      dayIndex: idx,
      dayName,
      dateIso,
      meals: [
        {
          id: `m-${idx}-b`,
          slot: 'breakfast' as const,
          title: idx % 2 === 0 ? 'Skyr- & havreskål med blåbær og mandler' : 'Rugbrød med blødkogt æg, avocado & purløg',
          description: idx % 2 === 0 ? 'Proteinrig morgenmad med friske bær, havre og ristede mandler.' : 'Klassisk nordisk morgenmad med fuldkornsrugbrød og sunde fedtsyrer.',
          prepMinutes: 8,
          estimatedCostDkk: 19,
          calories: 460,
          protein: 28,
          carbs: 50,
          fat: 15,
          fiber: 9,
          micronutrients: 'Calcium, B12 og antioxidanter',
          imageUrl: RECIPE_IMAGES.oats,
          ingredients: idx === 0
            ? [
                { name: 'Skyr naturel', amount: '1 kg', category: 'Mejeri & Æg' as const, estimatedPriceDkk: 26 },
                { name: 'Grovvalsede havregryn', amount: '500 g', category: 'Kolonial' as const, estimatedPriceDkk: 12 },
                { name: 'Blåbær', amount: '250 g', category: 'Frugt & Grønt' as const, estimatedPriceDkk: 22 },
                { name: 'Økologiske æg (10 stk)', amount: '1 bakke', category: 'Mejeri & Æg' as const, estimatedPriceDkk: 28 },
                { name: 'Fuldkornsrugbrød', amount: '1 pakke', category: 'Brød & Bageri' as const, estimatedPriceDkk: 16 },
              ]
            : [],
          steps: ['Anret i skål eller på ristet rugbrød.', 'Top med friske bær/urter og server med kaffe eller te.'],
          eaten: idx === 0,
        },
        {
          id: `m-${idx}-l`,
          slot: 'lunch' as const,
          title: idx % 2 === 0 ? 'Lun quinoasalat med feta, edamame & bagt peberfrugt' : 'Fuldkornswrap med hummus, falafel & sprød kål',
          description: idx % 2 === 0 ? 'Perfekt til madpakke med høj mæthed og komplet aminosyreprofil.' : 'Hurtig vegetarisk frokostwrap klar på 10 minutter.',
          prepMinutes: 12,
          estimatedCostDkk: 28,
          calories: 560,
          protein: 27,
          carbs: 62,
          fat: 20,
          fiber: 11,
          micronutrients: 'Folat, jern og E-vitamin',
          imageUrl: RECIPE_IMAGES.chicken,
          ingredients: idx === 0
            ? [
                { name: 'Edamamebønner (frost)', amount: '400 g', category: 'Frost' as const, estimatedPriceDkk: 20 },
                { name: 'Salatost / Feta', amount: '200 g', category: 'Mejeri & Æg' as const, estimatedPriceDkk: 19 },
                { name: 'Hummus', amount: '200 g', category: 'Plantebaseret' as const, estimatedPriceDkk: 18 },
                { name: 'Fuldkornstortillas', amount: '1 pakke', category: 'Brød & Bageri' as const, estimatedPriceDkk: 16 },
              ]
            : [],
          steps: ['Bland base og grønt i skål eller lun fuldkornswrap.', 'Dryp med citronsaft og olivenolie.'],
          eaten: false,
        },
        {
          id: `m-${idx}-d`,
          slot: 'dinner' as const,
          title: dinner.title,
          description: dinner.desc,
          prepMinutes: dinner.prep,
          estimatedCostDkk: dinner.cost,
          calories: dinner.kcal,
          protein: dinner.p,
          carbs: dinner.c,
          fat: dinner.f,
          fiber: dinner.fib,
          micronutrients: dinner.micro,
          imageUrl: dinner.img,
          ingredients: dinner.ing,
          steps: dinner.steps,
          eaten: false,
        },
      ],
    };
  });

  return {
    id: `plan-week-${weekNum}`,
    ownerId,
    weekLabel: `Uge ${weekNum}`,
    startDate,
    dietType: 'vegetarisk',
    targetCalories: 2100,
    householdSize: 2,
    estimatedWeeklyCostDkk: 648,
    days,
    mealPrepTips: [
      'Kog en dobbelt portion quinoa søndag aften — den bruges både til ugens frokostsalater og torsdagens aftensmad.',
      'Snit gulerødder og kål på én gang og opbevar i lufttæt boks med fugtigt køkkenrulle, så de holder sig sprøde i 5 dage.',
      'Lav ekstra linsebolognese tirsdag og frys halvdelen ned til travle dage i næste uge.',
    ],
    createdAtIso: new Date().toISOString(),
  };
}

export function buildShoppingItemsFromPlan(plan: MealPlan, ownerId = 'local-user'): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();
  let idx = 1;
  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const key = `${ing.name.toLowerCase().trim()}__${ing.category}`;
        const existing = map.get(key);
        if (existing) {
          existing.estimatedPriceDkk = Math.round(existing.estimatedPriceDkk + ing.estimatedPriceDkk * 0.6);
          if (!existing.amount.includes(ing.amount)) {
            existing.amount = `${existing.amount} + ${ing.amount}`.slice(0, 58);
          }
        } else {
          map.set(key, {
            id: `shop-${plan.id}-${idx++}`,
            ownerId,
            name: ing.name.slice(0, 118),
            amount: ing.amount.slice(0, 58),
            category: ing.category,
            estimatedPriceDkk: Math.round(ing.estimatedPriceDkk),
            checked: false,
            fromMealPlanId: plan.id,
          });
        }
      }
    }
  }
  return Array.from(map.values());
}

export function createInitialReceipts(ownerId = 'local-user'): Receipt[] {
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const prevYm = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

  return [
    {
      id: 'rcpt-101',
      ownerId,
      storeName: 'Rema 1000',
      purchaseDate: `${ym}-04`,
      totalDkk: 428,
      primaryCategory: 'Frugt & Grønt',
      items: [
        { name: 'Øko babyspinat & broccoli', quantity: '2 stk', priceDkk: 34, category: 'Frugt & Grønt' },
        { name: 'Søde kartofler & gulerødder', quantity: '1,5 kg', priceDkk: 38, category: 'Frugt & Grønt' },
        { name: 'Skyr naturel 1 kg', quantity: '2 stk', priceDkk: 52, category: 'Mejeri & Æg' },
        { name: 'Økologiske æg 10 stk', quantity: '1 bakke', priceDkk: 32, category: 'Mejeri & Æg' },
        { name: 'Kikærter, linser & kokosmælk', quantity: '5 stk', priceDkk: 76, category: 'Kolonial' },
        { name: 'Fuldkornsrugbrød & surdej', quantity: '2 stk', priceDkk: 44, category: 'Brød & Bageri' },
        { name: 'Fast øko tofu & hummus', quantity: '3 stk', priceDkk: 68, category: 'Plantebaseret' },
        { name: 'Havredrik barista', quantity: '3 ltr', priceDkk: 48, category: 'Drikkevarer' },
        { name: 'Opvasketabs & køkkenrulle', quantity: '1 pk', priceDkk: 36, category: 'Husholdning' },
      ],
      tags: ['økologisk', 'hverdag', 'ugeindkøb'],
      notes: 'Ugeindkøb til madplan',
    },
    {
      id: 'rcpt-102',
      ownerId,
      storeName: 'Netto',
      purchaseDate: `${ym}-11`,
      totalDkk: 365,
      primaryCategory: 'Kolonial',
      items: [
        { name: 'Arborio risottoris & quinoa', quantity: '2 pk', priceDkk: 42, category: 'Kolonial' },
        { name: 'Blandede svampe & tomater', quantity: '700 g', priceDkk: 54, category: 'Frugt & Grønt' },
        { name: 'Parmesan & frisk mozzarella', quantity: '2 stk', priceDkk: 59, category: 'Mejeri & Æg' },
        { name: 'Laksefilet fersk', quantity: '300 g', priceDkk: 69, category: 'Kød & Fisk' },
        { name: 'Edamamebønner & ærter', quantity: '2 poser', priceDkk: 38, category: 'Frost' },
        { name: 'Mørk chokolade 70% & mandler', quantity: '2 stk', priceDkk: 51, category: 'Snacks & Sødt' },
        { name: 'Olivenolie ekstra jomfru', quantity: '500 ml', priceDkk: 52, category: 'Kolonial' },
      ],
      tags: ['tilbud', 'hverdag'],
      notes: 'Gode tilbud på kolonial og fisk',
    },
    {
      id: 'rcpt-103',
      ownerId,
      storeName: 'Føtex',
      purchaseDate: `${ym}-18`,
      totalDkk: 512,
      primaryCategory: 'Frugt & Grønt',
      items: [
        { name: 'Blåbær, figner & avocado', quantity: '4 stk', priceDkk: 88, category: 'Frugt & Grønt' },
        { name: 'Halloumi & græsk yoghurt', quantity: '3 stk', priceDkk: 74, category: 'Mejeri & Æg' },
        { name: 'Surdejsbrød fra bageren', quantity: '1 stk', priceDkk: 36, category: 'Brød & Bageri' },
        { name: 'Kyllingebryst friland', quantity: '500 g', priceDkk: 78, category: 'Kød & Fisk' },
        { name: 'Kaffe hele bønner øko', quantity: '400 g', priceDkk: 79, category: 'Drikkevarer' },
        { name: 'Tahin, soyasauce & cashews', quantity: '3 stk', priceDkk: 95, category: 'Kolonial' },
        { name: 'Frisk basilikum, dild & timian', quantity: '3 potter', priceDkk: 62, category: 'Frugt & Grønt' },
      ],
      tags: ['gæster', 'økologisk'],
      notes: 'Weekendmiddag + basisvarer',
    },
    {
      id: 'rcpt-104',
      ownerId,
      storeName: 'Lidl',
      purchaseDate: `${ym}-23`,
      totalDkk: 289,
      primaryCategory: 'Plantebaseret',
      items: [
        { name: 'Falafel & plantefars', quantity: '2 pk', priceDkk: 54, category: 'Plantebaseret' },
        { name: 'Rodfrugter & rødkål', quantity: '2 kg', priceDkk: 45, category: 'Frugt & Grønt' },
        { name: 'Fuldkornstagliatelle & wraps', quantity: '3 pk', priceDkk: 48, category: 'Brød & Bageri' },
        { name: 'Græskarkerner & havregryn', quantity: '2 pk', priceDkk: 39, category: 'Kolonial' },
        { name: 'Danskvand med citrus', quantity: '6 fl', priceDkk: 34, category: 'Drikkevarer' },
        { name: 'Feta & smør øko', quantity: '2 stk', priceDkk: 69, category: 'Mejeri & Æg' },
      ],
      tags: ['madpakke', 'tilbud'],
      notes: 'Hurtig opfyldning til madpakker',
    },
    {
      id: 'rcpt-105',
      ownerId,
      storeName: 'Rema 1000',
      purchaseDate: `${prevYm}-14`,
      totalDkk: 645,
      primaryCategory: 'Frugt & Grønt',
      items: [
        { name: 'Sæsongrønt & frugt', quantity: '1 kurv', priceDkk: 215, category: 'Frugt & Grønt' },
        { name: 'Mejeri & æg ugepakke', quantity: '1 pk', priceDkk: 165, category: 'Mejeri & Æg' },
        { name: 'Tørvarer, pasta & bælgfrugter', quantity: '1 pk', priceDkk: 175, category: 'Kolonial' },
        { name: 'Husholdningsartikler', quantity: '1 pk', priceDkk: 90, category: 'Husholdning' },
      ],
      tags: ['hverdag', 'økologisk'],
      notes: 'Forrige måneds hovedindkøb',
    },
  ];
}
