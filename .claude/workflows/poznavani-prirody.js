export const meta = {
  name: 'poznavani-prirody',
  description: 'Subagenti zpracují všechny stažené třídy: fakta a fotky, negativní tvrzení, přísnou kontrolu a kontinenty',
  whenToUse: 'args: {root, batches} z výstupu "pipeline.py next" (spouštěj opakovaně, dokud next nevrátí prázdné batches).',
  phases: [{ title: 'Fakta a fotky' }, { title: 'Další fotky' }, { title: 'Negativní tvrzení' }, { title: 'Přísná kontrola' }, { title: 'Kontinenty' }, { title: 'Jazyk' }, { title: 'Česká jména' }],
}

const { root } = args

// Co se v promptech liší podle říše.
const KIND = {
  zivocichove: {
    good: 'skutečnou fotografii živého zvířete, které je dobře vidět',
    bad: 'preparát, muzejní exponát, mrtvé nebo zraněné zvíře, lov a trofeje, stopy, snímek z mikroskopu',
    hard: 'zvíře skoro není vidět: je rozmazané, malé, zakryté, ve velmi nízkém rozlišení, ukazuje jen část těla nebo jen nevyvinutá mláďata',
    categories: 'vzhled | potrava | výskyt | chování | mláďata | čísla | vztahy (vztahy = symbióza, parazité, predátoři, soužití s jinými druhy; čísla = měřitelný údaj)',
    bland: 'žádné „Má srst.“, „Vyskytuje se v přírodě.“ ani „Je chráněný zákonem.“',
    shells: 'Výjimka pro živočichy, kteří žijí převážně ve schránce (plži, mlži, svijonožci, ramenonožci): v pořádku je i zavřený mlž a celá nepoškozená schránka tohoto druhu ležící v přírodě (na břehu, v písku, v trávě). Neprojde schránka v muzeu, ve sbírce, v ruce, na stole ani na jednobarevném pozadí.',
    captive: 'zvíře je zjevně v zajetí nebo chované člověkem: je ve výběhu, kleci nebo ohradě, za pletivem nebo mříží, za sklem terária nebo akvária, mezi umělými skalami, betonovými zdmi a dalšími stavbami zoo, u misky s krmením, má obojek nebo vodítko, je v ruce, v bytě chovatele nebo na jednobarevném studiovém pozadí. Volně žijící zvíře v prostředí, kde jeho druh běžně žije i vedle lidí, v zajetí není a je v pořádku: hmyz nebo pavouk na zdi, okně, nábytku či zábradlí, pták na střeše, plotě nebo ve městě, ještěrka na zídce, veverka v parku. Domácí zvíře (pes, kočka, kůň, ovce, skot a podobně) smí být venku na pastvě, na dvoře nebo v krajině, ne však v kleci, v místnosti ani ve studiu',
  },
  rostliny: {
    good: 'skutečnou fotografii živé rostliny nebo její části (celkový vzhled, květ, list, plod, kůra), na které jdou znaky druhu dobře vidět',
    bad: 'herbářovou položku, sušený nebo uřezaný materiál, potraviny a výrobky z rostliny, snímek z mikroskopu, fotku, kde rostlina není hlavní (zahrada, krajina, stavba)',
    hard: 'rostlina skoro není vidět: je rozmazaná, malá, ztracená mezi jinými rostlinami, ve velmi nízkém rozlišení, nebo jsou znaky druhu nerozeznatelné',
    categories: 'vzhled | výskyt | růst | vztahy | čísla | využití (růst = kvetení, opylení, šíření semen, životní cyklus; vztahy = opylovači, symbióza, parazitismus; využití = jen nepotravinové a nelékařské, např. dřevo; čísla = měřitelný údaj)',
    bland: 'žádné „Je to rostlina.“, „Má listy.“, „Roste v přírodě.“ ani „Je chráněná zákonem.“',
    captive: 'rostlina zjevně neroste volně: je v květináči, truhlíku nebo váze, ve skleníku s viditelnou konstrukcí, v místnosti, na trhu nebo v obchodě, má u sebe cedulku či jmenovku z botanické zahrady, nebo převládají stavby, chodníky a upravené záhony. Pěstovaná plodina rostoucí v zemi na poli nebo v zahradě je v pořádku',
  },
  houby: {
    good: 'skutečnou fotografii živé houby ve volné přírodě (plodnice, u lišejníků stélka), na které jdou znaky druhu dobře vidět',
    bad: 'houbu v košíku, na talíři, nakrájenou nebo uvařenou, sušený materiál, snímek z mikroskopu, kultury v misce',
    hard: 'houba skoro není vidět: je rozmazaná, malá, zakrytá, ve velmi nízkém rozlišení, nebo jsou znaky druhu nerozeznatelné',
    categories: 'vzhled | výskyt | růst | vztahy | čísla | jedovatost (růst = kdy a jak plodnice roste; vztahy = symbióza se stromy, parazitismus, rozklad dřeva; jedovatost = jen pokud to článek uvádí; čísla = měřitelný údaj)',
    terms: 'Houby mají třeň, nikdy nepiš stonek (ten mají rostliny).',
    bland: 'žádné „Je to houba.“, „Roste v lese.“ ani „Má klobouk.“',
    captive: 'houba zjevně neroste volně: je v ruce, na stole, v košíku, v misce nebo v obchodě, je to pěstírna nebo substrát v nádobě',
  },
  // Extra: fosílie, exponáty a rekonstrukce jsou u vyhynulých v pořádku, u mikroorganismů snímky z mikroskopu a vizualizace.
  vyhynule: {
    good: 'fotografii fosílie, kostry, otisku nebo muzejního exponátu, věrnou rekonstrukci (malbu, kresbu, model, sochu), u nedávno vyhynulých druhů i dobovou fotografii nebo preparát, na kterých jde zvíře dobře poznat',
    bad: 'časovou osu, srovnání velikosti se siluetami, schéma bez zvířete, celý muzejní sál bez jasného hlavního exponátu',
    art: 'mapu, známku',
    artExample: 'mapa, schéma',
    harm: 'krev, zraněné zvíře, lov nebo cokoli nevhodného pro děti',
    hard: 'zvíře nebo fosílie skoro není vidět: je rozmazané, malé, zakryté nebo ve velmi nízkém rozlišení',
    where: '',
    categories: 'vzhled | potrava | výskyt | chování | čísla | vztahy | vymření (výskyt = kde a kdy žil; vymření = kdy a proč vyhynul; čísla = měřitelný údaj)',
    bland: 'žádné „Je to vyhynulé zvíře.“ ani „Známe ho jen z fosílií.“',
    terms: 'Vyhynulé zvíře popisuj v minulém čase s podmětem „Tento druh“ („Tento druh žil v období křídy.“) nebo slovy, která nezávisí na rodu („Pochází z období křídy.“, „Jeho fosílie se našly v Mongolsku.“).',
  },
  mikroorganismy: {
    good: 'snímek z mikroskopu, fotografii kolonie nebo kultury, grafickou vizualizaci nebo model, které odpovídají tomuto druhu, u hlenek a viditelných řas i běžnou fotografii',
    bad: 'graf, schéma bez organismu, fotku přístroje, laboratoře nebo lidí',
    art: 'mapu, logo, známku',
    artExample: 'mapa, graf',
    hard: 'organismus skoro není vidět: snímek je rozmazaný, přeexponovaný nebo ve velmi nízkém rozlišení',
    where: '',
    categories: 'vzhled | výskyt | potrava | vztahy | čísla | využití | jedovatost (vztahy = symbióza, parazitismus, nemoci, které způsobuje; využití = jen nepotravinové a nelékařské, např. v průmyslu; čísla = měřitelný údaj)',
    bland: 'žádné „Je to mikroorganismus.“, „Je velmi malý.“ ani „Žije skoro všude.“',
    terms: 'Nemoci, které organismus způsobuje, uváděj věcně a bez děsivých podrobností.',
  },
  // Vnitřní cizopasníci nejsou ve volné přírodě vidět a hra před kategorií varuje: rozhoduje, jestli snímek pomáhá druh poznat, ne jestli je hezký.
  endoparaziti: {
    good: 'fotografii nebo snímek z mikroskopu cizopasníka nebo jeho typické části a vývojového stadia (hlavička, článek, larva, vajíčko), preparát, exemplář na podložce nebo v misce, kresbu nebo schéma stavby těla, i lékařskou nebo veterinární fotografii cizopasníka v těle či na těle člověka nebo jiného napadeného živočicha a typických projevů nákazy. Snímek nemusí být hezký, musí pomáhat tento druh poznat',
    bad: 'graf, životní cyklus bez dobře viditelného cizopasníka, fotku přístroje, laboratoře, lidí nebo nákazy, na které cizopasník ani typický projev jeho nákazy nejsou poznat',
    art: 'mapu, logo, známku',
    artExample: 'mapa, graf',
    harm: 'nahotu nebo intimní části těla',
    hard: 'cizopasník skoro není vidět: snímek je rozmazaný, přeexponovaný nebo ve velmi nízkém rozlišení',
    where: '',
    categories: 'vzhled | výskyt | potrava | vztahy | čísla | mláďata (vztahy = hostitelé, nemoci, které způsobuje; mláďata = vajíčka, larvy a vývoj; čísla = měřitelný údaj)',
    bland: 'žádné „Je to cizopasník.“, „Žije v těle hostitele.“ ani „Je nebezpečný.“',
    terms: 'Říkej „cizopasník“ a „cizopasí“. Nemoci a jejich projevy uváděj věcně. Neuváděj léčbu, léky ani dávkování. Hledej zajímavosti: složité životní cykly, mezihostitele, ovlivňování chování hostitele, délku a počet vajíček.',
  },
}
// Běžné fotky přírody nesmí být kresby ani preparáty; u Extra to KIND mění.
const DEFAULTS = {
  art: 'mapu, kresbu, malbu, schéma, sken z knihy, známku',
  artExample: 'kresba, sken z knihy',
  harm: 'mrtvý nebo poškozený organismus, krev, lov nebo cokoli nevhodného pro děti',
  where: ' v přírodě',
}
const K = (kingdom, field) => KIND[kingdom][field] ?? DEFAULTS[field]

