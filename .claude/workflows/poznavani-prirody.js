export const meta = {
  name: 'poznavani-prirody',
  description: 'Subagenti zpracují všechny stažené třídy: fakta a fotky, negativní tvrzení, přísnou kontrolu a kontinenty',
  whenToUse: 'args: {root, batches} z výstupu "pipeline.py next" (spouštěj opakovaně, dokud next nevrátí prázdné batches).',
  phases: [{ title: 'Fakta a fotky' }, { title: 'Další fotky' }, { title: 'Negativní tvrzení' }, { title: 'Přísná kontrola' }, { title: 'Kontinenty' }, { title: 'Jazyk' }],
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

// Fotky živočichů, které dřív zamítlo jen lidské prostředí (zeď, okno, nábytek, město), ačkoli zvíře žilo volně.
const restorePrompt = (slug, kingdom, id) => `Kontroluješ fotky dětského kvízu o přírodě (děti od 10 let). Tyto fotky dřív zamítla kontrola, protože zvíře nebylo v divoké krajině, ale v lidském prostředí (na zdi, okně, nábytku, zábradlí, ve městě nebo na zahradě). To pravidlo bylo příliš přísné: hra nechce jen zvířata v zajetí. Volně žijící zvíře v prostředí, kde jeho druh běžně žije i vedle lidí, je v pořádku.

Přečti ${root}/data/${slug}/review_jobs/${id}.json. Každá položka má "species", "latin", "image" (cesta relativní k ${root}) a "rejected" s původním důvodem zamítnutí. Každou fotku si prohlédni nástrojem Read.
Do "restore_photos" dej fotku, jen pokud splňuje všechno:
- je to ${KIND[kingdom].good} a ukazuje druh "species" ("latin"), vzhled druhu odpovídá;
- není to kresba, sken z knihy, ${KIND[kingdom].bad}, mrtvý nebo poškozený organismus, krev ani nic nevhodného pro děti, a nemá nápis nebo popisek prozrazující druh;
- neplatí, že ${KIND[kingdom].hard};
- zvíře není v zajetí: nesmí platit, že ${KIND[kingdom].captive}.
Kvalitu posuzuj stejně přísně jako dřív, raději žádnou fotku než špatnou. Důvodem k zamítnutí už jen není lidské prostředí kolem volně žijícího zvířete. Když si nejsi jistý, fotku nevracej.

Zapiš nástrojem Write do ${root}/data/${slug}/review/${id}.json jen tento JSON (pole může být prázdné):
{"restore_photos": [{"species_id": "Q1", "i": 0, "why": "krátký důvod"}]}

Jako výsledek vrať jen slovo HOTOVO.`

const factsPrompt = (slug, kingdom, id) =>`Pracuješ na dětské výukové hře o přírodě pro děti od 10 let. Projekt je v adresáři ${root}.

1. Přečti článek z české Wikipedie: ${root}/data/${slug}/articles/${id}.txt
   Hlavička obsahuje název druhu, cílový POČET TVRZENÍ a seznam FOTEK (relativní cesty k ${root}).
2. Prohlédni si každou fotku nástrojem Read a posuď ji. Schval (ok: true) jen ${KIND[kingdom].good} a která vzhledem, názvem souboru i popisem odpovídá tomuto druhu.
   Zamítni (ok: false): ${K(kingdom, 'art')}, ${KIND[kingdom].bad}, jiný druh, fotku se dvěma různými druhy, fotku, kde je hlavní člověk, a fotku s nápisem prozrazujícím název druhu.
   ${WILD(kingdom)}
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
${WILD(kingdom)}

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
Fotku samotného druhu z běžného úhlu, u níž pouze nejde odlišit velmi podobné příbuzné, ponech.${KIND[kingdom].captive ? ' Fotku ze zoo nebo zahrady, která na první pohled vypadá jako z volné přírody, ponech.' : ''}

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
- Vyhynulý druh zařaď tam, kde žil. Domácí nebo pěstovaný druh zařaď tam, kde je běžně chován nebo pěstován.
- Madagaskar patří k AF, Sibiř a Dálný východ k AS, evropská část Ruska k EU, Sumatra, Borneo a Jáva k AS.
- Mořský druh zařaď ke kontinentům, u jejichž pobřeží žije. Kosmopolitní druh dostane všechny, kde opravdu žije (AN jen tehdy, když tam skutečně žije).
- Každý druh musí mít aspoň jeden kód. Nepřiřazuj kontinenty jen podle odhadu z příbuzných.

Zapiš nástrojem Write do ${root}/data/${slug}/continents/${id}.json jen tento JSON s položkou pro každý druh:
{"Q1": ["EU", "AS"], "Q2": ["AF"]}

Jako výsledek vrať jen slovo HOTOVO.`

// Lehký model na čtení jednoho článku; negativní úsudek a kontinenty stojí na širší znalosti, proto silnější model.
// Přísná kontrola běží na výchozím modelu relace.
function run({ slug, kingdom, stage }, id) {
  if (stage === 'facts') return agent(factsPrompt(slug, kingdom, id), { label: `fakta:${slug}:${id}`, phase: 'Fakta a fotky', model: 'haiku' })
  // překlad a výběr z cizího jazyka potřebuje víc než lehký model
  if (stage === 'foreign') return agent(foreignFactsPrompt(slug, kingdom, id), { label: `cizí:${slug}:${id}`, phase: 'Fakta a fotky', model: 'sonnet' })
  if (stage === 'photos') return agent(photosPrompt(slug, kingdom, id), { label: `fotky:${slug}:${id}`, phase: 'Další fotky', model: 'haiku' })
  if (stage === 'negatives') return agent(negativesPrompt(slug, kingdom, id), { label: `neg:${slug}:${id}`, phase: 'Negativní tvrzení', model: 'sonnet' })
  if (stage === 'language') return agent(languagePrompt(slug, id), { label: `jazyk:${slug}:${id}`, phase: 'Jazyk' })
  if (stage === 'continents') return agent(continentsPrompt(slug, id), { label: `kontinenty:${slug}:${id}`, phase: 'Kontinenty', model: 'sonnet' })
  const prompt = id.startsWith('f_') ? factReviewPrompt(slug, id) : id.startsWith('w_') ? wildPrompt(slug, kingdom, id)
    : id.startsWith('h_') ? restorePrompt(slug, kingdom, id) : photoReviewPrompt(slug, kingdom, id)
  return agent(prompt, { label: `kontrola:${slug}:${id}`, phase: 'Přísná kontrola' })
}

// Dávku vybírá hlavní agent přes "pipeline.py next". Pomocný subagent by to neměl dělat: harness mu předává
// poslední zprávu uživatele s vyšší prioritou než zadání, takže by se ji místo příkazu pokusil splnit sám.
const jobs = args.batches.flatMap((batch) => batch.ids.map((id) => [batch, id]))
const results = await parallel(jobs.map(([batch, id]) => () => run(batch, id)))
const failed = jobs.filter((_, i) => !results[i]).map(([batch, id]) => `${batch.slug}:${id}`)
if (failed.length) log(`Nedokončeno: ${failed.join(', ')}`)
return { done: jobs.length - failed.length, failed }
