# Poznávání přírody

Přírodovědný kvíz pro děti od 10 let. Učí poznávat živočichy, rostliny a houby podle fotek a dozvědět se o nich něco zajímavého. Texty vycházejí z české Wikipedie.

## Hraní

Otevři `game/index.html` v prohlížeči, server není potřeba. Fotky se načítají z Wikimedia Commons, takže je potřeba internet.

Celá hra v jednom souboru, který jde poslat dál, je `dist/poznavani_prirody.html`. Skládá ho `node build.js` (skripty a data vloží do stránky a zhustí přes esbuild) a pre-commit hook ho před každým commitem přestaví a přidá. V novém klonu je jednou potřeba `npm install && git config core.hooksPath .githooks`.

Hra běží na <https://jachymb.github.io/poznavani-prirody/>. Post-commit hook ji po každém commitu na `main`, který změní `dist/`, zkopíruje do repa blogu v `../../jachymb.github.io`, commitne a pushne, pokud nejsou v `game/` necommitnuté změny.

- **Výběr:** říše, oblast (geo region: celý svět, kontinent, nebo Česko jako část Evropy, na mapě zvětšené) a obtížnost. Obtížnost určuje, na které druhy se hra ptá: Začátečník jen na nejznámější (3 % skupiny, u hub 6 %), Pokročilý (výchozí) na známější (20 %, u hub 40 %), Znalec na všechny. Hub je ve hře mnohem méně druhů. Známost je počet jazykových verzí článku a násobí ji čtvrtá odmocnina délky českého článku (z `data/<skupina>/articles/`, vůči obvyklým 2000 znakům): jabloň a prvosenka, o kterých česká Wikipedie píše hodně, mají přednost před světovými plodinami se stručným článkem. Polovinu míst dostanou řády podle své velikosti (vždy nejznámější druhy řádu, u skupin s `CLADES` přirozené skupiny), zbytek se plní podle známosti, aby řády málo pokryté na Wikidatech (netopýři, primáti) nezůstaly jen znalcům. V jedné oblasti mají přednost druhy, které jinde nežijí: známost i váha při losování se násobí počtem kontinentů druhu na −⅓ (zubr před myší domácí, okapi před kosatkou), celý svět je beze změny. Špatné odpovědi jsou vždy z celé třídy, u začátečníka z jiných řádů, u pokročilého ze stejného řádu a jiné čeledi, u znalce nejbližší příbuzní.
- **Otázky:** najít druh na fotkách, určit druh na fotce, vybrat větu, která pro druh platí, a vybrat druh, pro který věta platí. Hledaný druh se losuje s vahou, ve které odmocnina tlumí známost a velikost třídy. Třída se navíc dělí na dvě úrovně, řád a v něm čeleď, nebo u skupin s moc jemnými řády přirozenou skupinu z Wikidat a v ní řád (`CLADES` v `pipeline.py`: žraloci, rejnoci a chiméry, plži, mlži a hlavonožci, mechy, kapradiny…). Každá skupina dostane podíl otázek podle odmocniny své velikosti a stejně ho rozdělí mezi podskupiny, aby dítě vidělo co nejvíc různých druhů: žáby nevytlačí mloky ani kočky ostatní šelmy.
- **Po odpovědi:** vyhodnocení, zajímavost, oblasti výskytu, odkaz na Wikipedii a autor fotky.
- **Na konci kola:** přehled druhů a možnost zopakovat si chyby.

## Struktura

| Soubor | Účel |
|---|---|
| `game/index.html` | rozhraní hry |
| `game/quiz.js` | losování otázek |
| `game/data.js` | vygenerovaná databáze druhů, odsazená pro ruční čtení (při kompilaci se odsazení odstraní); ruční úpravy přepíše další běh `pipeline.py`, trvalé opravy patří do `manual.json` v `data/` |
| `game/map.js` | zjednodušená mapa kontinentů a zvětšeného Česka |
| `game/quiz_check.js` | test losování nad skutečnou databází |
| `pipeline.py` | příprava dat, jen standardní knihovna Pythonu |
| `species_emoji.py` | emoji druhu pro oslavu správné odpovědi (podle rodu, čeledi, řádu) |
| `game/db.html` | prohlížeč databáze pro ruční kontrolu pravdivých a nepravdivých tvrzení, do `dist/` nepatří |
| `build.js`, `.githooks/pre-commit` | složení hry do `dist/poznavani_prirody.html` |

Test: `node game/quiz_check.js`

## Příprava dat

