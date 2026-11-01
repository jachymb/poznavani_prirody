# Poznávání přírody

Přírodovědný kvíz pro děti od 10 let. Učí poznávat živočichy, rostliny a houby podle fotek a dozvědět se o nich něco zajímavého. Texty vycházejí z české Wikipedie.

## Hraní

Otevři `game/index.html` v prohlížeči, server není potřeba. Fotky se načítají z Wikimedia Commons, takže je potřeba internet.

- **Výběr:** říše, kontinenty na mapě a obtížnost. Začátečník dostává nejznámější druhy a špatné odpovědi z jiných řádů, Pokročilý (výchozí) známější a odlišnější druhy, Znalec všechny druhy a jejich blízké příbuzné.
- **Otázky:** najít druh na fotkách, určit druh na fotce, vybrat větu, která pro druh platí, a vybrat druh, pro který věta platí.
- **Po odpovědi:** vyhodnocení, zajímavost, kontinenty výskytu, odkaz na Wikipedii a autor fotky.
- **Na konci kola:** přehled druhů a možnost zopakovat si chyby.

## Struktura

| Soubor | Účel |
|---|---|
| `game/index.html` | rozhraní hry |
| `game/quiz.js` | losování otázek |
| `game/data.js` | vygenerovaná databáze druhů |
| `game/map.js` | zjednodušená mapa kontinentů |
| `game/quiz_check.js` | test losování nad skutečnou databází |
| `pipeline.py` | příprava dat, jen standardní knihovna Pythonu |

Test: `node game/quiz_check.js`

## Příprava dat

Každá skupina druhů v `CLASSES` v `pipeline.py` prochází těmito kroky:

1. **Stažení:** `python pipeline.py fetch <skupina>` stáhne z Wikidat a české Wikipedie druhy s článkem a jejich fotky do `data/<skupina>/`. Přidává jen nové druhy a přerušené stahování naváže. Nastav `WIKIMEDIA_CONTACT` na svůj kontakt, Wikimedia pak povoluje 200 požadavků za minutu místo 10.
2. **Fakta a fotky:** subagent z článku vybere tvrzení s doslovnou citací a posoudí fotky. O použitelnosti rozhoduje on, ne šablona Pahýl: článek vyřadí, jen když neobsahuje žádnou informaci vhodnou pro otázku.
3. **Další fotky:** `python pipeline.py photos <skupina>` najde druhům s méně než dvěma schválenými fotkami další na Wikimedia Commons a subagent je posoudí stejně přísně. `fill` doplní každému druhu kandidáty až do deseti schválených fotek. Všechny kontroly fotek berou jen snímky, které aspoň na první pohled vypadají jako z volné přírody: zvíře ve výběhu, za pletivem nebo v ruce a rostlina v květináči neprojdou.
4. **Negativní tvrzení:** subagent určí, pro které druhy tvrzení s jistotou neplatí. Z toho vznikají špatné odpovědi.
5. **Přísná kontrola:** silnější model znovu projde tvrzení, negativní úsudky a fotky.
6. **Kontinenty:** subagent přiřadí druhům kontinenty výskytu.
7. **Jazyk:** redaktor opraví nepřirozené věty a vyřadí věty, které u druhu říkají totéž. Oprava musí projít stejnými pravidly jako původní věta.

Savci navíc procházejí negativním krokem vůči podobným druhům z užší skupiny (`MAMMAL_PEERS` v `pipeline.py`), hra z nich bere špatné odpovědi. Ruční opravy jsou v `manual.json` v adresářích jednotlivých kroků v `data/`.

Každý krok zpracuje jen to, co ještě neprošlo. `python pipeline.py next <počet>` vypíše další dávku úloh a řeší přechody mezi kroky. Když už není co dělat, složí `game/data.js`. `python pipeline.py todo <skupina>` ukáže, co ve skupině chybí.

Kroky 2 až 7 kromě hledání fotek provádějí subagenti Claude Code přes lokální workflow, které není součástí repozitáře. Stejně tak v něm nejsou stažená data z adresáře `data/`, takže samotný `pipeline.py` databázi znovu nevytvoří.

## Zásady obsahu

Jedovaté, psychoaktivní a návykové vlastnosti jsou běžné přírodovědné údaje a hra je uvádí věcně. Neuvádí dávkování ani návody na užití a netvrdí, že je nějaký druh jedlý nebo léčivý. U rostlin a hub zobrazuje upozornění, že neučí sběr ani ochutnávání.

## Zdroje a licence

- **Texty:** česká Wikipedie, CC BY-SA.
- **Fotky:** Wikimedia Commons. Autor a licence jsou uvedené u každé fotky, u části chybí nebo jsou neúplné, před veřejným nasazením je potřeba je doplnit.
- **Taxonomie:** Wikidata, CC0.
- **Mapa:** Natural Earth, public domain.
