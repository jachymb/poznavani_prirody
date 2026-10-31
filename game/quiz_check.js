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
    }
    if (q.type === "findSpecies") {
      const fact = q.target.facts.find((f) => f.text === q.statement);
      for (const o of q.options) {
        if (o.species !== q.target) assert(fact.not.includes(o.species.id), "tvrzení pro špatný druh jistě neplatí");
        assert(byId.has(o.species.id));
      }
    }
  }
}
for (const type of ["findPhoto", "findName", "findFact", "findSpecies"]) {
  assert(seenTypes[type] > 100, `typ ${type} se téměř nelosuje`);
}
console.log("OK", seenTypes);