Každá skupina druhů v `CLASSES` v `pipeline.py` prochází těmito kroky:

1. **Stažení:** `python pipeline.py fetch <skupina>` stáhne z Wikidat a české Wikipedie druhy s článkem a jejich fotky do `data/<skupina>/`. Přidává jen nové druhy a přerušené stahování naváže. Nastav `WIKIMEDIA_CONTACT` na svůj kontakt, Wikimedia pak povoluje 200 požadavků za minutu místo 10.
2. **Fakta a fotky:** subagent z článku vybere tvrzení s doslovnou citací a posoudí fotky. O použitelnosti rozhoduje on, ne šablona Pahýl: článek vyřadí, jen když neobsahuje žádnou informaci vhodnou pro otázku.
3. **Další fotky:** `python pipeline.py photos <skupina>` najde druhům s méně než dvěma schválenými fotkami další na Wikimedia Commons a subagent je posoudí stejně přísně. `fill` doplní každému druhu kandidáty až do deseti schválených fotek. `top` hledá druhům s jednou nebo dvěma schválenými fotkami dál, i v podkategoriích a v souborech, které latinské jméno zmiňují. Všechny kontroly fotek berou jen snímky, které aspoň na první pohled vypadají jako z volné přírody: zvíře ve výběhu, za pletivem nebo v ruce a rostlina v květináči neprojdou. Volně žijící živočich v lidském prostředí (vosa na židli, pták na střeše) projde; fotky, které dřív zamítlo jen takové prostředí, jednorázově znovu posoudí `python pipeline.py human <skupina>`.
3a. **Cizojazyčné zdroje:** `python pipeline.py foreign <skupina>` stáhne druhům bez jediného tvrzení anglický článek a nejdelší článek v dalším jazyce (bývá tam, kde je druh doma). Subagent z nich vybere tvrzení podle stejných pravidel a napíše je česky, citace zůstává v původním jazyce. Kde nic použitelného není, druh zůstane jen pro otázky s fotkou.
4. **Negativní tvrzení:** subagent určí, pro které druhy tvrzení s jistotou neplatí. Z toho vznikají špatné odpovědi. Druhy s méně než třemi takovými tvrzeními se posoudí ještě vůči dalším tvrzením ze třídy (úlohy `need_`, nejvýš pět kol). Hra bere špatné odpovědi jen ze skupiny ve hře, proto `sync_cross_negatives` (úlohy `cross_`) posuzuje druhy vůči větám z téže skupiny i z jiných zdrojových skupin (tresky vůči rybám).
5. **Přísná kontrola:** silnější model znovu projde tvrzení, negativní úsudky a fotky.
6. **Kontinenty:** subagent přiřadí druhům kontinenty výskytu. Počítá se život ve volné přírodě, tedy i zavlečené usazené a zdivočelé populace (buvol domácí v Austrálii), ne zvířata jen v zajetí, u domácích druhů navíc oblast původu. Rostlina patří tam, kde roste divoce, je zavlečená a zdomácnělá, nebo se běžně pěstuje jako hospodářská plodina či lesní dřevina; pěstování jen pro okrasu nebo výzkum nestačí. U rostlin rozhoduje silnější model, který si výskyt ověří v Plants of the World Online (POWO). Rostliny zařazené dřív podle volnějšího pravidla takhle jednorázově přepočítal (`data/plant_regions/`, má přednost před krokem kontinentů).
6a. **Česko:** druhům z Evropy rozhodne silnější model s webovými zdroji, jestli žijí v Česku (krok `czech`, `data/<skupina>/czech/`): u rostlin podle pravidla výše s Pladias a pozorováními z iNaturalist, u ostatních volně žijící druhy, u ptáků i pravidelný tah nebo zimování, u vyhynulých fosílie z Česka. Vodítkem je počet nálezů v Česku v GBIF bez zoo a botanických zahrad. Celá dosavadní databáze prošla jednorázově (`data/czech_region/`: první kolo, ověření rozporů s GBIF a všech rostlin), krok `czech` doplňuje nové druhy a druhy, které nově patří do Evropy.
7. **Jazyk:** redaktor opraví nepřirozené věty a vyřadí věty, které u druhu říkají totéž. Oprava musí projít stejnými pravidly jako původní věta.
8. **Stejný význam:** ke každému druhu dostane subagent všechny věty, které se u něj můžou potkat v otázce „Která věta platí?“, a najde mezi nimi věty se stejným významem jinými slovy („Je to jednoletá rostlina.“ a „Žije jen jeden rok.“; krok `same` ve workflow, výsledky v `data/same_meaning/`). Takové věty dostanou v `data.js` společný klíč `same`, hra je nenabídne v jedné otázce a druh jedné z nich není u ostatních špatnou odpovědí. Krok prošel jednorázově celou databází, nové druhy ho potřebují pustit znovu.