// Hra chce jen fotky, které jsou z volné přírody, nebo tak aspoň na první pohled vypadají.
const WILD = (kingdom) => (KIND[kingdom].captive ? `Zamítni i fotku, která nevypadá ani na první pohled jako z volné přírody, protože ${KIND[kingdom].captive}. Fotka ze zoo nebo zahrady, na které to nejde poznat, je v pořádku.` : '')

const wildPrompt = (slug, kingdom, id) => `Kontroluješ fotky dětského kvízu o přírodě. Ve hře mají být jen fotky z volné přírody, nebo aspoň takové, které tak na první pohled vypadají. Ostatní kvality fotek už prošly kontrolou, posuzuj jen prostředí.

Přečti ${root}/data/${slug}/review_jobs/${id}.json a každou fotku ("image", cesta relativní k ${root}) si prohlédni nástrojem Read.
Do "reject_photos" dej každou fotku, kde ${KIND[kingdom].captive}.
Fotku ze zoo, terária nebo zahrady, na které nic z toho není vidět a mohla by být z volné přírody, ponech. Když si nejsi jistý, ponech.

Zapiš nástrojem Write do ${root}/data/${slug}/review/${id}.json jen tento JSON (pole může být prázdné):
{"reject_photos": [{"species_id": "Q1", "i": 0, "why": "krátký důvod"}]}

Jako výsledek vrať jen slovo HOTOVO.`

// Jak vybírat a psát tvrzení: stejné pro český článek i pro cizojazyčné zdroje.
const FACT_RULES = (kingdom) => `Vyber z článku tolik zajímavých pravdivých tvrzení, kolik říká POČET TVRZENÍ (méně, pokud článek víc dobrých nenabízí; raději méně než slabá tvrzení).
   I krátký článek bývá použitelný: stačí jediná konkrétní informace, třeba „Saje krev rybám.“ Jen pokud článek neobsahuje o druhu žádnou informaci, ze které by šla sestavit otázka (např. jen zařazení do systému), nastav "usable": false a "facts": [].
   Vybírej různá témata, ale přednostně vazby na jiné druhy, pokud je článek uvádí: čím se druh živí, kdo ho loví nebo koho loví, kdo ho opyluje nebo co opyluje, na čem parazituje, kdo parazituje na něm, s kým žije v symbióze. Uveď konkrétní druhy nebo skupiny („Housenky žijí na kopřivách.“, „Opylují ho čmeláci.“). Vzhledu dávej menší přednost, jde často uhádnout z fotky. Každé tvrzení musí splňovat:
   - Vychází výhradně z textu článku, nic si nedomýšlej.
   - Krátká jednoduchá věta do 15 slov (nejvýš 130 znaků) přirozenou češtinou, jak by ji napsala dobrá školní učebnice. Drž se slov článku a běžné školní pojmy (bezobratlí, potrava, kořist, býložravec, kopytník, mršina) nenahrazuj opisy. Vynech jen opravdu odborný výraz, kterému by desetileté dítě nerozumělo. Žádná latina.
   - Nevynechávej údaj, na kterém tvrzení stojí: „K obraně používá žahavé chloupky.“, ne „Brání se tím, že z břicha vyčesává chloupky.“
   - Základní ekologické pojmy (symbióza, parazit, predátor, opylovač) jsou v pořádku a jsou lepší než krkolomný opis: „Žije v symbióze se smrky.“, ne „Žije v soužití se smrky.“ ${KIND[kingdom].terms || ''}
   - Nesmí obsahovat název druhu, rodu ani čeledi ani odvozená slova. Musí dávat smysl samostatně, bez znalosti článku a bez slov jako „na rozdíl od příbuzných“.
   - Musí jít použít o jakémkoli druhu bez změny tvaru: začni slovesem v přítomném čase („Dožívá se až 15 let.“), přirozeným podmětem („Mláďata jsou téměř celá bílá.“, „Opylují ho čmeláci.“) nebo slovy „Tento druh“ („Tento druh je aktivní v noci.“). Ne „Tento druh má mláďata, která…“. Nepoužívej tvary závislé na rodu („je velká“, „lovil“).
   - Říká něco konkrétního, čím se druh liší od mnoha jiných: ${KIND[kingdom].bland}
   - Hodí se pro děti: žádné krvavé podrobnosti, detaily páření, lov lidmi ani utrpení.
   - Psychoaktivní, návykové a jedovaté vlastnosti jsou běžné přírodovědné údaje: pokud je článek uvádí, vyber je stejně věcně jako cokoli jiného (kategorie účinky nebo jedovatost). Neuváděj dávkování ani návod na přípravu nebo užití.
   - Bezpečnost: nikdy netvrď, že je druh jedlý, chutný nebo vhodný ke sběru či k jídlu, ani že léčí nebo se užívá jako lék. Dítě by to mohlo zkusit.
   Kategorie: ${KIND[kingdom].categories} | účinky.`

