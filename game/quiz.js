// Losování otázek z databáze (game/data.js). Bez závislosti na stránce, aby šlo ověřit přes quiz_check.js.
(function () {
  const BEGINNER_SHARE = 0.25;
  const BEGINNER_MIN = 12;
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
    .split(/\s+/).filter((w) => w.length > 2 && !/\d/.test(w)));
  // „Dorůstá do výšky 20 až 90 cm“ a „20 až 100 cm“ nejsou pro dítě dvě různé možnosti.
  function tooSimilar(a, b) {
    const wordsA = wordsOf(a);
    const wordsB = wordsOf(b);
    const shorter = Math.min(wordsA.size, wordsB.size);
    if (!shorter) return true;
    return [...wordsA].filter((w) => wordsB.has(w)).length / shorter >= 0.6;
  }

  // Člověk je vzácný vtípek: smí být jen hledaným druhem, ne špatnou odpovědí u opic a lidoopů.
  const notEgg = (s) => !s.egg;

  // Znalec: nejbližší příbuzní (čeleď, řád, třída). Začátečník: stejný řád, ale jiná čeleď, druhy se liší víc.
  function relatives(target, classmates, count, easy) {
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
    const groups = easy
      ? [others.filter((s) => inOrder(s) && !inFamily(s)), others.filter((s) => !inFamily(s)), others]
      : [others.filter(inFamily), others.filter(inOrder), others];
    groups.forEach(add);
    return out.length === count ? out : null;
  }

  const withPhoto = (s) => ({ species: s, photo: pick(s.photos) });

  function photoQuestion(target, classmates, easy) {
    const others = relatives(target, classmates, 3, easy);
    if (!others) return null;
    return {
      type: "findPhoto",
      prompt: "Najdi na fotkách:",
      highlight: target.name,
      options: shuffle([target, ...others].map(withPhoto)),
    };
  }

  function nameQuestion(target, classmates, easy) {
    const others = relatives(target, classmates, 3, easy);
    if (!others) return null;
    return {
      type: "findName",
      prompt: "Který druh je na fotce?",
      photo: pick(target.photos),
      options: shuffle([target, ...others].map((s) => ({ species: s }))),
    };
  }

  // Správné tvrzení + tři tvrzení o jiných druzích, o kterých víme, že pro cílový druh neplatí.
  function factQuestion(target, classmates) {
    if (!target.facts.length) return null;
    const correct = pickFact(target.facts);
    const wrong = shuffle(classmates.flatMap((s) =>
      s === target ? [] : s.facts.filter((f) => f.not.includes(target.id) && f.text !== correct.text)));
    const order = (f) => (f.cat === correct.cat ? 0 : 1) + (isDull(f) ? 2 : 0);
    const distractors = [];
    for (const f of wrong.sort((a, b) => order(a) - order(b))) {
      if (distractors.length === 3) break;
      if (![correct, ...distractors].some((d) => tooSimilar(d.text, f.text))) distractors.push(f);
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
  function speciesQuestion(target, classmates) {
    const facts = target.facts.filter((f) => f.not.length >= 3);
    if (!facts.length) return null;
    const fact = pickFact(facts);
    const byId = new Map(classmates.map((s) => [s.id, s]));
    const others = [];
    const names = new Set([target.name]);
    for (const s of shuffle(fact.not.map((id) => byId.get(id)).filter((s) => s && notEgg(s)))) {
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
  const TEXT_MAKERS = [factQuestion, speciesQuestion];

  // classes: třídy jedné říše. skip: id druhů, které už v kole byly. only: jen tyto cílové druhy (opakování chyb).
  // easy: začátečnická volba možností. textOnly: jen otázky, které jdou hrát bez fotek.
  function makeQuestion(classes, { skip = new Set(), only = null, easy = false, textOnly = false } = {}) {
    const makers = textOnly ? TEXT_MAKERS : MAKERS;
    const all = classes.flatMap((c) => c.species.map((s) => [s, c.species]))
      .filter(([s]) => !only || only.has(s.id));
    const fresh = all.filter(([s]) => !skip.has(s.id));
    for (const pool of [fresh, all]) {
      if (!pool.length) continue;
      for (let tries = 0; tries < 200; tries++) {
        // Známější druhy (článek ve více jazycích) se losují častěji. Dělení odmocninou z velikosti třídy
        // brání velkým třídám vytlačit malé; 1/ln n má téměř nulový účinek, plná rovnost by malé třídy pořád opakovala.
        const [target, classmates] = pickWeighted(pool, ([s, mates]) => (1 + (s.pop || 0)) / Math.sqrt(mates.length));
        const q = pick(makers)(target, classmates, easy);
        if (!q) continue;
        const other = target.facts.filter((f) => f !== q.shownFact);
        q.target = target;
        q.bonusFact = other.length ? pickFact(other).text : null;
        return q;
      }
    }
    return null;
  }

  // Je možnost správná? Správně je právě ta, která nese cílový druh.
  const isCorrect = (q, option) => option.species === q.target;

  // Třídy zúžené na druhy, které žijí aspoň na jednom z vybraných kontinentů.
  const inContinents = (classes, selected) => classes.map((c) => ({
    ...c,
    species: c.species.filter((s) => s.continents.some((code) => selected.has(code))),
  }));

  // Pro začátečníka nejznámější čtvrtina každé třídy (a vzácný vtípek, ten má vlastní nízkou váhu).
  const popularOnly = (classes) => classes.map((c) => {
    const limit = Math.max(BEGINNER_MIN, Math.ceil(c.species.length * BEGINNER_SHARE));
    const known = [...c.species].sort((a, b) => (b.pop || 0) - (a.pop || 0)).slice(0, limit);
    return { ...c, species: [...new Set([...known, ...c.species.filter((s) => s.egg)])] };
  });

  window.Quiz = { makeQuestion, isCorrect, inContinents, popularOnly, tooSimilar, isDull, MAKERS };
})();