Savci navíc procházejí negativním krokem vůči podobným druhům z užší skupiny (`MAMMAL_PEERS` v `pipeline.py`), hra z nich bere špatné odpovědi. Ruční opravy jsou v `manual.json` v adresářích jednotlivých kroků v `data/`.

Sekce **Extra** (pod houbami, jen jako výběr jedné skupiny) má tři skupiny: **Vyhynulá zvířata** (fosilní taxony a vyhynulé druhy živočichů na Wikidatech), **Mikroorganismy** (bakterie, archea, prvoci, rozsivky, mikroskopické zelené řasy, hlenky a další, kořeny v `CLASSES`) a **Vnitřní cizopasníci** (tasemnice, motolice, hlístice, vrtejši, jazyčnatky a strunovci; projdou i preparáty, kresby a lékařské fotky, které pomáhají druh poznat, kromě nahoty; hra před spuštěním kategorie varuje a ptá se, zda pokračovat). Berou druhy i rody, i bez českého jména, a mají přednost: druh, který do nich patří, se zpracuje jen tam a do žádné říše se nepočítá. Seznam členů je v `data/<skupina>/members.json`. Fotky smí být u vyhynulých fosílie, exponáty a rekonstrukce, u mikroorganismů snímky z mikroskopu a vizualizace; tvrzení se získávají stejně jako u ostatních. Mikroorganismy zahrnují i kvasinky a plísně a jako výjimku i obsáhlé články o vyšších taxonech bez článků o druzích (`EXTRA_HIGHER`, např. „Želvuška – Tardigrada spp.“).

Česká jména druhů, které mají jen latinský název článku, se dohledávají zvlášť: subagent je hledá v BioLibu a českých odborných zdrojích, jiný je nezávisle ověří (workflow, kroky `names` a `names_check`). Přijatá jména s odkazem jsou v `data/czech_names/names.json`, zamítnutá s důvodem v `rejected.json`; do hry jdou přes `species.json`.

U živočichů, kteří žijí převážně ve schránce (plži, mlži, svijonožci, ramenonožci), projde i celá schránka nebo zavřený mlž v přírodě; fotky zamítnuté dřív jen kvůli tomu jednorázově znovu posoudí `python pipeline.py shells <skupina>` (úlohy `s_`).

Skupiny ve hře určuje `GAME_GROUPS` podle stromu druhu na Wikidatech. Dvouděložné se dál dělí podle řádu (APG IV) na superrosidy („Příbuzné růžím“), superasteridy („Příbuzné slunečnicím“) a ostatní dvouděložné. Zastaralé nebo chybějící řády z Wikidat nahrazuje `MODERN_ORDERS` a `FAMILY_ORDERS`.

Každý krok zpracuje jen to, co ještě neprošlo. `python pipeline.py next <počet>` vypíše další dávku úloh a řeší přechody mezi kroky. Když už není co dělat, složí `game/data.js`. `python pipeline.py todo <skupina>` ukáže, co ve skupině chybí.

Kroky 2 až 7 kromě hledání fotek provádějí subagenti Claude Code přes workflow `.claude/workflows/poznavani-prirody.js` (argumenty jsou výstup `pipeline.py next`). Mezivýsledky všech kroků jsou v `data/`. Chybí jen náhledy fotek pro kontrolu subagenty (`data/*/thumbs/`, 6,5 GB), které se do GitHubu nevejdou; adresy originálů jsou v `species.json`.

## Zásady obsahu

Jedovaté, psychoaktivní a návykové vlastnosti jsou běžné přírodovědné údaje a hra je uvádí věcně. Neuvádí dávkování ani návody na užití a netvrdí, že je nějaký druh jedlý nebo léčivý. U rostlin a hub zobrazuje upozornění, že neučí sběr ani ochutnávání.

## Zdroje a licence

- **Texty:** česká Wikipedie, u druhů bez použitelného českého článku i jiné jazykové verze Wikipedie, CC BY-SA.
- **Fotky:** Wikimedia Commons. Autor a licence jsou uvedené u každé fotky, u části chybí nebo jsou neúplné, před veřejným nasazením je potřeba je doplnit.
- **Taxonomie:** Wikidata, CC0.
- **Mapa:** Natural Earth, public domain.