// Česká Wikipedie o druhu nic použitelného nemá: tvrzení z anglického a dalšího cizojazyčného článku, napsaná česky.
const foreignFactsPrompt = (slug, kingdom, id) => `Pracuješ na dětské výukové hře o přírodě pro děti od 10 let. Projekt je v adresáři ${root}.
Česká Wikipedie o tomto druhu nemá použitelné informace, proto vycházíš z jiných jazykových verzí Wikipedie.

1. Přečti ${root}/data/${slug}/foreign/${id}.txt. Hlavička obsahuje český název druhu, latinský název a cílový POČET TVRZENÍ. Pod ní jsou články z jiných Wikipedií, každý začíná řádkem „=== ZDROJ: … ===“. Článkem se dál rozumí tyto zdroje.
2. ${FACT_RULES(kingdom)}
   Tvrzení piš česky, i když je zdroj v jiném jazyce. Překládej věrně, nic nepřidávej ani nezobecňuj. Názvy jiných druhů uveď česky, jen pokud český název spolehlivě znáš, jinak použij obecné české slovo pro skupinu (např. „mravenci“, „duby“).
   U každého tvrzení uveď "quote": DOSLOVNÝ úsek zdrojového textu v PŮVODNÍM jazyce (bez hlavičky), který tvrzení dokládá. Nepřekládej ho a kopíruj přesně, program ho ve zdroji hledá.
3. Zapiš nástrojem Write do souboru ${root}/data/${slug}/foreign_facts/${id}.json tento JSON a nic jiného:
{"usable": true, "facts": [{"text": "česká věta", "quote": "doslovný úsek zdroje", "category": "..."}]}

Jako výsledek vrať jen slovo HOTOVO.`

// Druhý pokus u druhů, kterým přísná kontrola vyřadila všechna tvrzení: autor vidí proč a má víc jazykových verzí.
const foreignMorePrompt = (slug, kingdom, id) => `Pracuješ na dětské výukové hře o přírodě pro děti od 10 let. Projekt je v adresáři ${root}. Tento druh ve hře nemá ani jedno tvrzení, zkoušíš to podruhé.

1. Přečti ${root}/data/${slug}/foreign/${id}.txt: hlavička s názvem, pod ní články z různých Wikipedií, každý začíná řádkem „=== ZDROJ: … ===“.
2. Přečti ${root}/data/${slug}/foreign_more_jobs/${id}.json: "rejected" jsou věty, které kontrola nebo program dřív zamítly, s důvodem. Stejnou chybu neopakuj a takové věty nepiš znovu. „prozrazuje název“ znamená, že věta obsahuje slovo příbuzné českému jménu druhu.
3. ${FACT_RULES(kingdom)}
   Napiš 1 až 3 nové, jasně doložené věty, raději méně a správně. Musí dávat smysl samostatně, bez znalosti článku, a mít podmět nebo slovesný tvar v jednotném čísle. Překládej věrně, nic nepřidávej ani nezobecňuj, pozor na chybný překlad. Lokální údaje a laboratorní pokusy vynech.
   U každé věty uveď "quote": DOSLOVNÝ úsek zdroje v PŮVODNÍM jazyce, program ho ve zdroji hledá.
4. Zapiš nástrojem Write do ${root}/data/${slug}/foreign_more/${id}.json jen tento JSON; když žádný zdroj nic bezpečného nenabízí, je "facts" prázdný seznam:
{"facts": [{"text": "česká věta", "quote": "doslovný úsek zdroje", "category": "..."}]}

Jako výsledek vrať jen slovo HOTOVO.`

// Fotky živočichů zamítnuté podle pravidla, které bylo příliš přísné: h_ lidské prostředí kolem volně žijícího zvířete,
// s_ jen schránka u živočichů, kteří ve schránce žijí.
const RESTORE = {
  h: {
    why: 'protože zvíře nebylo v divoké krajině, ale v lidském prostředí (na zdi, okně, nábytku, zábradlí, ve městě nebo na zahradě). To pravidlo bylo příliš přísné: hra nechce jen zvířata v zajetí. Volně žijící zvíře v prostředí, kde jeho druh běžně žije i vedle lidí, je v pořádku.',
    now: 'lidské prostředí kolem volně žijícího zvířete',
    extra: '',
  },
  s: {
    why: 'protože ukazovaly jen schránku (ulitu, lasturu) nebo zavřeného mlže, ne viditelně živé zvíře. U živočichů, kteří žijí převážně ve schránce (plži, mlži, svijonožci, ramenonožci), je to v pořádku: celá schránka v přírodě dítěti druh dobře ukáže.',
    now: 'to, že je vidět jen schránka nebo zavřený mlž',
    extra: '\n- je to celá nepoškozená schránka (nebo zvíře) v přírodě, ne v muzeu, ve sbírce, v ruce, na stole ani na jednobarevném pozadí, a znaky druhu na ní jdou dobře poznat;',
  },
}
const restorePrompt = (slug, kingdom, id) => { const r = RESTORE[id[0]]; return `Kontroluješ fotky dětského kvízu o přírodě (děti od 10 let). Tyto fotky dřív zamítla kontrola, ${r.why}

Přečti ${root}/data/${slug}/review_jobs/${id}.json. Každá položka má "species", "latin", "image" (cesta relativní k ${root}) a "rejected" s původním důvodem zamítnutí. Každou fotku si prohlédni nástrojem Read.
Do "restore_photos" dej fotku, jen pokud splňuje všechno:
- je to ${KIND[kingdom].good} nebo podle výjimky výše, ukazuje druh "species" ("latin") a vzhled druhu odpovídá;
- není to kresba, sken z knihy, ${KIND[kingdom].bad}, poškozený organismus, krev ani nic nevhodného pro děti, a nemá nápis nebo popisek prozrazující druh;
- neplatí, že ${KIND[kingdom].hard};
- zvíře není v zajetí: nesmí platit, že ${KIND[kingdom].captive};${r.extra}
Kvalitu posuzuj stejně přísně jako dřív, raději žádnou fotku než špatnou. Důvodem k zamítnutí už jen není ${r.now}. Když si nejsi jistý, fotku nevracej.

Zapiš nástrojem Write do ${root}/data/${slug}/review/${id}.json jen tento JSON (pole může být prázdné):
{"restore_photos": [{"species_id": "Q1", "i": 0, "why": "krátký důvod"}]}

Jako výsledek vrať jen slovo HOTOVO.` }

const factsPrompt = (slug, kingdom, id) =>`Pracuješ na dětské výukové hře o přírodě pro děti od 10 let. Projekt je v adresáři ${root}.

1. Přečti článek z české Wikipedie: ${root}/data/${slug}/articles/${id}.txt
   Hlavička obsahuje název druhu, cílový POČET TVRZENÍ a seznam FOTEK (relativní cesty k ${root}).
2. Prohlédni si každou fotku nástrojem Read a posuď ji. Schval (ok: true) jen ${KIND[kingdom].good} a která vzhledem, názvem souboru i popisem odpovídá tomuto druhu.
   Zamítni (ok: false): ${K(kingdom, 'art')}, ${KIND[kingdom].bad}, jiný druh, fotku se dvěma různými druhy, fotku, kde je hlavní člověk, a fotku s nápisem prozrazujícím název druhu.
   ${WILD(kingdom)} ${KIND[kingdom].shells || ''}
3. ${FACT_RULES(kingdom)}
   U každého tvrzení uveď "quote": DOSLOVNÝ úsek textu článku (bez hlavičky), který tvrzení dokládá. Kopíruj přesně, program ho hledá v článku.
4. Zapiš nástrojem Write do souboru ${root}/data/${slug}/facts/${id}.json tento JSON a nic jiného:
{"usable": true, "facts": [{"text": "...", "quote": "...", "category": "..."}], "photos": [{"i": 0, "ok": true, "why": "krátký důvod"}]}
"photos" obsahuje položku pro každou fotku z hlavičky.

Jako výsledek vrať jen slovo HOTOVO.`

