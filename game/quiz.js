// Losování otázek z databáze (game/data.js). Bez závislosti na stránce, aby šlo ověřit přes quiz_check.js.
(function () {
  // Jaký díl nejznámějších druhů každé třídy se hraje a kolik druhů nejméně. Znalec hraje se všemi.
  const LEVEL_POOLS = { beginner: { share: 0.03, min: 8 }, advanced: { share: 0.2, min: 12 } };
  // Hub je ve hře mnohem méně druhů než živočichů a rostlin, začátečník i pokročilý jich proto znají dvojnásobný díl.
  const KINGDOM_SHARES = { houby: { beginner: 0.06, advanced: 0.4 } };
  // Tvrzení jen o období kvetení, růstu nebo o velikosti: pravdivá, ale špatně se pamatují a dítě je může jen hádat.
  const DULL = /^(tento druh )?((kvete|roste|vyrůstá|se objevuje|objevuje se|plodnice rost[eo]u?)\b.* (ledn|lede|únor|březn|břez|dubn|dube|květn|květe|červn|červe|srpn|srpe|září|říjn|říje|listop|prosin|jaře|létě|podzim)|(dorůstá|dosahuje|měří|má klobouk|klobouk měří|může dorůst)\b)/i;
  const DULL_WEIGHT = 0.15;
  // Vazby na jiné druhy jsou to nejzajímavější. Vzhled jde často uhádnout z fotky, ale dítěti taková snadná otázka občas udělá radost.
  const TOPIC_WEIGHTS = { vztahy: 4, potrava: 2, vzhled: 0.4 };

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  function pickWeighted(items, weight) {
    let left = Math.random() * items.reduce((sum, item) => sum + weight(item), 0);
    for (const item of items) {
      left -= weight(item);
      if (left < 0) return item;
    }
    return items[items.length - 1];
  }
  const isDull = (fact) => DULL.test(fact.text);
  const pickFact = (facts) => pickWeighted(facts, (f) => (isDull(f) ? DULL_WEIGHT : 1) * (TOPIC_WEIGHTS[f.cat] ?? 1));

  const wordsOf = (text) => new Set(text.toLowerCase().replace(/^tento druh /, "").replace(/[.,:;]/g, "")
    .split(/\s+/).filter((w) => w.length > 2 && !/\d/.test(w)).map((w) => w.slice(0, 5))); // začátek slova kvůli skloňování
  // „Dorůstá do výšky 20 až 90 cm“ a „20 až 100 cm“ nejsou pro dítě dvě různé možnosti.
  function tooSimilar(a, b) {
    const wordsA = wordsOf(a);
    const wordsB = wordsOf(b);
    const shorter = Math.min(wordsA.size, wordsB.size);
    if (!shorter) return true;
    return [...wordsA].filter((w) => wordsB.has(w)).length / shorter >= 0.6;
  }
  // „Je to jednoletá rostlina.“ a „Žije jen jeden rok.“: stejný význam jinými slovy, klíč "same" z pipeline.py.
  const sameMeaning = (a, b) => Boolean(a.same) && a.same === b.same;

  // Zmiňuje věta daný druh? Česky se názvy skloňují, proto stačí začátek rodového jména (kosatka, kosatky, kosatkou).
  // Omylem vyřazená možnost nevadí, věta o kosatce nabídnutá u kosatky by ale otázku prozradila.
  function mentions(text, species) {
    const genus = species.name.split(" ")[0].toLowerCase();
    const stem = genus.slice(0, genus.length >= 6 ? -2 : genus.length >= 4 ? -1 : undefined);
    return text.toLowerCase().split(/[^\p{L}]+/u).some((w) => w.startsWith(stem) && w.length <= stem.length + 4);
  }

  // Jak daleko je druh od hledaného: čeleď, řád, zbytek třídy.
  const distance = (target, s) => (target.family && s.family === target.family ? 0 : target.order && s.order === target.order ? 1 : 2);
  // Pořadí, v jakém se špatné odpovědi berou: obvykle od nejbližších, začátečník od nejvzdálenějších.
  const closeness = (target, s, level) => (level === "beginner" ? 2 - distance(target, s) : distance(target, s));
  // „K hejnům jiných hus“: věta sama říká, že je o někom jiném, než je hledaný druh.
  const OTHER_SPECIES = /(?<!\p{L})jin(ý|á|é|í|ých|ým|ými|ou|ého|ému)(?!\p{L})/iu;

  // Člověk je vzácný vtípek: smí být jen hledaným druhem, ne špatnou odpovědí u opic a lidoopů.
  const notEgg = (s) => !s.egg;

  // Znalec: nejbližší příbuzní (čeleď, řád, třída). Pokročilý: stejný řád, ale jiná čeleď. Začátečník: jiný řád, druhy se liší nejvíc.
  function relatives(target, classmates, count, level) {
    const out = [];
    const names = new Set([target.name]);
    const add = (group) => {
      for (const s of shuffle(group)) {
        if (out.length < count && !names.has(s.name)) {
          names.add(s.name);
          out.push(s);
        }
      }
    };
    const inFamily = (s) => target.family && s.family === target.family;
    const inOrder = (s) => target.order && s.order === target.order;
    const others = classmates.filter(notEgg);
    const groups = {
      beginner: [others.filter((s) => !inOrder(s)), others.filter((s) => !inFamily(s)), others],
      advanced: [others.filter((s) => inOrder(s) && !inFamily(s)), others.filter((s) => !inFamily(s)), others],
      expert: [others.filter(inFamily), others.filter(inOrder), others],
    };
    groups[level].forEach(add);
    return out.length === count ? out : null;
  }

  const withPhoto = (s) => ({ species: s, photo: pick(s.photos) });

  function photoQuestion(target, classmates, level) {
    const others = relatives(target, classmates, 3, level);
    if (!others) return null;
    return {
      type: "findPhoto",
      prompt: "Najdi na fotkách:",
      highlight: target.name,
      options: shuffle([target, ...others].map(withPhoto)),
    };
  }

  function nameQuestion(target, classmates, level) {
    const others = relatives(target, classmates, 3, level);
    if (!others) return null;
    return {
      type: "findName",
      prompt: "Který druh je na fotce?",
      photo: pick(target.photos),
      options: shuffle([target, ...others].map((s) => ({ species: s }))),
    };
  }

  // Správné tvrzení + tři tvrzení o jiných druzích, o kterých víme, že pro cílový druh neplatí.
  function factQuestion(target, classmates, level) {
    if (!target.facts.length) return null;
    const correct = pickFact(target.facts);
    const wrong = shuffle(classmates.flatMap((s) =>
      s === target ? [] : s.facts
        .filter((f) => f.not.includes(target.id) && f.text !== correct.text && !sameMeaning(f, correct) && !mentions(f.text, target) && !OTHER_SPECIES.test(f.text))
        .map((f) => [f, s])));
    // Věta o příbuzném se nedá vyloučit jen podle toho, že mluví o úplně jiném zvířeti nebo rostlině. Začátečníkovi to naopak pomůže.
    const order = ([f, s]) => closeness(target, s, level) * 10 + (f.cat === correct.cat ? 0 : 1) + (isDull(f) ? 2 : 0);
    const distractors = [];
    for (const [f] of wrong.sort((a, b) => order(a) - order(b))) {
      if (distractors.length === 3) break;
      if (![correct, ...distractors].some((d) => tooSimilar(d.text, f.text) || sameMeaning(d, f))) distractors.push(f);
    }
    if (distractors.length < 3) return null;
    return {
      type: "findFact",
      prompt: "Která věta platí pro tento druh?",
      highlight: target.name,
      photo: pick(target.photos),
      shownFact: correct,
      options: shuffle([
        { species: target, text: correct.text },
        ...distractors.map((f) => ({ text: f.text })),
      ]),
    };
  }

  // Tvrzení a čtyři druhy, z nichž pro tři je jisté, že pro ně neplatí.
  function speciesQuestion(target, classmates, level) {
    const facts = target.facts.filter((f) => f.not.length >= 3);
    if (!facts.length) return null;
    const fact = pickFact(facts);
    const byId = new Map(classmates.map((s) => [s.id, s]));
    const others = [];
    const names = new Set([target.name]);
    const candidates = shuffle(fact.not.map((id) => byId.get(id)).filter((s) => s && notEgg(s) && !mentions(fact.text, s)));
    for (const s of candidates.sort((a, b) => closeness(target, a, level) - closeness(target, b, level))) {
      if (others.length < 3 && !names.has(s.name)) {
        names.add(s.name);
        others.push(s);
      }
    }
    if (others.length < 3) return null;
    return {
      type: "findSpecies",
      prompt: "Pro který druh to platí?",
      statement: fact.text,
      shownFact: fact,
      options: shuffle([target, ...others].map(withPhoto)),
    };
  }

  const MAKERS = [photoQuestion, nameQuestion, factQuestion, speciesQuestion];
  const SCOPE_STEPS = 3;
  const TARGET_TRIES = 100;

  // S kým se druh porovnává. Savci (mají užší skupinu) nejdřív v ní, pak v řádu a až nakonec v celé třídě.
  // Začátečník užší skupinu přeskočí, ale kočka vedle delfína by byla moc snadná i pro něj: začíná v řádu.
  function scopeOf(target, step, level) {
    if (!target.peers) return () => true;
    const inPeers = (s) => s.peers === target.peers;
    const inOrder = (s) => s.order === target.order;
    const scopes = level === "beginner" ? [inOrder, () => true, () => true] : [inPeers, inOrder, () => true];
    return scopes[step];
  }

  // Vnitřní dělení třídy: řád a v něm čeleď, nebo skupina z Wikidat (žraloci, plži, mechy) a v ní řád.
  const group = (s) => s.clade || s.order;
  const subgroup = (s) => `${group(s)}/${s.clade ? s.order : s.family}`;
  // Odmocnina tlumí známost a velikost třídy (velké třídy nevytlačí malé); skupina dostane podíl podle odmocniny své velikosti
  // a rozdělí ho stejně mezi podskupiny (žáby nevytlačí mloky, kočky ostatní šelmy).
  const weightCache = { true: new WeakMap(), false: new WeakMap() };
  function weights(species, regional = false) {
    const cache = weightCache[regional];
    if (!cache.has(species)) cache.set(species, computeWeights(species, regional));
    return cache.get(species);
  }
  // V jednom geo regionu mají přednost druhy, které jinde nežijí: zubr před myší domácí, okapi před kosatkou.
  // Váha i známost se dělí počtem kontinentů druhu na třetinu, víc by z Evropy vytlačilo kosa, čápa i lišku.
  const REGIONAL = 1 / 3;
  const CONTINENTS = new Set(["EU", "AS", "AF", "NA", "SA", "AN", "OC"]);
  const regionalShare = (s, regional) => (regional ? s.regions.filter((r) => CONTINENTS.has(r)).length ** -REGIONAL : 1);
  // Dlouhý český článek: druh, který české děti spíš znají (jabloň, prvosenka), před světovou plodinou se stručným článkem.
  // Délka ve znacích se čtvrtou odmocninou: článek 5× delší než obvykle (2000 znaků) dá jen 1,5× víc, kratší než 500 se nepočítá.
  const ARTICLE_LENGTH = 2000;
  const lengthShare = (s) => (Math.max(s.len || ARTICLE_LENGTH, 500) / ARTICLE_LENGTH) ** 0.25;
  const boost = (s, regional) => regionalShare(s, regional) * lengthShare(s);
  const fame = (s, regional) => (1 + (s.pop || 0)) * boost(s, regional);
  function computeWeights(species, regional) {
    const size = {}, spread = {};
    for (const s of species) for (const key of [group(s), subgroup(s)]) size[key] = (size[key] || 0) + 1;
    for (const [sub, top] of new Map(species.map((s) => [subgroup(s), group(s)]))) spread[top] = (spread[top] || 0) + Math.sqrt(size[sub]);
    const base = (s) => Math.sqrt((1 + (s.pop || 0)) / species.length) * boost(s, regional);
    const damped = (s) => (s.egg ? base(s) : (base(s) * Math.sqrt(size[group(s)])) / (Math.sqrt(size[subgroup(s)]) * spread[group(s)]));
    const scale = species.reduce((n, s) => n + base(s), 0) / species.reduce((n, s) => n + damped(s), 0);
    return new Map(species.map((s) => [s, s.egg ? base(s) : damped(s) * scale]));
  }

  // classes: třídy jedné říše. skip: id druhů, které už v kole byly. only: jen tyto cílové druhy (opakování chyb).
  // level: beginner, advanced nebo expert určuje, z jak blízkých druhů jsou špatné odpovědi.
  function makeQuestion(classes, { skip = new Set(), only = null, level = "expert" } = {}) {
    const all = classes.flatMap((c) => { const w = weights(c.species, Boolean(c.regional)); return c.species.map((s) => [s, w.get(s), c.wide || c.species, c.slug]); })
      .filter(([s]) => !only || only.has(s.id));
    const fresh = all.filter(([s]) => !skip.has(s.id));
    for (const pool of [fresh, all]) {
      if (!pool.length) continue;
      // Nejdřív typ otázky, každý se stejnou pravděpodobností. Další typ přijde na řadu, jen když ten vylosovaný nejde vytvořit.
      for (const make of shuffle(MAKERS)) {
        for (let step = 0; step < SCOPE_STEPS; step++) {
          for (let tries = 0; tries < TARGET_TRIES; tries++) {
            const [target, , classmates, slug] = pickWeighted(pool, ([, w]) => w);
            // Úroveň zužuje jen hledané druhy. Špatné odpovědi jsou z celé třídy, vybrané podle stejných pravidel příbuznosti.
            const q = make(target, classmates.filter(scopeOf(target, step, level)), level);
            if (!q) continue;
            // Vyhynulá zvířata ukazují i rekonstrukce a fosílie, endoparaziti preparáty a kresby, ne fotky živých zvířat.
            if (slug === "vyhynula_zvirata" || slug === "endoparaziti") {
              q.prompt = q.prompt.replace("na fotkách", "na obrázcích").replace("na fotce", "na obrázku");
              q.picture = "Obrázek";
            }
            const other = target.facts.filter((f) => f !== q.shownFact);
            q.target = target;
            q.bonusFact = other.length ? pickFact(other).text : null;
            return q;
          }
        }
      }
    }
    return null;
  }

  // Je možnost správná? Správně je právě ta, která nese cílový druh.
  const isCorrect = (q, option) => option.species === q.target;

  // Třídy zúžené na druhy z jednoho geo regionu: celý svět (patří do něj všechny druhy), kontinent, nebo Česko jako část Evropy.
  // Celý svět zůstává bez zvýhodnění místních druhů.
  const WORLD = "WORLD";
  const inRegion = (s, region) => region === WORLD || s.regions.includes(region);
  const inRegions = (classes, region) => classes.map((c) => ({
    ...c,
    species: c.species.filter((s) => inRegion(s, region)),
    regional: region !== WORLD,
  }));

  // Hledané druhy podle úrovně: nejznámější z každé třídy (a vzácný vtípek, ten má vlastní nízkou váhu). Celá třída zůstává
  // ve „wide“ pro špatné odpovědi.
  // Polovinu míst dostanou řády podle velikosti, jinak by známost z Wikidat nechala netopýry a primáty jen znalcům.
  const ORDER_QUOTA = 0.5;
  const atLevel = (classes, level) => classes.map((c) => {
    const pool = LEVEL_POOLS[level];
    if (!pool) return c;
    const limit = Math.max(pool.min, Math.ceil(c.species.length * (KINGDOM_SHARES[c.kingdom]?.[level] ?? pool.share)));
    const ranked = [...c.species].sort((a, b) => fame(b, c.regional) - fame(a, c.regional));
    const size = {}, taken = {}, perSpecies = (limit / ranked.length) * ORDER_QUOTA;
    for (const s of ranked) size[group(s)] = (size[group(s)] || 0) + 1;
    const known = new Set(ranked.filter((s) => (taken[group(s)] = (taken[group(s)] || 0) + 1) <= Math.round(size[group(s)] * perSpecies)));
    for (const s of ranked) if (known.size < limit) known.add(s);
    return { ...c, wide: c.species, species: [...new Set([...known, ...c.species.filter((s) => s.egg)])] };
  });

  window.Quiz = { makeQuestion, isCorrect, WORLD, inRegion, inRegions, atLevel, tooSimilar, isDull, mentions, OTHER_SPECIES, MAKERS };
})();
