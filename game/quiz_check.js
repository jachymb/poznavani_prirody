// Ověření losování nad skutečnou databází: node game/quiz_check.js
const assert = require("assert");
globalThis.window = globalThis;
require("./data.js");
require("./quiz.js");

const classes = window.GAME_DATA;
assert(classes.length, "databáze je prázdná");
const seenTypes = {};
assert.strictEqual(window.Quiz.makeQuestion([{ species: [] }]), null, "prázdná třída nedá otázku");
assert(window.Quiz.tooSimilar("Dorůstá do výšky 20 až 90 centimetrů.", "Tento druh dorůstá do výšky 20 až 100 centimetrů."));
assert(!window.Quiz.tooSimilar("Žije v Evropě.", "Loví hlavně zajíce."));
assert(window.Quiz.isDull({ text: "Kvete od června do srpna." }) && !window.Quiz.isDull({ text: "Roste pod duby." }));
{
  const big = classes.reduce((a, c) => (c.species.length > a.species.length ? c : a));
  const beginner = window.Quiz.popularOnly([big]);
  const pool = new Set(beginner[0].species.map((s) => s.id));
  assert(pool.size < big.species.length, "začátečník má užší výběr");
  for (let i = 0; i < 2000; i++) {
    const q = window.Quiz.makeQuestion(beginner, { easy: true });
    assert(pool.has(q.target.id) && q.options.every((o) => !o.species || pool.has(o.species.id)), "začátečník vidí jen známější druhy");
  }
  const onlyOne = new Set([beginner[0].species[0].id]);
  for (let i = 0; i < 200; i++) {
    const q = window.Quiz.makeQuestion(beginner, { only: onlyOne });
    assert(q.target.id === [...onlyOne][0], "opakování chyb vybírá jen zadaný druh");
    const t = window.Quiz.makeQuestion(beginner, { textOnly: true });
    assert(t.type === "findFact" || t.type === "findSpecies", "bez fotek jsou jen textové otázky");
  }
}
{
  const mammals = classes.find((c) => c.species.some((s) => s.egg));
  assert(mammals, "člověk je ve hře");
  const human = mammals.species.find((s) => s.egg);
  assert.strictEqual(human.pop, 0, "váha člověka je 1");
  for (const beginner of [[mammals], window.Quiz.popularOnly([mammals])]) {
    const types = new Set();
    for (let i = 0; i < 400; i++) {
      const q = window.Quiz.makeQuestion(beginner, { only: new Set([human.id]), easy: beginner[0] !== mammals });
      types.add(q.type);
      assert.strictEqual(q.target, human);
      if (q.type === "findFact") {
        const wrong = q.options.filter((o) => !o.species).map((o) => o.text);
        const all = mammals.species.flatMap((s) => s.facts);
        assert(wrong.every((t) => all.some((f) => f.text === t && f.not.includes(human.id))), "špatná věta pro člověka jistě neplatí");
      }
    }
    assert.strictEqual(types.size, 4, `člověk musí jít hledat ve všech typech otázek, má ${[...types]}`);
  }
  const counts = { human: 0, distractor: 0 };
  for (let i = 0; i < 60000; i++) {
    const q = window.Quiz.makeQuestion([mammals]);
    if (q.target === human) counts.human++;
    else if (q.options.some((o) => o.species === human)) counts.distractor++;
  }
  assert.strictEqual(counts.distractor, 0, "člověk není špatná odpověď");
  assert(counts.human < 60, `člověk má být vzácný, vyšel ${counts.human}× z 60000`);
  console.log("člověk jako cíl:", counts.human, "z 60000 otázek o savcích");
  const groupSize = (s) => mammals.species.filter((x) => x.peers === s.peers).length;
  for (let i = 0; i < 5000; i++) {
    const q = window.Quiz.makeQuestion([mammals]);
    if (!q.target.peers || groupSize(q.target) < 4 || q.type === "findFact") continue;
    if (q.type === "findSpecies") continue;
    assert(q.options.every((o) => o.species.peers === q.target.peers), "fotky savců jsou z jeho užší skupiny");
  }
}
assert(classes.find((c) => c.slug === "ryby").species.some((s) => s.name === "Treska obecná"), "treska patří mezi ryby");
{
  const orca = { name: "Kosatka dravá" };
  assert(window.Quiz.mentions("Mezi hlavní nepřátele patří kosatka dravá a medvěd lední.", orca));
  assert(window.Quiz.mentions("Loví ho kosatky.", orca) && window.Quiz.mentions("Bývá kořistí kosatek.", orca));
  assert(!window.Quiz.mentions("Bývá kořistí levhartů.", { name: "Lev pustinný" }), "levhart není lev");
  assert(!window.Quiz.mentions("Žije v Evropě.", orca));
}
for (const cls of classes) {
  assert(cls.species.every((s) => s.latin), "každý druh má latinský název");
  assert(cls.species.every((s) => s.continents.length), "každý druh má kontinent");
  for (const code of ["EU", "AF", "OC"]) {
    const narrowed = window.Quiz.inContinents([cls], new Set([code]));
    for (let i = 0; i < 500; i++) {
      const q = window.Quiz.makeQuestion(narrowed);
      if (!q) break;
      const shown = [q.target, ...q.options.map((o) => o.species).filter(Boolean)];
      assert(shown.every((s) => s.continents.includes(code)), "otázka obsahuje jen druhy z vybraného kontinentu");
    }
  }
  const urls = cls.species.flatMap((s) => s.photos.map((p) => p.url));
  assert.strictEqual(new Set(urls).size, urls.length, "každá fotka patří jedinému druhu");
  const byId = new Map(cls.species.map((s) => [s.id, s]));
  for (let i = 0; i < 5000; i++) {
    const q = window.Quiz.makeQuestion([cls]);
    assert(q, "nepodařilo se vylosovat otázku");
    seenTypes[q.type] = (seenTypes[q.type] || 0) + 1;
    assert.strictEqual(q.options.length, 4);
    if (q.type === "findFact") {
      const texts = q.options.map((o) => o.text);
      for (const [i, a] of texts.entries()) {
        for (const b of texts.slice(i + 1)) assert(!window.Quiz.tooSimilar(a, b), `příliš podobné možnosti: ${a} / ${b}`);
      }
    }
    assert.strictEqual(q.options.filter((o) => window.Quiz.isCorrect(q, o)).length, 1, "právě jedna správná odpověď");
    assert(q.target.photos.length, "cílový druh bez fotky");

    if (q.type === "findPhoto" || q.type === "findName" || q.type === "findSpecies") {
      assert.strictEqual(new Set(q.options.map((o) => o.species.name)).size, 4, "možnosti se liší jménem");
    }
    if (q.type === "findPhoto" || q.type === "findSpecies") {
      for (const o of q.options) assert(o.species.photos.includes(o.photo), "fotka patří svému druhu");
    }
    if (q.type === "findName") assert(q.target.photos.includes(q.photo));
    if (q.type === "findFact") {
      assert.strictEqual(new Set(q.options.map((o) => o.text)).size, 4, "věty se liší");
      const owners = q.options.filter((o) => !o.species).map((o) =>
        cls.species.flatMap((s) => s.facts).filter((f) => f.text === o.text));
      for (const facts of owners) {
        assert(facts.some((f) => f.not.includes(q.target.id)), "špatná věta pro cílový druh jistě neplatí");
      }
      for (const o of q.options) {
        if (!o.species) assert(!window.Quiz.mentions(o.text, q.target), `špatná věta zmiňuje hledaný druh ${q.target.name}: ${o.text}`);
      }
    }
    if (q.type === "findSpecies") {
      const fact = q.target.facts.find((f) => f.text === q.statement);
      for (const o of q.options) {
        if (o.species !== q.target) {
          assert(fact.not.includes(o.species.id), "tvrzení pro špatný druh jistě neplatí");
          assert(!window.Quiz.mentions(q.statement, o.species), `tvrzení zmiňuje nabízený druh ${o.species.name}: ${q.statement}`);
        }
        assert(byId.has(o.species.id));
      }
    }
  }
}
for (const type of ["findPhoto", "findName", "findFact", "findSpecies"]) {
  assert(seenTypes[type] > 100, `typ ${type} se téměř nelosuje`);
}
console.log("OK", seenTypes);