const photosPrompt = (slug, kingdom, id) => `Posuzuješ další fotky k dětské výukové hře o přírodě. Fotky pocházejí z kategorie druhu na Wikimedia Commons, takže na nich může být cokoli. Buď stejně přísný jako u ostatních fotek, nároky na kvalitu nesnižuj: raději žádnou fotku než špatnou.

Přečti ${root}/data/${slug}/photo_jobs/${id}.json ("species", "latin" a seznam "photos") a každou fotku ("image", cesta relativní k ${root}) si prohlédni nástrojem Read.
Schval (ok: true) jen ${KIND[kingdom].good} a která vzhledem, názvem souboru i popisem odpovídá tomuto druhu a dobře ukazuje druh${K(kingdom, 'where')}.
Zamítni (ok: false): ${K(kingdom, 'art')}, ${KIND[kingdom].bad}, jiný druh, fotku se dvěma různými druhy, fotku, kde je hlavní člověk, a fotku s nápisem prozrazujícím název druhu. Zamítni i fotku, kde ${KIND[kingdom].hard}.
${WILD(kingdom)} ${KIND[kingdom].shells || ''}

Zapiš nástrojem Write do souboru ${root}/data/${slug}/more_photos/${id}.json jen tento JSON s položkou pro každou fotku:
{"photos": [{"i": 0, "ok": true, "why": "krátký důvod"}]}

Jako výsledek vrať jen slovo HOTOVO.`

const negativesPrompt = (slug, kingdom, id) => `Pracuješ na dětské výukové hře o přírodě. Úkolem je najít, pro které druhy tvrzení s jistotou NEPLATÍ. Podle toho hra sestaví špatné odpovědi, takže omyl by naučil děti nepravdu.

Přečti ${root}/data/${slug}/neg_jobs/${id}.json:
- "facts": tvrzení o druzích (id, species = druh, o kterém platí, text, quote = opora z Wikipedie).
- "candidates": druhy (podle Q-identifikátoru) s názvem, začátkem článku a dalšími známými tvrzeními.

Pro KAŽDÉ tvrzení:
A. Kontrola kvality. Buď přísný: každé tvrzení uvidí dítě a slabých bývá 10–20 %. Nastav "bad": true s krátkým "why", pokud je tvrzení nepravdivé nebo neodpovídá citaci, nedává samo o sobě smysl, je pro desetileté dítě nesrozumitelné, gramaticky chybné nebo krkolomné, prozrazuje druh, je nudně obecné, tvrdí, že je druh jedlý nebo léčí, nebo se nehodí pro děti. Věcné údaje o jedovatosti, psychoaktivních a návykových vlastnostech jsou v pořádku, kvůli tématu je nevyřazuj; vyřaď jen dávkování a návody na užití.
   Příklady k vyřazení: „V roce 2020 žilo 855 jedinců.“ (chybí kde a kdo, údaj rychle zastará), „Zapře se krunýřem, takže ho těžko vytáhnout.“ (chybné sloveso), „Jednou z kořistí jsou myši.“ (nejde o konkrétní rozlišující znak), „Dožívá se až 20 let.“ se správnou citací je v pořádku. Konkrétní vazba na jiné druhy („Opylují ho čmeláci.“, „Loví hlavně hraboše.“) je cenná, kvůli tématu ji nevyřazuj. Opravovat text nesmíš, jen vyřadit.
B. Pro každého kandidáta posuď, zda tvrzení pro něj s jistotou NEPLATÍ, a vypiš takové kandidáty do "false_for".
   Použij profil kandidáta i své biologické znalosti. Zařaď ho jen při naprosté jistotě, že by tvrzení o něm bylo nepravdivé.
   Pokud si nejsi jistý, nezařazuj ho. Pozor na tvrzení, která platí pro celou skupinu, a na číselné údaje a rozsahy, které se mohou překrývat.
   Kandidát, o kterém tvrzení platí nebo ho nelze spolehlivě posoudit, do seznamu nepatří. Seznam může být i prázdný.

Zapiš nástrojem Write do souboru ${root}/data/${slug}/neg/${id}.json tento JSON a nic jiného, s položkou pro každé tvrzení:
{"results": [{"id": "Q1#0", "false_for": ["Q2", "Q3"], "bad": false, "why": ""}]}

Jako výsledek vrať jen slovo HOTOVO.`

const factReviewPrompt = (slug, id) => `Kontroluješ data dětského kvízu o přírodě (děti od 10 let). Omyl naučí děti nepravdu, proto buď přísný a nedůvěřuj předchozím krokům. Cesty jsou relativní k ${root}.

Přečti ${root}/data/${slug}/review_jobs/${id}.json. Každá položka má tvrzení "text" o druhu "species", oporu "quote" z Wikipedie a "claimed_false_for": druhy, o kterých tvrdíme, že pro ně tvrzení s jistotou neplatí. Článek o druhu Qx je v ${root}/data/${slug}/articles/Qx.txt; tvrzení s id ve tvaru „Qx#x…“ vychází z cizojazyčných článků v ${root}/data/${slug}/foreign/Qx.txt a jeho "quote" je v původním jazyce. Zdroj otevři, jen když si nejsi jistý.

1. Tvrzení vyřaď do "drop_facts", pokud platí cokoli z tohoto:
   - odporuje ověřené biologii, i když to Wikipedie uvádí, nebo je sporné (např. nepravděpodobná průměrná délka života, zastaralý údaj);
   - posouvá význam citace: přidává slova jako „hlavně“, „jen“, „až“, „skoro“, vynechává podmínku nebo zaměňuje horní mez za typickou hodnotu;
   - zobecňuje na celý druh, co platí jen pro samce, samice nebo mláďata (např. „Tento druh má dlouhý roh“, když ho mají hlavně samci);
   - nemá jasný podmět (samotné „Mají bílý pruh.“, „Pasou se pomalu.“) nebo nedává smysl bez článku;
   - je krkolomné či gramaticky chybné („Tento druh má samce, kteří…“, „Mládě se kojí“) nebo pro desetileté dítě nesrozumitelné;
   - nepřímo prozrazuje český název druhu (např. „stébla rákosu“ u lemura rákosového);
   - je to neměřitelné tvrzení typu „nejchytřejší“;
   - tvrdí, že je druh jedlý, chutný nebo vhodný ke sběru, nebo že léčí či se užívá jako lék;
   - uvádí dávkování nebo návod na přípravu či užití.
   Věcné údaje o jedovatosti, psychoaktivních a návykových vlastnostech jsou v pořádku, kvůli samotnému tématu je nevyřazuj.
2. U ponechaného tvrzení projdi každý druh v "claimed_false_for". Vypiš ho do "drop_pairs", pokud si nejsi naprosto jistý, že tvrzení pro něj neplatí: tvrzení pro něj platí nebo částečně platí, číselné rozsahy se dotýkají či překrývají (včetně údajů ze zajetí nebo pěstování), nebo vlastnosti druhu dobře neznáš.
   Pozor na složená tvrzení: pokud tvrzení platí jen z části, není s jistotou nepravdivé. Tvrzení, která vyřadíš v bodě 1, v bodě 2 už neřeš.

Zapiš nástrojem Write do ${root}/data/${slug}/review/${id}.json jen tento JSON (pole mohou být prázdná):
{"drop_facts": [{"id": "Q1#0", "why": "krátký důvod"}], "drop_pairs": [{"id": "Q1#0", "species": "Q2"}]}

Jako výsledek vrať jen slovo HOTOVO.`

