# Poznávání přírody

Přírodovědný kvíz pro děti od 10 let. Učí poznávat živočichy, rostliny a houby podle fotek a dozvědět se o nich něco zajímavého. Texty vycházejí z české Wikipedie.

## Hraní

Otevři `game/index.html` v prohlížeči, server není potřeba. Fotky se načítají z Wikimedia Commons, takže je potřeba internet.

Celá hra v jednom souboru, který jde poslat dál, je `dist/poznavani_prirody.html`. Skládá ho `node build.js` (skripty a data vloží do stránky a zhustí přes esbuild) a pre-commit hook ho před každým commitem přestaví a přidá. V novém klonu je jednou potřeba `npm install && git config core.hooksPath .githooks`.

- **Výběr:** říše, kontinenty na mapě a obtížnost. Obtížnost určuje, na které druhy se hra ptá: Začátečník jen na nejznámější, Pokročilý (výchozí) na známější, Znalec na všechny. Špatné odpovědi jsou vždy z celé třídy, u začátečníka z jiných řádů, u pokročilého ze stejného řádu a jiné čeledi, u znalce nejbližší příbuzní.
- **Otázky:** najít druh na fotkách, určit druh na fotce, vybrat větu, která pro druh platí, a vybrat druh, pro který věta platí.
- **Po odpovědi:** vyhodnocení, zajímavost, kontinenty výskytu, odkaz na Wikipedii a autor fotky.
- **Na konci kola:** přehled druhů a možnost zopakovat si chyby.

## Struktura

| Soubor | Účel |
|---|---|
| `game/index.html` | rozhraní hry |
| `game/quiz.js` | losování otázek |
| `game/data.js` | vygenerovaná databáze druhů, odsazená pro ruční čtení (při kompilaci se odsazení odstraní); ruční úpravy přepíše další běh `pipeline.py`, trvalé opravy patří do `manual.json` v `data/` |
| `game/map.js` | zjednodušená mapa kontinentů |
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
3. **Další fotky:** `python pipeline.py photos <skupina>` najde druhům s méně než dvěma schválenými fotkami další na Wikimedia Commons a subagent je posoudí stejně přísně. `fill` doplní každému druhu kandidáty až do deseti schválených fotek. Všechny kontroly fotek berou jen snímky, které aspoň na první pohled vypadají jako z volné přírody: zvíře ve výběhu, za pletivem nebo v ruce a rostlina v květináči neprojdou. Volně žijící živočich v lidském prostředí (vosa na židli, pták na střeše) projde; fotky, které dřív zamítlo jen takové prostředí, jednorázově znovu posoudí `python pipeline.py human <skupina>`.
3a. **Cizojazyčné zdroje:** `python pipeline.py foreign <skupina>` stáhne druhům bez jediného tvrzení anglický článek a nejdelší článek v dalším jazyce (bývá tam, kde je druh doma). Subagent z nich vybere tvrzení podle stejných pravidel a napíše je česky, citace zůstává v původním jazyce. Kde nic použitelného není, druh zůstane jen pro otázky s fotkou.
4. **Negativní tvrzení:** subagent určí, pro které druhy tvrzení s jistotou neplatí. Z toho vznikají špatné odpovědi. Druhy s méně než třemi takovými tvrzeními se posoudí ještě vůči dalším tvrzením ze třídy (úlohy `need_`, nejvýš dvě kola).
5. **Přísná kontrola:** silnější model znovu projde tvrzení, negativní úsudky a fotky.
6. **Kontinenty:** subagent přiřadí druhům kontinenty výskytu.
7. **Jazyk:** redaktor opraví nepřirozené věty a vyřadí věty, které u druhu říkají totéž. Oprava musí projít stejnými pravidly jako původní věta.

Savci navíc procházejí negativním krokem vůči podobným druhům z užší skupiny (`MAMMAL_PEERS` v `pipeline.py`), hra z nich bere špatné odpovědi. Ruční opravy jsou v `manual.json` v adresářích jednotlivých kroků v `data/`.

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