const photoReviewPrompt = (slug, kingdom, id) => `Kontroluješ fotky dětského kvízu o přírodě (děti od 10 let). Dítě podle nich má poznat druh, proto buď přísný a nedůvěřuj předchozímu schválení.

Přečti ${root}/data/${slug}/review_jobs/${id}.json a každou fotku ("image", cesta relativní k ${root}) si prohlédni nástrojem Read.
Do "reject_photos" dej každou fotku, která:
- není ${KIND[kingdom].good}: např. ${K(kingdom, 'artExample')}, ${KIND[kingdom].bad};
- ukazuje jiný druh, než uvádí "species" a "latin", nebo vzhled druhu zjevně neodpovídá;
- ukazuje ${K(kingdom, 'harm')};
- obsahuje nápis nebo popisek prozrazující druh;
- ${KIND[kingdom].hard}, takže znaky druhu nejde rozeznat;${KIND[kingdom].captive ? `
- nevypadá ani na první pohled jako z volné přírody, protože ${KIND[kingdom].captive}.` : ''}
Fotku samotného druhu z běžného úhlu, u níž pouze nejde odlišit velmi podobné příbuzné, ponech.${KIND[kingdom].captive ? ' Fotku ze zoo nebo zahrady, která na první pohled vypadá jako z volné přírody, ponech.' : ''} ${KIND[kingdom].shells || ''}

Zapiš nástrojem Write do ${root}/data/${slug}/review/${id}.json jen tento JSON (pole může být prázdné):
{"reject_photos": [{"species_id": "Q1", "i": 0, "why": "krátký důvod"}]}

Jako výsledek vrať jen slovo HOTOVO.`

const languagePrompt = (slug, id) => `Jsi jazykový redaktor přírodovědné hry pro děti od 10 let. Věty mají znít přirozeně česky, jako v dobré školní učebnici. Fakta už jsou zkontrolovaná, jejich význam neměň.

Přečti ${root}/data/${slug}/language_jobs/${id}.json. Každá položka má "id", "species" (druh), "text" (věta ve hře) a "quote" (zdroj z Wikipedie). Věty jednoho druhu jsou u sebe.

1. Do "fixes" dej novou podobu věty, jen pokud zní nepřirozeně. Věty v pořádku nevypisuj, většina jich v pořádku je. Typické problémy:
   - zbytečný opis běžného pojmu: „Asi 40 % jeho jídla tvoří živočichové bez páteře.“ -> „Asi 40 % jeho potravy tvoří bezobratlí.“; drž se slov ze zdroje, běžné školní pojmy (bezobratlí, potrava, kořist, býložravec, kopytník, mršina) neopisuj;
   - zbytečné vysvětlování: „Jí hlavně kopytníky, tedy zvířata s kopyty.“ -> „Jí hlavně kopytníky.“; vysvětlení ponech jen u slova, které by desetileté dítě opravdu neznalo (např. „Měří v kohoutku, tedy u ramen, 125 cm.“);
   - krkolomná stavba: „Tento druh má mláďata, která jsou téměř celá bílá.“ nebo „Má mláďata, která jsou bílá.“ -> „Mláďata jsou téměř celá bílá.“;
   - chybná vazba nebo překlep: „Žije v klanech, které bývají od tří do 80 zvířat.“ -> „Žije v klanech po 3 až 80 zvířatech.“; „80%“ jako podstatné jméno -> „80 %“;
   - krkolomný opis místo běžného pojmu: „Žije v soužití se smrky.“ -> „Žije v symbióze se smrky.“ (symbióza, parazit, predátor jsou v pořádku);
   - vynechaný podstatný údaj, který je ve zdroji: „Brání se tím, že z břicha vyčesává chloupky.“ -> „K obraně používá žahavé chloupky.“;
   - u hub „stonek“: houby mají třeň („Třeň je bílý.“).
   Pravidla pro novou větu: stejný význam, žádná nová informace mimo zdroj, nejvýš 130 znaků, žádná latina, žádný název druhu, rodu ani čeledi a odvozená slova. Nesmí záviset na rodu druhu („je velká“, „lovil“): použij sloveso v přítomném čase, přirozený podmět nebo „Tento druh“. Nesmí tvrdit, že je druh jedlý nebo léčí.
2. Do "drop" dej věty, které u téhož druhu říkají totéž co jiná věta, a ponech tu lepší.

Zapiš nástrojem Write do souboru ${root}/data/${slug}/language/${id}.json jen tento JSON (pole mohou být prázdná):
{"fixes": [{"id": "Q1#0", "text": "nová věta"}], "drop": [{"id": "Q1#3"}]}

Jako výsledek vrať jen slovo HOTOVO.`

const continentsPrompt = (slug, id) => `Pro dětský kvíz o přírodě přiřaď každému druhu kontinenty, kde žije.

Přečti ${root}/data/${slug}/continent_jobs/${id}.json. Každá položka má "id", "name", "latin" a "excerpt" z české Wikipedie. Vycházej z výňatku a ze svých biologických znalostí; když si výňatek a znalosti odporují, drž se ověřených znalostí.

Kódy: EU Evropa, AS Asie, AF Afrika, NA Severní Amerika (včetně Střední Ameriky a Karibiku), SA Jižní Amerika, AN Antarktida (včetně okolních subantarktických ostrovů a moří), OC Austrálie a Oceánie (včetně Nového Zélandu a Nové Guineje).
Pravidla:
- Uveď všechny kontinenty, kde druh dnes žije ve volné přírodě, včetně trvale usazených populací zavlečených člověkem.
- Vyhynulý druh zařaď tam, kde žil. Domácí nebo chovaný živočich patří tam, odkud pochází, a tam, kde žije zdivočele ve volné přírodě, ne tam, kde žije jen v zajetí (na farmě, v chovu, doma, v zoo). Rostlina patří do oblasti, když tam 1) roste divoce, 2) je zavlečená a zdivočelá nebo zdomácnělá, nebo 3) se tam běžně pěstuje jako hospodářská rostlina (pole, sady, vinice, lesní hospodářství). Pěstování jen pro okrasu (parky, zahrady, arboreta) nebo pro výzkum nestačí.
- Madagaskar patří k AF, Sibiř a Dálný východ k AS, evropská část Ruska k EU, Sumatra, Borneo a Jáva k AS.
- Mořský druh zařaď ke kontinentům, u jejichž pobřeží žije. Kosmopolitní druh dostane všechny, kde opravdu žije (AN jen tehdy, když tam skutečně žije).
- Každý druh musí mít aspoň jeden kód. Nepřiřazuj kontinenty jen podle odhadu z příbuzných.

Zapiš nástrojem Write do ${root}/data/${slug}/continents/${id}.json jen tento JSON s položkou pro každý druh:
{"Q1": ["EU", "AS"], "Q2": ["AF"]}

Jako výsledek vrať jen slovo HOTOVO.`

// Lehký model na čtení jednoho článku; negativní úsudek a kontinenty stojí na širší znalosti, proto silnější model.
// Přísná kontrola běží na výchozím modelu relace.
// Pojistka pro dávku se špatným id: subagent nesmí vyrobit výstup k úloze, která neexistuje.
const RULE = 'Rostlina patří do oblasti, když tam 1) roste divoce, 2) je zavlečená a zdivočelá nebo zdomácnělá, nebo 3) se tam běžně pěstuje jako hospodářská rostlina (pole, sady, vinice, lesní hospodářství). Pěstování jen pro okrasu (parky, zahrady, arboreta) nebo pro výzkum nestačí.'
const GUARD = '\n\nPokud soubor, který máš podle zadání přečíst (úloha nebo článek), neexistuje, nic nezapisuj a vrať jen slovo CHYBÍ.'
const ask = (prompt, opts) => agent(prompt + GUARD, opts)
const namesPrompt = (id) => `Hledáš ustálená česká jména taxonů pro dětský přírodovědný kvíz. Vědecké jméno ve hře už je, chybí české.

Přečti ${root}/data/czech_names/jobs/${id}.json. Každá položka má "id", "latin", "group" (skupina ve hře), "hints" (popisek a aliasy z Wikidat a přesměrování na české Wikipedii, nemusí být správné) a "lead" (začátek článku).

Pro každou položku ověř nápovědy a hledej dál: BioLib (https://www.biolib.cz/cz/formsearch/?action=execute&searcharea=1&string=<latinské jméno>), vyhledávání na webu (česky, s latinským jménem v uvozovkách) a české odborné zdroje: univerzity, ústavy, muzea, zoologické a botanické zahrady, SZÚ, nemocnice, odborné časopisy, slovníky a encyklopedie. Jen s Wikipedií si nevystačíš, článek jméno často neuvádí. U taxonu, kde po jednom hledání nic nenajdeš (typicky málo známé rody dinosaurů), se nezdržuj a vrať null.

Přijmi jméno jen tehdy, když je v důvěryhodném zdroji doložené pro přesně tento taxon, a uveď ten zdroj.
- Dobré příklady: Saccharomyces cerevisiae = kvasinka pivní, Staphylococcus aureus = zlatý stafylokok, Streptococcus pneumoniae = pneumokok, Pterodactylus = pterodaktyl. Počítá se i ustálené laické jméno: Smilodon = šavlozubý tygr, Megaloceros giganteus = jelen obrovský. Citace musí jméno opravdu obsahovat a spojovat ho s tímto taxonem.
- Počeštěný tvar rodu přijmi, jen když se v českých textech opravdu používá a liší se od latiny víc než velkým písmenem (pterodaktyl ano; „triceratops“ je totéž co Triceratops, tedy null).
- Nikdy si jméno nevymýšlej ani nepřekládej z latiny nebo angličtiny. Strojově přeložené stránky, e-shopy, doplňky stravy a neověřené blogy nestačí.
- Název nemoci, skupiny nebo jiného taxonu není jméno druhu („pneumokoková infekce“ ne). Stejně tak zastaralé synonymum, které dnes nikdo neužívá, není dobrá volba.
- Má-li taxon víc jmen, vyber nejběžnější a ostatní dej do "alt". Jméno piš v 1. pádě jednotného čísla s velkým prvním písmenem.

Zapiš nástrojem Write do ${root}/data/czech_names/found/${id}.json jen tento JSON s položkou pro každé id; když jméno není doložené, hodnota je null:
{"Q1": {"name": "Kvasinka pivní", "alt": ["Kvasinka pekařská"], "url": "https://…", "quote": "krátká doslovná citace ze zdroje s českým jménem"}, "Q2": null}
Vrať jen slovo HOTOVO.`
const namesCheckPrompt = (id) => `Přísně a nezávisle ověř česká jména taxonů pro dětský přírodovědný kvíz. Nevěř kolegovi, který je našel.

Přečti ${root}/data/czech_names/found/${id}.json (id → jméno, alternativy, odkaz a citace, null přeskoč) a ${root}/data/czech_names/jobs/${id}.json (vědecká jména). U každého nalezeného jména otevři odkaz nebo si jméno ověř jiným důvěryhodným českým zdrojem. Zamítni jméno, které:
- ve zdroji není, nebo patří jinému taxonu (vyššímu, nižšímu, příbuznému), případně je to název nemoci nebo skupiny;
- je jen překladem, výmyslem nebo strojovým překladem, případně pochází z nedůvěryhodné stránky;
- se od latiny liší jen velkým písmenem nebo koncovkou a v češtině se běžně neužívá;
- není v 1. pádě jednotného čísla s velkým prvním písmenem. Když je jen špatný tvar, oprav ho v "name" a schval.

Zapiš nástrojem Write do ${root}/data/czech_names/checked/${id}.json jen JSON s položkou pro každé nalezené jméno:
{"Q1": {"ok": true, "name": "Kvasinka pivní", "why": "BioLib i učebnice mikrobiologie"}, "Q2": {"ok": false, "why": "stránka uvádí jiný druh"}}
Vrať jen slovo HOTOVO.`
const pronounPrompt = (id) => `Opravuješ češtinu v dětském přírodovědném kvízu. V některých větách je druh předmětem, ale chybí zájmeno, takže věta nedává smysl.

Přečti ${root}/data/pronoun/jobs/${id}.json. Každá položka má "id", "species" (o tomto druhu věta je), "text" a "quote" (zdroj).

Podle pádů a podle citace rozhodni, kdo koná. Hledej věty, kde koná někdo jiný a druh je předmět bez zájmena:
- „Loví výr velký a tchoř.“ o ježkovi → „Loví ho výr velký a tchoř.“
- „Opylují včely a čmeláci.“ o rostlině → „Opylují ji včely a čmeláci.“
- „Napadá ho“ a „Loví myši.“ (myši jsou kořist druhu) jsou v pořádku, ty neopravuj.

Zájmeno (ho, ji, je) vyber podle rodu českého jména druhu v poli "species", u latinského jména použij „ho“ nebo větu přeformuluj bez zájmena. Zachovej význam i údaje ze zdroje, nic nepřidávej a neopravuj jiné věci. Věty, kde koná sám druh, nech být. Když z citace nejde poznat, kdo koná, větu nech být.

Zapiš nástrojem Write do ${root}/data/pronoun/found/${id}.json jen tento JSON (bez nálezu prázdný seznam):
{"fixes": [{"id": "Q1#0", "text": "Loví ho výr velký a tchoř."}]}
Vrať jen slovo HOTOVO.`
const continentCheckPrompt = (id) => `Kontroluješ kontinenty výskytu živočichů v dětském přírodovědném kvízu. Dřívější pravidlo chybně počítalo i místa, kde druh žije jen v zajetí.

Přečti ${root}/data/continent_check/jobs/${id}.json. Každá položka má "id", "name", "latin" a "continents". Kódy: EU Evropa, AS Asie, AF Afrika, NA Severní Amerika (včetně Střední Ameriky a Karibiku), SA Jižní Amerika, AN Antarktida (včetně okolních subantarktických ostrovů a moří), OC Austrálie a Oceánie (včetně Nového Zélandu a Nové Guineje).

Pravidla:
- Kontinent patří druhu, kde žije ve volné přírodě: původně, nebo jako zavlečená trvale usazená či zdivočelá populace. Zavlečené druhy tam tedy patří (lasice kolčava na Novém Zélandu, buvol domácí v Austrálii) a takový kontinent nemaž.
- Nepatří tam kontinent, kde druh žije jen v zajetí: na farmě, v chovu, doma jako mazlíček, v zoo nebo v akváriu.
- Domácí druh bez divoké populace (morče domácí, lama alpaka, kříženci) si ponechá aspoň kontinent, odkud pochází.
- Vyhynulé druhy tu nejsou. Madagaskar patří k AF, Sibiř k AS, evropská část Ruska k EU, Sumatra, Borneo a Jáva k AS. Mořský druh patří ke kontinentům, u jejichž pobřeží žije.
- Oprav i jinou zjevnou chybu v kontinentech, ale jen když si jsi jistý. Ojedinělý zatoulaný jedinec nestačí. Když si nejsi jistý, položku nech být. Většina položek je v pořádku.

Zapiš nástrojem Write do ${root}/data/continent_check/found/${id}.json jen tento JSON se změněnými položkami. Soubor zapiš vždy, když není co měnit, je "changes" prázdný seznam:
{"changes": [{"id": "Q1", "continents": ["AS"], "why": "krátký důvod: co se změnilo a proč"}]}
Vrať jen slovo HOTOVO.`
const samePrompt = (id) => `Kontroluješ možnosti v dětském přírodovědném kvízu. U otázky „Která věta platí pro tento druh?“ vidí dítě jednu pravdivou větu a tři věty o jiných druzích. Když dvě možnosti říkají v podstatě totéž, působí to hloupě.

Přečti ${root}/data/same_meaning/jobs/${id}.json. Každá položka má "target" (druh), "true" (id vět, které o něm platí) a "sentences" (věty, které se u tohoto druhu můžou v jedné otázce potkat, s "id" a "text").

V každé položce najdi skupiny vět, které mají v podstatě stejný význam, takže kdyby platila jedna, platí i druhá a naopak. Příklady stejného významu:
- „Je to jednoletá rostlina.“ a „Žije jen jeden rok.“
- „Živí se hlavně hmyzem.“ a „Potravu tvoří především hmyz.“
- „Je to noční živočich.“ a „Aktivní je hlavně v noci.“
Nejsou stejné: věty s jinými čísly, měsíci nebo místy („Kvete v květnu.“ a „Kvete v červnu.“), věta obecnější a konkrétnější („Živí se hmyzem.“ a „Živí se mravenci.“) a věty o jiné vlastnosti. Stejná slova nestačí, rozhoduje význam. Většina vět žádný protějšek nemá, nevymýšlej skupiny tam, kde nejsou.

Zapiš nástrojem Write do ${root}/data/same_meaning/found/${id}.json jen tento JSON (bez nálezu prázdný seznam), id ber přesně ze vstupu:
{"groups": [["Q1#0", "Q2#3"]]}
Vrať jen slovo HOTOVO.`
const grammarPrompt = (id) => `Jsi jazykový korektor dětského přírodovědného kvízu. Hledáš jen chyby ve tvarech slov.

Přečti ${root}/data/grammar/jobs/${id}.json. Každá položka má "id", "species" (o tomto druhu věta je) a "text".

Oprav jen skutečné gramatické chyby ve tvarech slov: špatná pádová koncovka („loví noční motýle“ → „loví noční motýly“), shoda podmětu s přísudkem nebo přídavného jména s podstatným (rod, číslo, pád), špatný tvar zájmena a překlep, který mění tvar slova. Řiď se spisovnou češtinou podle Internetové jazykové příručky. Rod druhu poznáš z jeho českého jména ("species").
Neměň nic jiného: slovosled, volbu slov, styl, interpunkci ani obsah. Věta s nezvyklým, ale správným tvarem (například „motýlech“, „ptáky“, „kořisti“) zůstává. Odborné a latinské názvy nech být. Když si nejsi jistý, že jde o chybu, nech větu být. Většina vět je v pořádku.

Zapiš nástrojem Write do ${root}/data/grammar/found/${id}.json jen tento JSON (bez nálezu prázdný seznam):
{"fixes": [{"id": "Q1#0", "text": "Loví hlavně noční motýly a dvoukřídlý hmyz.", "why": "akuzativ plurálu od motýl je motýly"}]}
Vrať jen slovo HOTOVO.`
const czechPrompt = (id) => `Pro dětský kvíz o přírodě rozhodni, které druhy patří do oblasti Česko (Česká republika). Hra v ní ukazuje jen druhy, které tu dítě může potkat.

Přečti ${root}/data/czech_region/jobs/${id}.json. Každá položka má "id", "name", "latin", "group" (skupina ve hře), "continents" a "gbif": počet nálezů v Česku v databázi GBIF bez zoologických a botanických zahrad (null = údaj není). GBIF je jen vodítko: obsahuje i ojedinělé zatoulané jedince a utečence, a u málo sledovaných skupin (houby, hmyz, mikroorganismy) nálezy chybějí, i když druh v Česku žije.

Pravidla (stejná jako u kontinentů):
- Ano, když druh v Česku žije ve volné přírodě: původní, nebo zavlečený, který se tu trvale usadil či zdivočel. U ptáků stačí pravidelné hnízdění, tah nebo zimování, ojedinělý zatoulaný jedinec nestačí.
- Rostlina patří do oblasti, když tam 1) roste divoce, 2) je zavlečená a zdivočelá nebo zdomácnělá, nebo 3) se tam běžně pěstuje jako hospodářská rostlina (pole, sady, vinice, lesní hospodářství). Pěstování jen pro okrasu (parky, zahrady, arboreta) nebo pro výzkum nestačí.
- Ne, když druh žije v Česku jen v zajetí: zoo, chov, akvárium, terárium, domácí mazlíček. Domácí zvíře (kůň, pes) patří tam, kde se běžně chová venku na statcích a pastvinách, stejně jako na kontinenty podle původu a zdivočelých populací.
- Vyhynulé druhy a fosílie: ano, když se jejich fosílie nebo pozůstatky našly na území Česka nebo tu prokazatelně žily.
- Mikroorganismy a cizopasníci: ano, když se v Česku běžně vyskytují (v přírodě, u lidí nebo zvířat).
- Mořské druhy ne, Česko nemá moře.
Když si nejsi jistý, rozhodni podle převažujících znalostí; nevymýšlej výskyt jen podle příbuzných druhů.

Zapiš nástrojem Write do ${root}/data/czech_region/found/${id}.json jen tento JSON s položkou pro každý druh:
{"Q1": true, "Q2": false}
Vrať jen slovo HOTOVO.`
const czechCheckPrompt = (id) => `Nezávisle a přísně ověř zařazení druhů do oblasti Česko v dětském kvízu o přírodě. Kolega rozhodl a jeho úsudek odporuje počtu nálezů v databázi GBIF, proto ho nepřebírej.

Přečti ${root}/data/czech_region/check_jobs/${id}.json. Každá položka má "id", "name", "latin", "group", "gbif" (počet nálezů v Česku bez zoo a botanických zahrad, null = údaj není) a "first" (původní rozhodnutí). Ověř si výskyt i na webu (BioLib, Pladias, AOPK, ČSO, Česká mykologická společnost, odborné zdroje).

Pravidla: ano, když druh v Česku žije ve volné přírodě (původní, nebo trvale usazený či zdivočelý zavlečený), u ptáků pravidelně hnízdí, táhne nebo zimuje (i v malém počtu); Rostlina patří do oblasti, když tam 1) roste divoce, 2) je zavlečená a zdivočelá nebo zdomácnělá, nebo 3) se tam běžně pěstuje jako hospodářská rostlina (pole, sady, vinice, lesní hospodářství). Pěstování jen pro okrasu (parky, zahrady, arboreta) nebo pro výzkum nestačí. Ne u ojedinělých zatoulanců, utečenců ze zajetí, druhů jen v zajetí, pokojových a skleníkových rostlin a mořských druhů. Vyhynulé druhy: ano, když se v Česku našly jejich fosílie. Mikroorganismy a cizopasníci: ano, když se v Česku běžně vyskytují. U málo sledovaných skupin (houby, hmyz, mikroorganismy) chybějící nález v GBIF neznamená, že druh v Česku není.

Zapiš nástrojem Write do ${root}/data/czech_region/checked/${id}.json jen tento JSON s položkou pro každý druh:
{"Q1": {"cz": true, "why": "krátký důvod se zdrojem"}, "Q2": {"cz": false, "why": "…"}}
Vrať jen slovo HOTOVO.`
const czechPlantPrompt = (id) => `Přísně ověř, které rostliny patří do oblasti Česko v dětském kvízu o přírodě. Dosavadní zařazení bylo moc volné (do Česka se dostal sekvojovec jen z parků) a některé druhy chyběly (leknín bělostný).

Přečti ${root}/data/czech_region/plant_jobs/${id}.json. Každá položka má "id", "name", "latin", "gbif" (počet nálezů v Česku v GBIF bez botanických zahrad, null = údaj není) a "now" (dosavadní rozhodnutí).

Pravidlo: ${RULE}
Zdroje: česká Wikipedie, Pladias (databáze české flóry), BioLib; když nejsou jasné, pozorování na iNaturalist z Česka (https://www.inaturalist.org/observations?place_id=8264&taxon_name=<latinské jméno>, pozorování označená jako pěstovaná se nepočítají). Původní i zdomácnělé druhy české květeny jsou ano, i když jsou vzácné.

Zapiš nástrojem Write do ${root}/data/czech_region/plant_checked/${id}.json jen tento JSON s položkou pro každý druh:
{"Q1": {"cz": true, "why": "krátký důvod se zdrojem"}, "Q2": {"cz": false, "why": "…"}}
Vrať jen slovo HOTOVO.`
const plantRegionsPrompt = (id) => `Přísně ověř kontinenty výskytu rostlin v dětském kvízu o přírodě. Dosavadní pravidlo počítalo i místa, kde se druh pěstuje jen pro okrasu.

Přečti ${root}/data/plant_regions/jobs/${id}.json. Každá položka má "id", "name", "latin" a "continents" (dosavadní kódy). Kódy: EU Evropa, AS Asie, AF Afrika, NA Severní Amerika (včetně Střední Ameriky a Karibiku), SA Jižní Amerika, AN Antarktida, OC Austrálie a Oceánie (včetně Nového Zélandu a Nové Guineje).

Pravidlo: ${RULE}
Ověř si to v Plants of the World Online (POWO, původní a zavlečený výskyt), na Wikipedii a v dalších odborných zdrojích. Každý druh musí mít aspoň jeden kód (kde je původní).

Zapiš nástrojem Write do ${root}/data/plant_regions/found/${id}.json jen tento JSON s položkou pro každý druh:
{"Q1": {"continents": ["NA"], "why": "krátký důvod se zdrojem"}}
Vrať jen slovo HOTOVO.`
function run({ slug, kingdom, stage }, id) {
  if (stage === 'czech_plants') return ask(czechPlantPrompt(id), { label: `česko rostliny:${id}`, phase: 'Kontinenty' })
  if (stage === 'plant_regions') return ask(plantRegionsPrompt(id), { label: `kontinenty rostlin:${id}`, phase: 'Kontinenty' })
  if (stage === 'czech_check') return ask(czechCheckPrompt(id), { label: `ověření česka:${id}`, phase: 'Kontinenty' })
  if (stage === 'czech') return ask(czechPrompt(id), { label: `česko:${id}`, phase: 'Kontinenty', model: 'sonnet' })
  if (stage === 'grammar') return ask(grammarPrompt(id), { label: `gramatika:${id}`, phase: 'Jazyk', model: 'sonnet' })
  if (stage === 'same') return ask(samePrompt(id), { label: `stejný význam:${id}`, phase: 'Jazyk', model: 'sonnet' })
  if (stage === 'continents_check') return ask(continentCheckPrompt(id), { label: `kontrola kontinentů:${id}`, phase: 'Kontinenty', model: 'sonnet' })
  if (stage === 'foreign_more') return ask(foreignMorePrompt(slug, kingdom, id), { label: `cizí 2:${slug}:${id}`, phase: 'Fakta a fotky' })
  if (stage === 'pronoun') return ask(pronounPrompt(id), { label: `zájmena:${id}`, phase: 'Jazyk', model: 'sonnet' })
  if (stage === 'names')return ask(namesPrompt(id), { label: `jména:${id}`, phase: 'Česká jména', model: 'sonnet' })
  if (stage === 'names_check') return ask(namesCheckPrompt(id), { label: `ověření jmen:${id}`, phase: 'Česká jména' })
  if (stage === 'facts') return ask(factsPrompt(slug, kingdom, id), { label: `fakta:${slug}:${id}`, phase: 'Fakta a fotky', model: 'haiku' })
  // překlad a výběr z cizího jazyka potřebuje víc než lehký model
  if (stage === 'foreign') return ask(foreignFactsPrompt(slug, kingdom, id), { label: `cizí:${slug}:${id}`, phase: 'Fakta a fotky', model: 'sonnet' })
  if (stage === 'photos') return ask(photosPrompt(slug, kingdom, id), { label: `fotky:${slug}:${id}`, phase: 'Další fotky', model: 'haiku' })
  if (stage === 'negatives') return ask(negativesPrompt(slug, kingdom, id), { label: `neg:${slug}:${id}`, phase: 'Negativní tvrzení', model: 'sonnet' })
  if (stage === 'language') return ask(languagePrompt(slug, id), { label: `jazyk:${slug}:${id}`, phase: 'Jazyk' })
  if (stage === 'continents') return ask(continentsPrompt(slug, id), { label: `kontinenty:${slug}:${id}`, phase: 'Kontinenty', model: 'sonnet' })
  const prompt = id.startsWith('f_') ? factReviewPrompt(slug, id) : id.startsWith('w_') ? wildPrompt(slug, kingdom, id)
    : id.startsWith('h_') || id.startsWith('s_') ? restorePrompt(slug, kingdom, id) : photoReviewPrompt(slug, kingdom, id)
  return ask(prompt, { label: `kontrola:${slug}:${id}`, phase: 'Přísná kontrola' })
}

// Dávku vybírá hlavní agent přes "pipeline.py next". Pomocný subagent by to neměl dělat: harness mu předává
// poslední zprávu uživatele s vyšší prioritou než zadání, takže by se ji místo příkazu pokusil splnit sám.
const jobs = args.batches.flatMap((batch) => batch.ids.map((id) => [batch, id]))
const results = await parallel(jobs.map(([batch, id]) => () => run(batch, id)))
const failed = jobs.filter((_, i) => !results[i]).map(([batch, id]) => `${batch.slug}:${id}`)
if (failed.length) log(`Nedokončeno: ${failed.join(', ')}`)
return { done: jobs.length - failed.length, failed }
