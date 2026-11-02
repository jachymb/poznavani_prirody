"""Datová pipeline hry Poznávání přírody (jen standardní knihovna).

  python pipeline.py fetch savci   # Wikidata + česká Wikipedie -> data/savci/; přidává jen nové druhy, po přerušení naváže
  python pipeline.py photos savci  # druhům s méně než 2 schválenými fotkami najde další na Wikimedia Commons
  python pipeline.py next 900      # další dávka úloh pro workflow; přechody mezi kroky řeší sám, nakonec složí game/data.js
  python pipeline.py todo savci    # co ještě chybí v jednotlivých krocích workflow

Kroky jedné třídy: fakta a fotky -> další fotky -> negativní tvrzení -> přísná kontrola -> kontinenty.
Každý krok zpracuje jen to, co ještě neprošlo, hotové výsledky zůstávají.
Novou třídu přidáš jedním řádkem do CLASSES.
"""
import contextlib, functools, html, http.client, json, math, os, random, re, sys, textwrap, time, urllib.error, urllib.parse, urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from species_emoji import species_emoji

ROOT = Path(__file__).parent
ROOTS_FILE = ROOT / "data" / "species_roots.json"
# Wikimedia dává bez kontaktu 10 požadavků za minutu, s kontaktem 200: nastav WIKIMEDIA_CONTACT
UA = {"User-Agent": f"PoznavaniPrirody/0.1 (educational quiz; {os.environ.get('WIKIMEDIA_CONTACT', 'no contact')})"}
# slug: (Wikidata QID třídy, případně víc QID oddělených mezerou, český název, říše)
CLASSES = {
    "savci": ("Q7377", "Savci", "zivocichove"),
    "jehlicnany": ("Q1329304", "Jehličnany", "rostliny"),
    "stopkovytrusne": ("Q27720", "Stopkovýtrusé houby", "houby"),
    # Pořadí je důležité: druh zpracuje první skupina, která ho obsahuje (ptáci jsou na Wikidatech i v plazech).
    # Malé třídy jsou sloučené, méně než 4 druhy nedají otázku.
    # Vynechané jsou převážně mikroskopické skupiny (hlístice, klanonožci, kvasinky).
    "vreckovytrusne": ("Q843232 Q133607 Q133551 Q132180 Q132159 Q133144 Q5066753 Q10504037", "Vřeckovýtrusé houby", "houby"),
    "lisejniky": ("Q133571", "Lišejníky", "houby"),
    "rzi_sneti": ("Q132006 Q132763 Q136810", "Rzi a sněti", "houby"),
    "vyssi_dvoudelozne": ("Q165468 Q1372246 Q8316", "Vyšší dvouděložné", "rostliny"),
    "jednodelozne": ("Q78961 Q1147601 Q14847257", "Jednoděložné", "rostliny"),
    "nizsi_dvoudelozne": ("Q846071 Q27421 Q21788 Q689001 Q1307404 Q11818414 Q1045795 Q2716692 Q2946383", "Nižší dvouděložné", "rostliny"),
    "nahosemenne": ("Q5605610 Q9849989 Q16050271 Q10788836 Q99057636 Q1011212 Q16113844", "Cykasy a další nahosemenné", "rostliny"),
    "kapradiny": ("Q373615 Q30085022 Q98970040", "Kapradiny", "rostliny"),
    "mechorosty": ("Q831482 Q642852 Q1422487 Q147868 Q149843 Q14923875 Q12971805 Q12207651", "Mechorosty", "rostliny"),
    "plavune": ("Q1149748 Q1096274", "Plavuně", "rostliny"),
    "presliky": ("Q134677", "Přesličky a další výtrusné", "rostliny"),
    "rasy": ("Q132139 Q132016 Q132609", "Zelené řasy a parožnatky", "rostliny"),
    "ptaci": ("Q5113", "Ptáci", "zivocichove"),
    "plazi": ("Q10811", "Plazi", "zivocichove"),
    "obojzivelnici": ("Q10908", "Obojživelníci", "zivocichove"),
    "ryby": ("Q343460 Q204861 Q22109932 Q21286786 Q857497 Q61881941 Q61881939 Q51290695 Q61881938 Q15100334 Q20722244 Q152", "Ryby", "zivocichove"),
    "paryby": ("Q25371 Q149104", "Paryby", "zivocichove"),
    "pavoukovci": ("Q1358 Q19430", "Pavoukovci", "zivocichove"),
    "mekkysi": ("Q4867740 Q25368 Q128257 Q188906", "Měkkýši", "zivocichove"),
    "korysi": ("Q182978 Q188360 Q150628 Q22986461", "Korýši", "zivocichove"),
    "zahavci": ("Q181989 Q272388 Q132674 Q132680 Q273179 Q16006458", "Žahavci", "zivocichove"),
    "ostnokozci": ("Q25349 Q83483 Q127470 Q248530", "Ostnokožci", "zivocichove"),
    "krouzkovci": ("Q18952 Q193006 Q839350", "Kroužkovci", "zivocichove"),
    "plostenci": ("Q159715 Q207547", "Ploštěnci", "zivocichove"),
    "stonozkovci": ("Q167367 Q43447", "Stonožkovci a mnohonožky", "zivocichove"),
    "ostatni_bezobratli": ("Q190090 Q610887 Q209924 Q190701", "Další bezobratlí", "zivocichove"),
    "hmyz": ("Q1390", "Hmyz", "zivocichove"),
    # Poslední: co nepatří výše. Slouží jen k uložení dat, skupiny ve hře určuje GAME_GROUPS.
    "ostatni_zivocichove": ("Q729", "Ostatní živočichové", "zivocichove"),
    "ostatni_rostliny": ("Q756", "Ostatní rostliny", "rostliny"),
    "ostatni_houby": ("Q764", "Ostatní houby", "houby"),
    # Sekce Extra: druhy i rody, i bez českého jména. Má přednost před ostatními skupinami a do žádné říše se nepočítá.
    "vyhynula_zvirata": ("", "Vyhynulá zvířata", "vyhynule"),
    "mikroorganismy": ("Q10876 Q10872 Q137323 Q473809 Q5368723 Q499091 Q11299399 Q21588562 Q129012 Q180148 Q5194 Q190115 Q144474 Q132609 Q1151744",
                       "Mikroorganismy", "mikroorganismy"),
}
EXTRA = {"vyhynula_zvirata", "mikroorganismy"}
EXTRA_EXCLUDE = {"Q184573"}  # hnědé řasy patří do SAR, ale mikroskopické nejsou
EXTRA_EXCLUDE_IDS = {"Q1738729"}  # urnička pohárová je houba, Wikidata ji chybně řadí mezi prvoky
EXTINCT = "Q23038290 Q237350"  # fosilní taxon (P31), vyhynulý (P141)
EXTRA_RANKS = "wd:Q7432 wd:Q34740"  # druh, rod: dinosauři a mnoho mikroorganismů mají český článek jen o rodu
# Skupiny ve hře: smí obsahovat jen druhy, které do taxonu opravdu patří, podle jejich stromu na Wikidatech.
# Druh dostane první skupinu, pod kterou patří (ptáci jsou na Wikidatech i v plazech).
# Co nikam nepatří nebo by zůstalo ve skupině s příliš málo druhy, jde do souhrnné skupiny OTHER_GROUPS.
GAME_GROUPS = {
    "savci": ("Q7377", "Savci", "zivocichove"),
    "ptaci": ("Q5113", "Ptáci", "zivocichove"),
    "plazi": ("Q10811", "Plazi", "zivocichove"),
    "obojzivelnici": ("Q10908", "Obojživelníci", "zivocichove"),
    "ryby": ("Q343460 Q204861 Q61881941 Q61881939 Q51290695 Q61881938", "Ryby", "zivocichove"),
    "paryby": ("Q25371 Q149104", "Paryby", "zivocichove"),
    "hmyz": ("Q1390", "Hmyz", "zivocichove"),
    "pavoukovci": ("Q1358", "Pavoukovci", "zivocichove"),
    "mekkysi": ("Q4867740 Q25368 Q128257 Q188906", "Měkkýši", "zivocichove"),
    "korysi": ("Q182978 Q188360 Q150628 Q22986461", "Korýši", "zivocichove"),
    "plostenci": ("Q159715 Q207547", "Ploštěnci", "zivocichove"),
    "nahosemenne": ("Q5605610 Q10788836 Q99057636 Q1011212 Q16113844 Q1329304 Q9849989 Q16050271", "Nahosemenné", "rostliny"),
    # jednoděložné před dvouděložnými: některé spadají na Wikidatech i pod kořeny nižších dvouděložných
    "jednodelozne": ("Q78961 Q1147601 Q14847257", "Jednoděložné", "rostliny"),
    "dvoudelozne": ("Q165468 Q1372246 Q846071 Q27421 Q21788 Q689001 Q1307404 Q11818414 Q1045795 Q2716692 Q2946383", "Dvouděložné", "rostliny"),
    "vytrusne": ("Q373615 Q30085022 Q98970040 Q1149748 Q1096274 Q831482 Q642852 Q1422487 Q147868 Q149843 Q14923875 Q12971805 Q12207651",
                 "Výtrusné rostliny", "rostliny"),
    "stopkovytrusne": ("Q27720 Q132006 Q132763 Q136810", "Stopkovýtrusé houby", "houby"),
    "vreckovytrusne": ("Q843232 Q133607 Q133551 Q132180 Q132159 Q133144 Q5066753 Q10504037 Q133571", "Vřeckovýtrusé houby", "houby"),
}
# Dvouděložné jsou ve hře rozdělené podle řádu (APG IV) na superrosidy, superasteridy a zbytek (bazální krytosemenné,
# magnoliidy, bazální dvouděložné). Řády jsou české i latinské, jak je vrací Wikidata.
DICOT_GROUPS = {"rosidy": "Příbuzné růžím", "asteridy": "Příbuzné slunečnicím", "ostatni_dvoudelozne": "Ostatní dvouděložné"}
SUPERROSIDS = {
    "lomikamenotvaré", "révotvaré", "kacibotvaré", "bobotvaré", "růžotvaré", "bukotvaré", "tykvotvaré", "jesencotvaré", "šťavelotvaré",
    "malpighiotvaré", "kakostotvaré", "myrtotvaré", "mýdelníkotvaré", "slézotvaré", "brukvotvaré",
    "Saxifragales", "Vitales", "Zygophyllales", "Fabales", "Rosales", "Fagales", "Cucurbitales", "Celastrales", "Oxalidales", "Malpighiales",
    "Geraniales", "Myrtales", "Crossosomatales", "Picramniales", "Huerteales", "Sapindales", "Malvales", "Brassicales",
}
SUPERASTERIDS = {
    "santálotvaré", "hvozdíkotvaré", "dřínotvaré", "vřesovcotvaré", "garyotvaré", "hořcotvaré", "brutnákotvaré", "lilkotvaré", "hluchavkotvaré",
    "cesmínotvaré", "hvězdnicotvaré", "štětkotvaré", "miříkotvaré",
    "Berberidopsidales", "Santalales", "Caryophyllales", "Cornales", "Ericales", "Icacinales", "Metteniusales", "Garryales", "Gentianales",
    "Boraginales", "Vahliales", "Solanales", "Lamiales", "Aquifoliales", "Asterales", "Escalloniales", "Bruniales", "Paracryphiales",
    "Dipsacales", "Apiales",
}
# Zastaralé řády z Wikidat na řády podle APG IV a PPG I; podle čeledi tam, kde starý řád zahrnoval víc dnešních.
MODERN_ORDERS = {
    "Ebenales": "vřesovcotvaré", "Cardiopteridales": "cesmínotvaré", "Boraginales": "brutnákotvaré", "Vitales": "révotvaré",
    "Amaryllidales": "chřestotvaré", "Aspleniales": "osladičotvaré", "Parkeriales": "osladičotvaré", "Leucodontales": "rokytotvaré",
}
FAMILY_ORDERS = {
    "stružkovcovité": "brutnákotvaré", "dileniovité": "dileniotvaré",
    # Wikidata u těchto čeledí řád neuvádí
    "plovatkovití": "Hygrophila", "okružákovití": "Hygrophila", "Acroloxidae": "Hygrophila", "Rhizocarpaceae": "Rhizocarpales",
    "pijavkovití": "Arhynchobdellida",
}


def modern_order(order, family):
    return FAMILY_ORDERS.get(family) or MODERN_ORDERS.get(order, order)


def dicot_group(order):
    return "rosidy" if order in SUPERROSIDS else "asteridy" if order in SUPERASTERIDS else "ostatni_dvoudelozne"


# Latinský název, který se při stahování z Wikidat nepodařilo získat; podle české Wikipedie.
LATIN_NAMES = {"Q1394001": "Correlophus ciliatus"}
# Řády kostnatých ryb, které na Wikidatech nejsou napojené na kořeny skupiny Ryby (tresky, parmice).
ORDERS_OF_FISH = {"hrdloploutví", "Mulliformes"}
OTHER_GROUPS = {"zivocichove": ("ostatni_zivocichove", "Ostatní živočichové"), "rostliny": ("ostatni_rostliny", "Ostatní rostliny"), "houby": ("ostatni_houby", "Ostatní houby")}
# Savci jsou tak různorodí, že špatná odpověď z celé třídy (delfín u kočky) nic neprověří, proto se porovnávají v užší skupině.
# Klíče jsou české názvy čeledí, nebo řádů, pokud se řád nedělí. Co tu není, tvoří skupinu podle svého řádu.
MAMMAL_PEERS = {
    "kytovci": ("narvalovití", "plejtvákovití", "delfínovití", "velrybovití", "Eschrichtiidae", "Iniovití", "delfínovcovití", "sviňuchovití", "vorvaňovcovití", "vorvaňovití"),
    "přežvýkavci": ("turovití", "jelenovití", "daněk", "žirafovití", "vidlorohovití", "Kabar", "kančilovití"),
    "kočkotvaré šelmy": ("kočkovití", "hyenovití", "promykovití", "cibetkovití", "madagaskarské šelmy", "Nandiniidae", "Prionodontidae"),
    "psotvaré šelmy": ("psovití", "medvědovití", "lasicovití", "skunkovití", "medvídkovití", "Pandy malé"),
    "ploutvonožci": ("tuleňovití", "lachtanovití", "mrožovití"),
    "lidoopi": ("hominidé", "gibonovití"),
    "opice Starého světa": ("kočkodanovití",),
    "opice Nového světa": ("chvostanovití", "chápanovití", "kosmanovití", "malpovití", "ksukolovití", "Aotidae"),
    "poloopice": ("outloňovití", "kombovití", "lemurovití denní", "indriovití", "makiovití", "nártounovití", "Lepilemuridae"),
    "myšovci": ("myšovití", "křečkovití", "křečkovití afričtí", "tarbíkovití", "Sminthidae", "Bobruškovití"),
    "veverkovci a bobři": ("veverkovití", "plchovití", "bobrovití", "pytloušovití"),
    "dikobrazovci": ("činčilovití", "morčatovití", "dikobrazovití", "korovití", "rypošovití", "osmákovití", "pakaranovití", "Agutiovití", "skalní krysy", "urzonovití", "Diatomyidae"),
    "klokani": ("klokanovití", "klokánkovití"),
    "ostatní vačnatci a ptakořitní": ("dvojitozubci", "vačice", "kunovci", "bandikuti", "Paucituberculata", "ptakořitní"),
    "afrotérie": ("chobotnatci", "sirény", "damani", "hrabáči", "afrosoricidi", "bércouni"),
    "chudozubí a luskouni": ("pásovci", "Pilosa", "luskouni"),
    "hmyzožravci a tany": ("Eulipotyphla", "Erinaceomorpha", "hmyzožravci", "tany", "letuchy"),
}
PEER_OF = {label: group for group, labels in MAMMAL_PEERS.items() for label in labels}


def peer_group(sp):
    return PEER_OF.get(sp["family"]) or PEER_OF.get(sp["order"]) or sp["order"]


EXCLUDE = ("Homo ",)  # rod člověk: fotky lidí do hádání druhů nepatří; výjimkou je ruční EASTER_EGG
# Druhy bez ustáleného českého jména (článek nese latinský název), které chceme i tak; ve hře mají jen latinské jméno.
LATIN_ONLY = {"Q4302742"}  # Coronula diadema
# Vzácný vtípek: člověk jako jeden ze savců, s tvrzeními, která by platila i pro jiná zvířata.
# Váha losování je 1 (pop 0). "not": savci, pro které tvrzení jistě neplatí.
# "false_for_human": existující tvrzení o jiných savcích, která pro člověka jistě neplatí, slouží jako špatné odpovědi.
EASTER_EGG = {
    "class": "savci",
    "species": {
        "id": "Q15978631", "name": "Člověk moudrý", "latin": "Homo sapiens", "family": "hominidé", "order": "primáti",
        "wiki": "https://cs.wikipedia.org/wiki/%C4%8Clov%C4%9Bk_moudr%C3%BD",
        "photos": [{"url": "https://upload.wikimedia.org/wikipedia/commons/6/68/Akha_cropped_hires.JPG", "page": "https://commons.wikimedia.org/wiki/File:Akha_cropped_hires.JPG",
                    "author": "Weltenbummler84", "license": "CC BY-SA 2.0 de"}],
        "continents": ["EU", "AS", "AF", "NA", "SA", "AN", "OC"], "pop": 0, "egg": True,
    },
    "facts": [
        ("Dospělý jedinec má obvykle 32 zubů.", "čísla", ["Lev", "Vlk obecný", "Liška obecná", "Slon africký", "Medvěd hnědý"]),
        ("Březost trvá asi devět měsíců.", "čísla", ["Lev", "Vlk obecný", "Liška obecná", "Slon africký", "Tygr"]),
        ("Samice obvykle rodí jedno mládě.", "mláďata", ["Vlk obecný", "Liška obecná", "Prase divoké", "Ježek západní"]),
        ("Ochlazuje se pocením po celém těle.", "chování", ["Vlk obecný", "Liška obecná", "Prase divoké", "Slon africký"]),
    ],
    "false_for_human": [
        ("Keporkak", "Q132905#0"),  # Má velmi dlouhé ploutve, až třetinu těla.
        ("Mýval severní", "Q121439#0"),  # Má výraznou černou masku na obličeji a pruhovaný ocas.
        ("Plejtvák obrovský", "Q42196#2"),  # Váží zhruba 72 až 135 tun.
        ("Pižmoň severní", "Q184004#0"),  # Rohy nosí samci i samice.
        ("Sob polární", "Q39624#3"),  # Má široké paznehty (kopyta), takže se neboří do sněhu.
        ("Mrož lední", "Q40994#3"),  # Kly mohou být dlouhé až jeden metr.
        ("Lemur kata", "Q185385#0"),  # Má dlouhý pruhovaný ocas, který mu pomáhá při skocích.
        ("Gepard štíhlý", "Q23907#2"),  # Má černé pruhy od očí k tlamě.
    ],
}
MAX_PHOTOS = 4
MIN_COMMONS_WIDTH = 800  # další fotky z Commons mají být kvalitní
WANTED_PHOTOS = 2  # s menším počtem schválených fotek se hledají další
GAME_PHOTOS = 10  # nejvýš tolik schválených fotek jednoho druhu, doplňuje se do něj z Commons
CATEGORIES = {"vzhled", "potrava", "výskyt", "chování", "mláďata", "čísla", "vztahy", "růst", "využití", "jedovatost", "účinky", "vymření"}
CONTINENTS = ("EU", "AS", "AF", "NA", "SA", "AN", "OC")
MIN_CLASS_SPECIES = 4  # méně druhů nestačí na otázku se čtyřmi možnostmi
BAD_FILE = re.compile(
    r"map|range|distribution|areal|rozsir|rozšíř|status|logo|icon|skull|lebk|skelet|skeleton|dead|killed|mrtv"
    r"|troph|stamp|známk|footprint|scat|illustration|drawing|painting|kresb|engraving|lithograph|fossil|herbar|herbář"
    r"|\bplate\b|fmib|taxiderm|museum|denticule|mnhn|naturalis|specimen|holotyp|syntyp|lectotyp|paratyp",
    re.I,
)
RELAXED_BAD_FILE = re.compile(r"map|range|distribution|areal|rozsir|rozšíř|status|logo|icon|stamp|známk|timeline|cladogram|kladogram|chart|graph"
                              r"|size|comparison|scale", re.I)
# dítě nesmí ze hry odnést, že něco může jíst nebo se tím léčit
UNSAFE = re.compile(r"\b(jedl[ýáéíou]|chutn|léč|lék)", re.I)
GEO_SECTION = re.compile(r"rozšíř|výskyt|areál|geografi|stanovišt|biotop|prostředí", re.I)
ADJ_END = re.compile(r"(ovaný|ovaná|ované|itý|itá|ité|atý|atá|até|ový|ová|ové|ský|ská|ské|cký|cká|cké|ný|ná|né|ní|ý|á|é|í)$")
FAMILY_END = re.compile(r"ovit[íé]$")
SECTION_END = re.compile(r"^==\s*(Odkazy|Reference|Externí odkazy|Literatura|Poznámky|Související články)\s*==\s*$", re.M)


# Wikidata při vypršení času někdy přeruší odpověď uprostřed, takže přijde neplatný JSON
NETWORK_ERRORS = (OSError, http.client.HTTPException, json.JSONDecodeError)


def get(url, raw=False, attempts=6):
    attempt = 0
    while True:
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                return r.read() if raw else json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:  # omezení rychlosti Wikimedia: počkat, není to selhání
                print(f"  429, čekám {e.headers.get('Retry-After') or 60} s", flush=True)
                time.sleep(int(e.headers.get("Retry-After") or 60))
                continue
            attempt += 1
            if e.code not in (500, 502, 503, 504) or attempt == attempts:
                raise
            time.sleep(5 * 2**attempt)
        except NETWORK_ERRORS:
            attempt += 1
            if attempt == attempts:
                raise
            time.sleep(5 * 2**attempt)


def wiki(host="cs.wikipedia.org", attempts=6, **params):
    params.update(format="json", formatversion=2)
    return get(f"https://{host}/w/api.php?" + urllib.parse.urlencode(params), attempts=attempts)["query"]


def sparql(query, attempts=6):
    url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(query)
    return get(url, attempts=attempts)["results"]["bindings"]


def sparql_by_species(ids, make_query, batch=150):
    """Dotaz po dávkách druhů. Cesta od druhu nahoru je rychlá, kdežto dotaz od velké třídy dolů na Wikidatech vyprší."""
    rows = []
    for i in range(0, len(ids), batch):
        chunk = ids[i:i + batch]
        try:
            rows += sparql(make_query(" ".join(f"wd:{q}" for q in chunk)), attempts=2 if len(chunk) > 1 else 6)
        except NETWORK_ERRORS:
            if len(chunk) == 1:
                raise
            print(f"  dávku {len(chunk)} druhů dělím na polovinu", flush=True)
            rows += sparql_by_species(chunk, make_query, max(1, len(chunk) // 2))
    return rows


@functools.cache
def species_with_czech_article():
    query = """SELECT ?s WHERE { hint:Query hint:optimizer "None".
      ?art schema:isPartOf <https://cs.wikipedia.org/>; schema:about ?s. ?s wdt:P105 wd:Q7432. }"""
    return tuple(r["s"]["value"].rsplit("/", 1)[1] for r in sparql(query))


def strip_html(s):
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", s or "")).split())


def norm(s):
    return " ".join(s.split()).casefold()


def paths(slug):
    d = ROOT / "data" / slug
    return d, d / "species.json", d / "articles", d / "thumbs", d / "facts", d / "neg_jobs", d / "neg"


def species_roots():
    """Ke každému druhu s českým článkem kořeny z CLASSES, pod které patří. Ukládá se, jeden průchod stačí pro všechny skupiny."""
    file = ROOTS_FILE
    all_roots = sorted({q for slug, cfg in [*CLASSES.items(), *GAME_GROUPS.items()] if slug not in EXTRA for q in cfg[0].split()})
    state = json.loads(file.read_text("utf-8")) if file.exists() else {}
    if state.get("all_roots") != all_roots:
        state = {"all_roots": all_roots, "roots": {}, "checked": []}
    checked = set(state["checked"])
    pending = [s for s in species_with_czech_article() if s not in checked]
    values_roots = " ".join(f"wd:{q}" for q in all_roots)
    for i in range(0, len(pending), 100):
        chunk = pending[i:i + 100]
        for r in sparql_by_species(chunk, lambda v: f"SELECT DISTINCT ?s ?root WHERE {{ VALUES ?s {{ {v} }} VALUES ?root {{ {values_roots} }} ?s wdt:P171+ ?root. }}"):
            state["roots"].setdefault(r["s"]["value"].rsplit("/", 1)[1], []).append(r["root"]["value"].rsplit("/", 1)[1])
        checked.update(chunk)
        state["checked"] = sorted(checked)
        file.write_text(json.dumps(state), encoding="utf-8")
        print(f"  zařazení druhů {len(checked)}/{len(checked) + len(pending) - i - len(chunk)}", flush=True)
    return state["roots"]


def list_species(qids, skip=()):
    """Druhy s českým článkem v daných taxonech: {qid: {title, latin, p18, commons, family, order}}."""
    wanted = set(qids)
    return species_details(sorted(s for s, roots in species_roots().items() if wanted & set(roots) and s not in skip))


def extra_members(slug):
    """Druhy a rody s českým článkem pro skupinu z Extra. Ukládá se do members.json: má přednost i před druhy z jiných skupin."""
    file = paths(slug)[0] / "members.json"
    if file.exists():
        return json.loads(file.read_text("utf-8"))
    article = f"?art schema:about ?s; schema:isPartOf <https://cs.wikipedia.org/>. ?s wdt:P105 ?rank. VALUES ?rank {{ {EXTRA_RANKS} }}"
    if slug == "vyhynula_zvirata":
        fossil, extinct = EXTINCT.split()
        candidates = set()
        for condition in (f"?s wdt:P31 wd:{fossil}.", f"?s wdt:P141 wd:{extinct}."):  # dohromady nebo od článků dotaz vyprší
            rows = sparql(f"SELECT DISTINCT ?s WHERE {{ {condition} {article} }}")
            candidates |= {r["s"]["value"].rsplit("/", 1)[1] for r in rows}
        candidates = sorted(candidates)
        animals = {r["s"]["value"].rsplit("/", 1)[1] for r in sparql_by_species(candidates, lambda v: f"SELECT ?s WHERE {{ VALUES ?s {{ {v} }} ?s wdt:P171+ wd:Q729 }}")}
        found = [s for s in candidates if s in animals]
    else:
        found = set()
        for root in CLASSES[slug][0].split():
            rows = sparql(f"SELECT DISTINCT ?s WHERE {{ ?s wdt:P171+ wd:{root}. {article} }}")
            found |= {r["s"]["value"].rsplit("/", 1)[1] for r in rows}
        for root in EXTRA_EXCLUDE:
            found -= {r["s"]["value"].rsplit("/", 1)[1] for r in sparql(f"SELECT DISTINCT ?s WHERE {{ ?s wdt:P171+ wd:{root}. {article} }}")}
        found = sorted(found)
    # rod, jehož druh má vlastní článek, by se ve hře ukázal dvakrát
    parents = {r["parent"]["value"].rsplit("/", 1)[1] for r in sparql_by_species(found, lambda v: f"SELECT ?parent WHERE {{ VALUES ?s {{ {v} }} ?s wdt:P171 ?parent }}")}
    result = {"members": [s for s in found if s not in parents and s not in EXTRA_EXCLUDE_IDS]}
    if slug == "vyhynula_zvirata":  # kvůli emoji: dinosauři mimo ptáky 🦖, ptáci 🐦
        under = lambda root: sorted({r["s"]["value"].rsplit("/", 1)[1] for r in sparql_by_species(
            result["members"], lambda v: f"SELECT ?s WHERE {{ VALUES ?s {{ {v} }} ?s wdt:P171+ wd:{root} }}")})
        result["birds"] = under("Q5113")
        result["dinosaurs"] = sorted(set(under("Q430")) - set(result["birds"]))
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(result), encoding="utf-8")
    return result


def species_details(members):
    out = {}
    for r in sparql_by_species(members, lambda values: f"""SELECT ?s ?art ?latin ?img ?cat WHERE {{ VALUES ?s {{ {values} }}
        ?art schema:about ?s; schema:isPartOf <https://cs.wikipedia.org/>. OPTIONAL {{?s wdt:P225 ?latin}} OPTIONAL {{?s wdt:P18 ?img}} OPTIONAL {{?s wdt:P373 ?cat}} }}"""):
        sid = r["s"]["value"].rsplit("/", 1)[1]
        title = urllib.parse.unquote(r["art"]["value"].rsplit("/", 1)[1]).replace("_", " ")
        sp = out.setdefault(sid, {"title": title, "latin": r.get("latin", {}).get("value", ""), "commons": r.get("cat", {}).get("value", ""), "p18": [], "family": "", "order": ""})
        if "img" in r:
            file = urllib.parse.unquote(r["img"]["value"].rsplit("/", 1)[1])
            if file not in sp["p18"]:
                sp["p18"].append(file)
    ranks = {"Q35409": "family", "Q36602": "order"}
    for r in sparql_by_species(members, lambda values: f"""SELECT ?s ?rank ?tLabel WHERE {{ VALUES ?s {{ {values} }}
        ?s wdt:P171+ ?t. ?t wdt:P105 ?rank. VALUES ?rank {{wd:Q35409 wd:Q36602}}
        SERVICE wikibase:label {{ bd:serviceParam wikibase:language "cs,la,en". }} }}"""):
        sid, rank = r["s"]["value"].rsplit("/", 1)[1], ranks[r["rank"]["value"].rsplit("/", 1)[1]]
        if sid in out:
            out[sid][rank] = out[sid][rank] or r["tLabel"]["value"]
    return out


def good_files(files, relaxed=False):
    """Kandidáti podle názvu souboru. U Extra smí být fosílie, exponáty, rekonstrukce a snímky z mikroskopu, vyřadí se jen mapy a grafika."""
    bad = RELAXED_BAD_FILE if relaxed else BAD_FILE
    return [f for f in files if f.lower().endswith((".jpg", ".jpeg")) and not bad.search(f)]


def photo_candidates(sp, article_images, relaxed=False):
    files = [f.removeprefix("Soubor:") for f in article_images]
    return image_records(good_files(list(dict.fromkeys(sp["p18"] + files)), relaxed), MAX_PHOTOS)


def commons_candidates(category, known=(), limit=MAX_PHOTOS, relaxed=False):
    """Fotky z kategorie druhu na Wikimedia Commons, které ještě nemá."""
    members = wiki(host="commons.wikimedia.org", action="query", list="categorymembers", cmtitle=f"Category:{category}", cmtype="file", cmlimit=200)["categorymembers"]
    known = {f.replace(" ", "_") for f in known}
    files = [m["title"].removeprefix("File:") for m in members]
    # Commons řadí podle abecedy, začátek abecedy často zaplní kresby a muzejní exponáty. Pevné semínko: výběr je opakovatelný.
    random.Random(category).shuffle(files)
    return image_records(good_files([f for f in files if f.replace(" ", "_") not in known], relaxed), limit, MIN_COMMONS_WIDTH)


def image_records(good, limit, min_width=400):
    if not good:
        return []
    pages = wiki(
        host="commons.wikimedia.org", action="query", prop="imageinfo", titles="|".join("File:" + f for f in good[:limit * 3]),
        iiprop="url|extmetadata|size", iiurlwidth=500, iiextmetadatalanguage="cs",
        iiextmetadatafilter="Artist|LicenseShortName|ImageDescription",
    )["pages"]
    info = {p["title"].split(":", 1)[1].replace(" ", "_"): p["imageinfo"][0] for p in pages if p.get("imageinfo")}
    photos = []
    for f in good:
        ii = info.get(f.replace(" ", "_"))
        if not ii or ii["width"] < min_width:
            continue
        meta = ii.get("extmetadata") or {}  # API vrací prázdný seznam místo slovníku
        photos.append({
            "file": f,
            "url": ii.get("thumburl") or ii["url"],
            "page": ii["descriptionurl"],
            "author": strip_html(meta.get("Artist", {}).get("value"))[:80],
            "license": strip_html(meta.get("LicenseShortName", {}).get("value")),
            "desc": strip_html(meta.get("ImageDescription", {}).get("value"))[:200],
        })
        if len(photos) == limit:
            break
    return photos


def download_photos(thumbs, sid, candidates, start=0):
    """Stáhne náhledy, číslování navazuje na fotky, které už druh má."""
    photos = []
    for ph in candidates:
        try:
            content = get(ph["url"], raw=True)
        except urllib.error.HTTPError:
            continue
        (thumbs / f"{sid}_{start + len(photos)}.jpg").write_bytes(content)
        photos.append(ph)
    return photos


def fetch_species(slug, sid, sp):
    """Stáhne článek a fotky jednoho druhu. Vrátí záznam druhu, nebo důvod vyřazení."""
    _, _, articles, thumbs, *_ = paths(slug)
    page = wiki(action="query", prop="extracts|images", titles=sp["title"], explaintext=1, exlimit=1, imlimit=100)["pages"][0]
    text = SECTION_END.split(page.get("extract", ""))[0].strip()
    if not text:  # o použitelnosti článku jinak rozhoduje subagent
        return "empty"
    relaxed = slug in EXTRA
    candidates = photo_candidates(sp, [i["title"] for i in page.get("images", [])], relaxed)
    photos = download_photos(thumbs, sid, candidates or commons_candidates(sp["commons"] or sp["latin"], relaxed=relaxed))
    if not photos:
        return "photoless"
    name = re.sub(r"\s*\(.*\)$", "", sp["title"])
    target = 2 if len(text) < 3000 else 4 if len(text) < 8000 else 6 if len(text) < 20000 else 8
    head = [f"NÁZEV: {name}", f"LATINSKY: {sp['latin']}", f"POČET TVRZENÍ: {target}", "FOTKY:"]
    head += [f"  {i}: data/{slug}/thumbs/{sid}_{i}.jpg | soubor: {p['file']} | popis: {p['desc']}" for i, p in enumerate(photos)]
    body = "\n".join(textwrap.fill(line, 400) for line in text.splitlines())
    (articles / f"{sid}.txt").write_text("\n".join(head) + "\n---\n" + body, encoding="utf-8")
    return {"name": name, "title": sp["title"], "latin": sp["latin"], "family": sp["family"], "order": sp["order"], "photos": photos}


def fetch(slug):
    base, species_file, articles, thumbs, *_ = paths(slug)
    articles.mkdir(parents=True, exist_ok=True)
    thumbs.mkdir(exist_ok=True)
    for sub in ("facts", "more_photos", "photo_jobs", "neg", "neg_jobs", "review", "review_jobs", "continents", "continent_jobs", "language", "language_jobs"):
        (base / sub).mkdir(exist_ok=True)
    # Wikidata někdy řadí druh do více tříd; zpracuje ho jen první
    others = set()
    for other in CLASSES:
        if other != slug and paths(other)[1].exists():
            others |= set(json.loads(paths(other)[1].read_text("utf-8")))
    existing = json.loads(species_file.read_text("utf-8")) if species_file.exists() else {}
    if slug in EXTRA:  # druhy z jiných skupin si Extra jen vezme ve hře, znovu se nezpracovávají
        listed = species_details([s for s in extra_members(slug)["members"] if s not in others | set(existing)])
    else:
        listed = list_species(CLASSES[slug][0].split(), others | set(existing))
    found = {k: v for k, v in listed.items() if not v["latin"].startswith(EXCLUDE) and (v["title"] != v["latin"] or k in LATIN_ONLY or slug in EXTRA)}
    print(f"Nových druhů s článkem (s českým názvem): {len(found)}", flush=True)
    # průběžný stav, ať přerušené stahování naváže; species.json se změní až po dokončení.
    # Už stažené druhy zůstávají beze změny, schválení fotek jsou indexy do jejich seznamu.
    partial = base / "species.partial.json"
    state = json.loads(partial.read_text("utf-8")) if partial.exists() else {"keep": {}, "done": []}
    keep, finished = {**state["keep"], **existing}, set(state["done"])
    outcome = Counter()
    pending = [(sid, sp) for sid, sp in sorted(found.items()) if sid not in finished]
    # Wikimedia doporučuje nejvýš 3 souběžné požadavky
    with ThreadPoolExecutor(3) as pool:
        for n, ((sid, _), result) in enumerate(zip(pending, pool.map(lambda item: fetch_species(slug, *item), pending))):
            finished.add(sid)
            if isinstance(result, dict):
                keep[sid] = result
            else:
                outcome[result] += 1
            if n % 25 == 0:
                partial.write_text(json.dumps({"keep": keep, "done": sorted(finished)}, ensure_ascii=False), encoding="utf-8")
                print(f"  {n}/{len(pending)}", flush=True)
    save_species(species_file, keep)
    partial.unlink(missing_ok=True)
    print(f"Prázdné články: {outcome['empty']}, bez použitelné fotky: {outcome['photoless']}, druhů celkem: {len(keep)}", flush=True)


def save_species(species_file, species):
    # atomicky, souběžný krok pipeline nesmí přečíst rozepsaný soubor
    temporary = species_file.with_suffix(".tmp")
    temporary.write_text(json.dumps(species, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(temporary, species_file)


def retry_photos(slug):
    """Druhům bez jediné schválené fotky hledá ještě jednou: první hledání bralo jen začátek abecedy. Každý druh jen jednou."""
    more_photos(slug, retry=True)


def fill_photos(slug):
    """Doplní každému druhu kandidáty z Commons až do GAME_PHOTOS schválených fotek. Každý druh jen jednou."""
    more_photos(slug, fill=True)


def more_photos(slug, batch=25, retry=False, fill=False):
    """Druhům s málo schválenými fotkami přidá kandidáty z Commons a úlohy pro jejich posouzení. Každý druh jen jednou."""
    base, species_file, _, thumbs, *_ = paths(slug)
    (base / "photo_jobs").mkdir(exist_ok=True)
    (base / "more_photos").mkdir(exist_ok=True)
    species, facts, _ = load_facts(slug)
    name = (lambda s: f"{s}_fill") if fill else (lambda s: s)
    job_of = lambda s: base / "photo_jobs" / f"{name(s)}.json"
    if fill:
        # počítá se se schválením po přísné kontrole, ta je v built.json
        built = base / "built.json"
        approved = {s["id"]: len(s["photos"]) for s in json.loads(built.read_text("utf-8"))["species"]} if built.exists() else {}
        wanted = {s: GAME_PHOTOS - approved.get(s, 0) for s in facts}
        targets = [s for s, n in wanted.items() if n > 0 and not job_of(s).exists()]
    elif retry:
        targets = [s for s, v in facts.items() if not v["photos"] and not (job_of(s).exists() and read_json(job_of(s)).get("retry"))]
    else:
        targets = [s for s, v in facts.items() if len(v["photos"]) < WANTED_PHOTOS and not job_of(s).exists()]
    print(f"{slug}: hledám další fotky pro {len(targets)} druhů", flush=True)
    categories = {r["s"]["value"].rsplit("/", 1)[1]: r["cat"]["value"] for r in sparql_by_species(
        targets, lambda values: f"SELECT ?s ?cat WHERE {{ VALUES ?s {{ {values} }} ?s wdt:P373 ?cat }}")}

    def search(sid):
        sp = species[sid]
        known = [p["file"] for p in sp["photos"]]
        limit = wanted[sid] if fill else MAX_PHOTOS * 2 if retry else MAX_PHOTOS
        return download_photos(thumbs, sid, commons_candidates(categories.get(sid) or sp["latin"], known, limit, slug in EXTRA), len(known))

    found = 0
    with ThreadPoolExecutor(3) as pool:
        for i in range(0, len(targets), batch):
            chunk = targets[i:i + batch]
            results = list(pool.map(search, chunk))
            for sid, photos in zip(chunk, results):
                species[sid]["photos"] += photos
            save_species(species_file, species)
            for sid, photos in zip(chunk, results):
                start = len(species[sid]["photos"]) - len(photos)
                job = {"species": species[sid]["name"], "latin": species[sid]["latin"], "retry": retry, "photos": [
                    {"i": start + n, "file": p["file"], "desc": p["desc"], "image": f"data/{slug}/thumbs/{sid}_{start + n}.jpg"} for n, p in enumerate(photos)]}
                job_of(sid).write_text(json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8")
                result = base / "more_photos" / f"{name(sid)}.json"
                if retry:  # nový pokus nahrazuje výsledek toho předchozího, nic schváleného v něm nebylo
                    result.unlink(missing_ok=True)
                if not photos:
                    result.write_text('{"photos": []}', encoding="utf-8")
                found += len(photos)
            print(f"  {i + len(chunk)}/{len(targets)}, nalezeno {found} fotek", flush=True)


def missing(slug, stage):
    """Id úloh daného kroku, které ještě nemají výstup."""
    base, species_file, *_ = paths(slug)
    if stage == "facts":
        return [s for s in json.loads(species_file.read_text("utf-8")) if not has_valid_output(base / "facts" / f"{s}.json")]
    if stage == "foreign":
        return [f.stem for f in sorted((base / "foreign").glob("*.txt")) if not has_valid_output(base / "foreign_facts" / f"{f.stem}.json")]
    jobs, results = {"photos": ("photo_jobs", "more_photos"), "negatives": ("neg_jobs", "neg"), "review": ("review_jobs", "review"),
                     "continents": ("continent_jobs", "continents"), "language": ("language_jobs", "language")}[stage]
    return [j.stem for j in sorted((base / jobs).glob("*.json")) if not has_valid_output(base / results / j.name)]


def todo(slug):
    for stage in ("facts", "photos", "foreign", "negatives", "review", "continents", "language"):
        print(f"{stage}:", json.dumps(missing(slug, stage)))


def next_batch(limit):
    """Další úlohy pro workflow. Vedlejší výpisy jdou na stderr, poslední řádek stdout je JSON."""
    with contextlib.redirect_stdout(sys.stderr):
        result = find_batches(int(limit))
    print(json.dumps(result, separators=(",", ":")))


def out_of_date(slug):
    """Přibyly od posledního sestavení built.json nějaké výsledky?"""
    base = paths(slug)[0]
    built = base / "built.json"
    if not built.exists():
        return True
    newest = max((f.stat().st_mtime for sub in ("facts", "more_photos", "foreign_facts", "neg", "review", "continents", "language")
                  for f in (base / sub).glob("*.json")), default=0)
    return newest > built.stat().st_mtime


def class_batch(slug, limit):
    """Úlohy nejbližšího nedokončeného kroku jedné skupiny, nebo None."""
    kingdom = CLASSES[slug][2]

    def batch(stage):
        ids = missing(slug, stage)
        return {"stage": stage, "slug": slug, "kingdom": kingdom, "ids": ids[:limit]} if ids else None

    stale = out_of_date(slug)
    found = batch("facts") or batch("photos") or batch("foreign")
    if found:
        return found
    if stale:
        sync_negatives(slug)
    found = batch("negatives")
    if found:
        return found
    if stale:
        popularity(slug)
        build(slug)
        if slug == "savci":
            sync_peer_negatives(slug)
        sync_known_negatives(slug)
        sync_needy_negatives(slug)
        found = batch("negatives")
        if found:
            return found
        sync_review(slug)
    found = batch("review")
    if found:
        return found
    if stale:
        sync_continents(slug)
    found = batch("continents")
    if found:
        return found
    if stale:
        sync_language(slug)
    return batch("language")


def find_batches(limit):
    """Úlohy všech skupin do celkového limitu agentů. Každá skupina přispěje svým nejbližším krokem."""
    batches = []
    for slug in CLASSES:
        if limit > 0 and paths(slug)[1].exists():
            found = class_batch(slug, limit)
            if found:
                batches.append(found)
                limit -= len(found["ids"])
    if not batches:
        write_game_data()
    return {"batches": batches}


def read_json(path):
    # subagenti občas uloží soubor v cp1250 místo UTF-8 nebo s BOM
    raw = path.read_bytes()
    try:
        return json.loads(raw.decode("utf-8-sig"))
    except UnicodeDecodeError:
        return json.loads(raw.decode("cp1250"))


def has_valid_output(path):
    """Nečitelný výstup subagenta smaže, aby se úloha zadala znovu."""
    if not path.exists():
        return False
    try:
        read_json(path)
        return True
    except json.JSONDecodeError:
        print("  nečitelný výstup, úloha se zopakuje:", path)
        path.unlink()
        return False


def leaks_name(text, sp):
    """Prozrazuje tvrzení název druhu nebo čeledi, i ve skloňovaném či odvozeném tvaru?"""
    words = sp["name"].lower().split()
    stems = [words[0][:max(3, len(words[0]) - 2)]] + [ADJ_END.sub("", w) for w in words[1:]]
    family = sp["family"].lower()
    if FAMILY_END.search(family):
        stems.append(FAMILY_END.sub("", family))
    low = text.lower()
    return any(len(s) >= 3 and re.search(r"\b" + re.escape(s), low) for s in stems) or any(
        w.lower() in low for w in sp["latin"].split() if len(w) > 3)


def text_problem(text, sp):
    return ("prozrazuje název" if leaks_name(text, sp)
            else "příliš dlouhé" if len(text) > 130
            else "o jídle nebo léčbě" if UNSAFE.search(text)
            else "")


def restored_photos(base):
    """Fotky, které opakovaná kontrola (úlohy h_) vrátila: dřív je zamítlo jen lidské prostředí kolem volně žijícího zvířete."""
    return {(d["species_id"], d["i"]) for file in sorted((base / "review").glob("h_*.json")) for d in read_json(file).get("restore_photos", [])}


def article_body(file):
    return norm(file.read_text("utf-8").split("\n---\n", 1)[1])


def load_facts(slug):
    """Načte výstupy kroku 1 a tvrzení z cizojazyčných článků; tvrzení bez doslovné opory ve zdroji nebo prozrazující název zahodí."""
    base, species_file, articles, _, facts_dir, *_ = paths(slug)
    species = json.loads(species_file.read_text("utf-8"))
    out, dropped = {}, Counter()
    fixes, duplicates = {}, set()
    for file in sorted((base / "language").glob("*.json")):
        result = read_json(file)
        fixes.update((d["id"], d["text"]) for d in result.get("fixes", []))
        duplicates.update(d["id"] for d in result.get("drop", []))
    restored = defaultdict(set)
    for sid, i in restored_photos(base):
        restored[sid].add(i)

    def accept(raw_facts, sid, sp, source, mark=""):
        """Tvrzení s doslovnou oporou ve zdroji. Id tvrzení z cizojazyčných článků mají za # písmeno x."""
        kept = []
        for i, f in enumerate(raw_facts):
            fact_id = f"{sid}#{mark}{i}"
            if fact_id in duplicates:
                dropped["stejný význam jako jiné tvrzení"] += 1
                continue
            # jazyková oprava projde stejnými pravidly jako původní věta, jinak zůstává původní
            text = fixes[fact_id] if fact_id in fixes and not text_problem(fixes[fact_id], sp) else f["text"]
            reason = (
                "citace není v článku" if len(norm(f["quote"])) < 10 or norm(f["quote"]) not in source
                else text_problem(text, sp)
                or ("špatná kategorie" if f["category"] not in CATEGORIES else "")
            )
            if reason:
                dropped[reason] += 1
            else:
                kept.append({"id": fact_id, "text": text, "quote": f["quote"], "category": f["category"]})
        return kept

    for sid, sp in species.items():
        file = facts_dir / f"{sid}.json"
        if not file.exists():
            dropped["druh bez výstupu"] += 1
            continue
        try:
            raw = read_json(file)
            facts = []
            if raw.get("usable") is False:  # fotky platí dál, tvrzení můžou přijít z jiných jazyků
                dropped["článek bez použitelných informací"] += 1
            else:
                facts = accept(raw["facts"], sid, sp, article_body(articles / f"{sid}.txt"))
            foreign = base / "foreign_facts" / f"{sid}.json"
            if foreign.exists() and (raw_foreign := read_json(foreign)).get("usable") is not False:
                facts += accept(raw_foreign["facts"], sid, sp, article_body(base / "foreign" / f"{sid}.txt"), "x")
            judged = list(raw["photos"])
            # první hledání ukládá {sid}.json, další kola {sid}_<kolo>.json
            for extra in [base / "more_photos" / f"{sid}.json", *(base / "more_photos").glob(f"{sid}_*.json")]:
                if extra.exists():
                    judged += read_json(extra)["photos"]
            photos = sorted({p["i"] for p in judged if p["ok"]} | restored[sid])
            photos = [i for i in photos if 0 <= i < len(sp["photos"])]
        except (json.JSONDecodeError, KeyError, TypeError) as e:
            dropped[f"neplatný soubor ({type(e).__name__})"] += 1
            print("  neplatný výstup:", file.name, e)
            continue
        out[sid] = {"facts": facts, "photos": photos}
    return species, out, dropped


def next_job_number(jobs_dir, prefix=""):
    numbers = [int(m.group(1)) for j in jobs_dir.glob("*.json") if (m := re.fullmatch(prefix + r"(\d+)", j.stem))]
    return max(numbers, default=-1) + 1


def jobs_in(jobs_dir):
    return [read_json(j) for j in sorted(jobs_dir.glob("*.json"))]


def write_neg_job(file, chunk, cand, species, facts, articles):
    profiles = {}
    for s in cand:
        lead = (articles / f"{s}.txt").read_text("utf-8").split("\n---\n", 1)[1][:500]
        profiles[s] = {"name": species[s]["name"], "latin": species[s]["latin"], "family": species[s]["family"], "lead": lead,
                       "facts": [f["text"] for f in facts[s]["facts"]]}
    job = {"facts": [{"id": f["id"], "species": species[f["id"].split("#")[0]]["name"], "text": f["text"], "quote": f["quote"]} for f in chunk],
           "candidates": profiles}
    file.write_text(json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8")


def sync_negatives(slug, batch=20, candidates=12):
    """Úlohy pro tvrzení, která negativním krokem ještě neprošla."""
    base, _, articles, _, _, jobs_dir, _ = paths(slug)
    species, facts, dropped = load_facts(slug)
    usable = {s: v for s, v in facts.items() if v["photos"] and v["facts"]}
    jobs_dir.mkdir(exist_ok=True)
    (base / "neg").mkdir(exist_ok=True)
    covered = {f["id"] for job in jobs_in(jobs_dir) for f in job["facts"]}
    print("Zahozeno:", dict(dropped))
    rng = random.Random(slug + str(len(covered)))
    by_order = defaultdict(list)
    for sid in usable:
        by_order[species[sid]["order"]].append(sid)
    used = Counter()

    def pick(pool, k, avoid):
        # nejméně použité druhy první, aby měl každý dost tvrzení, která o něm neplatí
        pool = [s for s in pool if s not in avoid]
        rng.shuffle(pool)
        return sorted(pool, key=lambda s: used[s])[:k]

    n = next_job_number(jobs_dir)
    first = n
    for order, members in sorted(by_order.items()):
        all_facts = [f for s in members for f in usable[s]["facts"] if f["id"] not in covered]
        rng.shuffle(all_facts)
        for i in range(0, len(all_facts), batch):
            chunk = all_facts[i:i + batch]
            owners = {f["id"].split("#")[0] for f in chunk}
            cand = pick(members, candidates * 2 // 3, owners)
            cand += pick(list(usable), candidates - len(cand), owners | set(cand))
            used.update(cand)
            write_neg_job(jobs_dir / f"{n:04}.json", chunk, cand, species, usable, articles)
            n += 1
    print(f"Nových úloh negativního kroku: {n - first}")


def sync_peer_negatives(slug):
    """Tvrzení savců posoudí ještě vůči druhům z užší skupiny, ať má hra špatné odpovědi z podobných zvířat."""
    built = json.loads((paths(slug)[0] / "built.json").read_text("utf-8"))["species"]
    members = defaultdict(list)
    for s in built:
        members[peer_group(s)].append(s)
    extra_negatives(slug, "peer_", members)


def sync_known_negatives(slug, share=0.1, minimum=12):
    """Tvrzení známých druhů posoudí vůči jiným známým druhům. Jen ti se objevují jako možnosti na nejnižší úrovni."""
    built = json.loads((paths(slug)[0] / "built.json").read_text("utf-8"))["species"]
    limit = max(minimum, math.ceil(len(built) * share))
    extra_negatives(slug, "known_", {"známé": sorted(built, key=lambda s: -s["pop"])[:limit]})


def extra_negatives(slug, prefix, members, batch=20, candidates=12):
    """Úlohy, které posoudí tvrzení ze hry vůči druhům ze stejné skupiny. Každé tvrzení jen jednou."""
    base, _, articles, _, _, jobs_dir, _ = paths(slug)
    species, facts, _ = load_facts(slug)
    covered = {f["id"] for job in jobs_dir.glob(f"{prefix}*.json") for f in read_json(job)["facts"]}
    rng = random.Random(slug)
    used = Counter()
    n = next_job_number(jobs_dir, prefix)
    first = n
    for group in sorted(members):
        ids = [s["id"] for s in members[group]]
        kept = {f["id"] for s in members[group] for f in s["facts"]} - covered
        chunks = [f for sid in ids for f in facts[sid]["facts"] if f["id"] in kept]
        rng.shuffle(chunks)
        for i in range(0, len(chunks), batch):
            pool = ids[:]
            rng.shuffle(pool)
            cand = sorted(pool, key=lambda s: used[s])[:candidates]  # vlastní druh tvrzení vyloučí build
            used.update(cand)
            write_neg_job(jobs_dir / f"{prefix}{n:04}.json", chunks[i:i + batch], cand, species, facts, articles)
            n += 1
    print(f"{slug}: nových úloh {prefix}: {n - first}")


def sync_wild_review(slug, batch=40):
    """Jednorázově projde fotky schválené dřív, než kontroly vyřazovaly zvířata ze zajetí. Nové fotky to kontrolují rovnou."""
    base = paths(slug)[0]
    jobs_dir = base / "review_jobs"
    done = {(item["species_id"], item["i"]) for job in jobs_dir.glob("w_*.json") for item in read_json(job)}
    items = [{"species_id": s["id"], "i": p["i"], "species": s["name"], "latin": s["latin"], "image": f"data/{slug}/thumbs/{s['id']}_{p['i']}.jpg"}
             for s in json.loads((base / "built.json").read_text("utf-8"))["species"] for p in s["photos"] if (s["id"], p["i"]) not in done]
    start = next_job_number(jobs_dir, "w_")
    for n in range(0, len(items), batch):
        (jobs_dir / f"w_{start + n // batch:04}.json").write_text(json.dumps(items[n:n + batch], ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{slug}: fotek ke kontrole prostředí {len(items)}")


# Důvody zamítnutí, které mluví jen o lidském prostředí, a ty, které ukazují na zajetí (ty zůstávají zamítnuté).
HUMAN_PLACE = re.compile(r"nábyt|židl|opěrad|budov|zeď|zdi\b|zídk|stěn|okn|parapet|příbor|lžič|stůl|stole|dveř|plot|zábradl|lavič|střech|"
                         r"dlažb|beton|asfalt|chodník|silnic|měst|zahrad|umělé pozadí|umělý povrch|lidsk|místnost|interiér|domě|stavb", re.I)
CAPTIVITY = re.compile(r"zoo|klec|ohrad|akvári|terári|zajet|chovn|chovan|výběh|pletiv|mříž|preparát|muze|studi|bílém pozadí|"
                       r"ruce|ruka|ruku|dlan|prst|držen|obojek|vodítk|krmen|misk", re.I)


def sync_human_review(slug, batch=30):
    """Jednorázově znovu posoudí fotky živočichů zamítnuté jen kvůli lidskému prostředí (zeď, okno, nábytek, město).
    Pravidlo o zajetí bylo příliš přísné: volně žijící vosa na židli v zajetí není."""
    if CLASSES[slug][2] != "zivocichove":
        return
    base, species_file, _, _, facts_dir, _, _ = paths(slug)
    species = json.loads(species_file.read_text("utf-8"))
    jobs_dir = base / "review_jobs"
    done = {(item["species_id"], item["i"]) for job in jobs_dir.glob("h_*.json") for item in read_json(job)}
    rejected = {}

    def note(sid, i, why):
        why = why or ""
        if sid in species and 0 <= i < len(species[sid]["photos"]) and (sid, i) not in done and HUMAN_PLACE.search(why) and not CAPTIVITY.search(why):
            rejected.setdefault((sid, i), why)

    for file in sorted(facts_dir.glob("*.json")):
        for p in read_json(file).get("photos", []):
            if not p.get("ok"):
                note(file.stem, p["i"], p.get("why"))
    for file in sorted((base / "more_photos").glob("*.json")):
        for p in read_json(file).get("photos", []):
            if not p.get("ok"):
                note(file.stem.split("_")[0], p["i"], p.get("why"))
    for file in sorted((base / "review").glob("*.json")):
        for d in read_json(file).get("reject_photos", []):
            note(d["species_id"], d["i"], d.get("why"))
    items = [{"species_id": sid, "i": i, "species": species[sid]["name"], "latin": species[sid]["latin"], "file": species[sid]["photos"][i]["file"],
              "desc": species[sid]["photos"][i]["desc"], "image": f"data/{slug}/thumbs/{sid}_{i}.jpg", "rejected": why}
             for (sid, i), why in sorted(rejected.items()) if (base / "thumbs" / f"{sid}_{i}.jpg").exists()]
    start = next_job_number(jobs_dir, "h_")
    for n in range(0, len(items), batch):
        (jobs_dir / f"h_{start + n // batch:04}.json").write_text(json.dumps(items[n:n + batch], ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{slug}: fotek k opětovnému posouzení prostředí {len(items)}")


def sync_needy_negatives(slug, batch=20, candidates=12, minimum=3, rounds=2):
    """Druhy s méně než třemi nepravdivými tvrzeními posoudí vůči dalším tvrzením ze třídy. Každý druh nejvýš ve dvou kolech."""
    base, _, articles, _, _, jobs_dir, _ = paths(slug)
    built = json.loads((base / "built.json").read_text("utf-8"))["species"]
    false_count = Counter(q for s in built for f in s["facts"] for q in f["not"])
    seen = Counter(c for job in jobs_dir.glob("need_*.json") for c in read_json(job)["candidates"])
    needy = sorted((s for s in built if false_count[s["id"]] < minimum and seen[s["id"]] < rounds), key=lambda s: (s["order"] or "", s["family"] or ""))
    if not needy:
        return
    species, facts, _ = load_facts(slug)
    by_id = {f["id"]: f for v in facts.values() for f in v["facts"]}
    in_game = [f["id"] for s in built for f in s["facts"] if f["id"] in by_id]
    by_order = defaultdict(list)
    for s in built:
        by_order[s["order"]] += [f["id"] for f in s["facts"] if f["id"] in by_id]
    rng = random.Random(f"{slug}{sum(seen.values())}")
    n = next_job_number(jobs_dir, "need_")
    first = n
    for i in range(0, len(needy), candidates):
        group = needy[i:i + candidates]
        owners = {s["id"] for s in group}
        # polovina tvrzení od příbuzných z řádů těchto druhů, zbytek z celé třídy
        near = [f for o in {s["order"] for s in group} for f in by_order[o] if f.split("#")[0] not in owners]
        far = [f for f in in_game if f.split("#")[0] not in owners]
        chunk = rng.sample(near, min(len(near), batch // 2))
        rest = [f for f in far if f not in set(chunk)]
        chunk += rng.sample(rest, min(len(rest), batch - len(chunk)))
        if chunk:
            write_neg_job(jobs_dir / f"need_{n:04}.json", [by_id[f] for f in chunk], [s["id"] for s in group], species, facts, articles)
            n += 1
    print(f"{slug}: druhů s málo nepravdivými tvrzeními {len(needy)}, nových úloh need_: {n - first}")


BOT_WIKIS = {"ceb", "war", "arz", "azb", "nan", "simple"}  # strojově založené pahýly nebo zjednodušená angličtina
NOT_WIKIPEDIA = {"commons", "species", "meta", "wikidata", "mediawiki", "sources", "outreach", "incubator"}
FOREIGN_END = re.compile(r"^==\s*(References|Notes|See also|External links|Further reading|Sources|Bibliography|Einzelnachweise|Literatur|Weblinks|"
                         r"Références|Notes et références|Liens externes|Voir aussi|Bibliographie|Referencias|Enlaces externos|Véase también|Referências|"
                         r"Ligações externas|Примечания|Литература|Ссылки|Przypisy|Bibliografia|Linki zewnętrzne|Note|Collegamenti esterni|"
                         r"Referenties|Externe links|脚注|参考文献|外部リンク|関連項目|参考资料|外部链接)\s*==\s*$", re.M)
MAX_FOREIGN_TEXT = 15000


def foreign_text(lang, title):
    try:
        page = wiki(f"{lang}.wikipedia.org", attempts=2, action="query", prop="extracts", titles=title, explaintext=1, exlimit=1)["pages"][0]
    except (urllib.error.HTTPError, KeyError, *NETWORK_ERRORS):
        return ""
    return FOREIGN_END.split(page.get("extract", ""))[0].strip()[:MAX_FOREIGN_TEXT]


def fetch_foreign(slug):
    """Druhům bez jediného tvrzení ve hře stáhne anglický článek a nejdelší článek v dalším jazyce (bývá tam, kde je druh doma)."""
    base = paths(slug)[0]
    build(slug)  # aktuální počty tvrzení, včetně druhů s nepoužitelným českým článkem
    (base / "foreign").mkdir(exist_ok=True)
    (base / "foreign_facts").mkdir(exist_ok=True)
    tried_file = base / "foreign" / "_tried.json"
    tried = set(json.loads(tried_file.read_text("utf-8"))) if tried_file.exists() else set()
    built = json.loads((base / "built.json").read_text("utf-8"))["species"]
    targets = {s["id"]: s for s in built if not s["facts"] and s["id"] not in tried}
    print(f"{slug}: druhů bez tvrzení {len(targets)}", flush=True)
    links = {}
    ids = sorted(targets)
    for i in range(0, len(ids), 50):
        entities = get("https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(
            {"action": "wbgetentities", "ids": "|".join(ids[i:i + 50]), "props": "sitelinks", "format": "json"}))["entities"]
        for sid, e in entities.items():
            links[sid] = {k[:-4].replace("_", "-"): v["title"] for k, v in e.get("sitelinks", {}).items()
                          if k.endswith("wiki") and k != "cswiki" and k[:-4] not in BOT_WIKIS | NOT_WIKIPEDIA}
    by_lang = defaultdict(list)
    for sid, langs in links.items():
        for lang, title in langs.items():
            by_lang[lang].append(title)

    def lengths(lang):
        titles, out = by_lang[lang], {}
        for i in range(0, len(titles), 50):
            try:
                out.update((p["title"], p.get("length", 0)) for p in wiki(f"{lang}.wikipedia.org", attempts=2, action="query", prop="info",
                                                                           titles="|".join(titles[i:i + 50])).get("pages", []))
            except (urllib.error.HTTPError, KeyError, *NETWORK_ERRORS):
                pass
        return lang, out

    with ThreadPoolExecutor(3) as pool:
        size = {(lang, title): n for lang, found in pool.map(lengths, sorted(by_lang)) for title, n in found.items()}

    def sources(sid):
        langs = links.get(sid, {})
        others = sorted((size.get((l, t), 0), l) for l, t in langs.items() if l != "en")
        picked = (["en"] if "en" in langs else []) + ([others[-1][1]] if others and others[-1][0] > 2000 else [])
        return sid, [(l, langs[l], foreign_text(l, langs[l])) for l in picked]

    written = 0
    with ThreadPoolExecutor(3) as pool:
        for n, (sid, found) in enumerate(pool.map(sources, ids)):
            tried.add(sid)
            found = [(l, t, text) for l, t, text in found if len(text) >= 200]
            total = sum(len(text) for *_, text in found)
            if total >= 300:
                s = targets[sid]
                target = 2 if total < 3000 else 4 if total < 10000 else 6
                head = f"NÁZEV: {s['name']}\nLATINSKY: {s['latin']}\nPOČET TVRZENÍ: {target}\n---\n"
                body = "\n\n".join(f"=== ZDROJ: https://{l}.wikipedia.org/wiki/{urllib.parse.quote(t.replace(' ', '_'))} ===\n"
                                   + "\n".join(textwrap.fill(line, 400) for line in text.splitlines()) for l, t, text in found)
                (base / "foreign" / f"{sid}.txt").write_text(head + body, encoding="utf-8")
                written += 1
            if n % 25 == 0:
                tried_file.write_text(json.dumps(sorted(tried)), encoding="utf-8")
                print(f"  {n}/{len(ids)}, článků {written}", flush=True)
    tried_file.write_text(json.dumps(sorted(tried)), encoding="utf-8")
    print(f"{slug}: cizojazyčné články pro {written} z {len(ids)} druhů", flush=True)


def sync_review(slug, fact_batch=40, photo_batch=30):
    """Úlohy přísné kontroly pro tvrzení a fotky z built.json, které jí ještě neprošly."""
    base = paths(slug)[0]
    species, facts, _ = load_facts(slug)
    built = {s["id"]: s for s in json.loads((base / "built.json").read_text("utf-8"))["species"]}
    jobs_dir = base / "review_jobs"
    jobs_dir.mkdir(exist_ok=True)
    (base / "review").mkdir(exist_ok=True)
    done = [item for job in jobs_in(jobs_dir) for item in job]
    done_facts = {item["id"] for item in done if "id" in item}
    done_photos = {(item["species_id"], item["i"]) for item in done if "species_id" in item}
    done_pairs = {(item["id"], q) for item in done if "id" in item for q in item["claimed_false_for"]}
    quotes = {f["id"]: f["quote"] for v in facts.values() for f in v["facts"]}
    fact_items = []
    for s in built.values():
        for f in s["facts"]:
            # zkontrolované tvrzení se vrací jen kvůli párům, které přibyly
            pairs = [q for q in f["not"] if (f["id"], q) not in done_pairs]
            if f["id"] not in done_facts or pairs:
                fact_items.append({"id": f["id"], "species": s["name"], "latin": s["latin"], "text": f["text"], "quote": quotes[f["id"]],
                                   "claimed_false_for": {q: f"{built[q]['name']} ({built[q]['latin']})" for q in pairs}})
    photo_items = [
        {"species_id": sid, "i": i, "species": built[sid]["name"], "latin": built[sid]["latin"], "file": species[sid]["photos"][i]["file"],
         "desc": species[sid]["photos"][i]["desc"], "image": f"data/{slug}/thumbs/{sid}_{i}.jpg"}
        for sid in built for i in facts[sid]["photos"] if (sid, i) not in done_photos
    ]
    for prefix, items, size in (("f_", fact_items, fact_batch), ("p_", photo_items, photo_batch)):
        start = next_job_number(jobs_dir, prefix)
        for n in range(0, len(items), size):
            (jobs_dir / f"{prefix}{start + n // size:04}.json").write_text(json.dumps(items[n:n + size], ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"K přísné kontrole: {len(fact_items)} tvrzení, {len(photo_items)} fotek")


def sync_continents(slug, batch=25):
    """Úlohy pro přiřazení kontinentů novým druhům z built.json."""
    base, _, articles, *_ = paths(slug)
    (base / "continent_jobs").mkdir(exist_ok=True)
    (base / "continents").mkdir(exist_ok=True)
    done = {item["id"] for job in jobs_in(base / "continent_jobs") for item in job}
    items = []
    for s in json.loads((base / "built.json").read_text("utf-8"))["species"]:
        if s["id"] in done:
            continue
        text = (articles / f"{s['id']}.txt").read_text("utf-8").split("\n---\n", 1)[1]
        parts = re.split(r"^==+\s*(.+?)\s*==+\s*$", text, flags=re.M)
        geo = "\n".join(parts[i + 1] for i in range(1, len(parts) - 1, 2) if GEO_SECTION.search(parts[i]))
        items.append({"id": s["id"], "name": s["name"], "latin": s["latin"], "excerpt": (parts[0][:600] + "\n" + geo[:1500]).strip()})
    start = next_job_number(base / "continent_jobs", "c_")
    for n in range(0, len(items), batch):
        (base / "continent_jobs" / f"c_{start + n // batch:04}.json").write_text(json.dumps(items[n:n + batch], ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Kontinenty: {len(items)} nových druhů")


def sync_language(slug, batch=40):
    """Úlohy jazykové kontroly pro tvrzení z built.json, která jí ještě neprošla. Věty jednoho druhu drží u sebe."""
    base, *_ = paths(slug)
    (base / "language_jobs").mkdir(exist_ok=True)
    (base / "language").mkdir(exist_ok=True)
    done = {item["id"] for job in jobs_in(base / "language_jobs") for item in job}
    _, facts, _ = load_facts(slug)
    quotes = {f["id"]: f["quote"] for v in facts.values() for f in v["facts"]}
    chunk, n, total = [], next_job_number(base / "language_jobs", "l_"), 0

    def flush():
        nonlocal chunk, n
        if chunk:
            (base / "language_jobs" / f"l_{n:04}.json").write_text(json.dumps(chunk, ensure_ascii=False, indent=1), encoding="utf-8")
            chunk, n = [], n + 1

    for s in json.loads((base / "built.json").read_text("utf-8"))["species"]:
        items = [{"id": f["id"], "species": s["name"], "text": f["text"], "quote": quotes[f["id"]]} for f in s["facts"] if f["id"] not in done]
        if len(chunk) + len(items) > batch:
            flush()
        chunk += items
        total += len(items)
    flush()
    print(f"K jazykové kontrole: {total} tvrzení")


def build(slug):
    base, _, _, _, _, _, neg_dir = paths(slug)
    species, facts, dropped = load_facts(slug)
    false_for, bad = defaultdict(set), {}
    for file in sorted(neg_dir.glob("*.json")):
        for r in read_json(file)["results"]:
            false_for[r["id"]] |= set(r.get("false_for", []))
            if r.get("bad") and not file.stem.startswith(("peer_", "known_", "need_")):  # kvalitu tvrzení už posoudil první průchod
                bad[r["id"]] = r.get("why", "")
    unreviewed = [f["id"] for v in facts.values() if v["photos"] for f in v["facts"] if f["id"] not in false_for]
    print("Zahozeno krokem 1:", dict(dropped), "\nZahozeno kontrolou v kroku 2:", len(bad), "\nBez kontroly (zahozeno):", len(unreviewed))
    bad.update(dict.fromkeys(unreviewed, "bez kontroly"))
    pairs = photos = 0
    restored = restored_photos(base)
    for file in sorted((base / "review").glob("*.json")):
        r = read_json(file)
        bad.update((d["id"], d.get("why", "")) for d in r.get("drop_facts", []))
        for d in r.get("drop_pairs", []):
            false_for[d["id"]].discard(d["species"])
            pairs += 1
        for d in r.get("reject_photos", []):
            if (d["species_id"], d["i"]) not in restored and d["i"] in facts.get(d["species_id"], {}).get("photos", []):
                facts[d["species_id"]]["photos"].remove(d["i"])
                photos += 1
    print(f"Druhá kontrola: tvrzení celkem vyřazeno {len(bad)}, odebráno negativních párů {pairs}, fotek {photos}")
    unfinished = [j.stem for j in (base / "review_jobs").glob("*.json") if not (base / "review" / j.name).exists()]
    if unfinished:
        print("POZOR, tyto úlohy přísné kontroly nemají výstup, jejich data prošla bez ní:", unfinished)
    # fotka u dvou druhů by v otázce vytvořila dvě stejné možnosti
    # adresy bez sledovacích parametrů; táž fotka dvakrát u jednoho druhu zůstane jednou
    url = lambda s, i: species[s]["photos"][i]["url"].split("?")[0]  # noqa: E731
    owners = defaultdict(set)
    for s, v in facts.items():
        for i in v["photos"]:
            owners[url(s, i)].add(s)
    for sid, v in facts.items():
        kept = {}
        for i in v["photos"]:
            if len(owners[url(sid, i)]) == 1:
                kept.setdefault(url(sid, i), i)
        v["photos"] = list(kept.values())
    alive = {s for s, v in facts.items() if v["photos"]}
    where = {}
    for file in sorted((base / "continents").glob("*.json")):
        for sid, codes in read_json(file).items():
            where[sid] = [c for c in CONTINENTS if c in codes]
    out = []
    known = json.loads((base / "sitelinks.json").read_text("utf-8")) if (base / "sitelinks.json").exists() else {}
    # co ještě neprošlo přísnou kontrolou, je v built.json kvůli jejím úlohám, ale do hry nesmí
    reviewed = set()
    for job in (base / "review_jobs").glob("*.json"):
        if (base / "review" / job.name).exists():
            reviewed |= {item.get("id") or (item["species_id"], item["i"]) for item in read_json(job)}
    for sid in sorted(alive):
        sp, v = species[sid], facts[sid]
        texts = {}  # stejná věta může u druhu vzniknout dvakrát, stačí jednou
        for f in v["facts"]:
            if f["id"] not in bad:
                texts.setdefault(plain_text(f["text"]), f)
        kept = [{"id": f["id"], "text": text, "cat": f["category"], "not": sorted((false_for[f["id"]] & alive) - {sid}), "reviewed": f["id"] in reviewed} for text, f in texts.items()]
        # sledovací parametry v adrese fotky jen zvětšují data.js
        photos = [{**{k: sp["photos"][i][k] for k in ("page", "author", "license")}, "url": sp["photos"][i]["url"].split("?")[0], "i": i,
                   "reviewed": (sid, i) in reviewed} for i in v["photos"]][:GAME_PHOTOS]
        out.append({"id": sid, "name": sp["name"], "latin": sp["latin"], "family": sp["family"], "order": sp["order"],
                    "wiki": "https://cs.wikipedia.org/wiki/" + urllib.parse.quote(sp["title"].replace(" ", "_")),
                    "photos": photos, "facts": kept, "continents": where.get(sid, []), "pop": known.get(sid, 0)})
    (base / "built.json").write_text(json.dumps({"slug": slug, "name": CLASSES[slug][1], "kingdom": CLASSES[slug][2], "species": out}, ensure_ascii=False), encoding="utf-8")
    write_game_data()
    t4 = sum(len(f["not"]) >= 3 for s in out for f in s["facts"])
    print(f"Hotovo: {len(out)} druhů, {sum(len(s['facts']) for s in out)} tvrzení, z toho {t4} použitelných pro otázku typu 4, bez kontinentu {sum(not s['continents'] for s in out)}.")


def popularity(slug, batch=300):
    """Počet jazykových verzí článku jako měřítko známosti druhu, ukládá se do sitelinks.json."""
    base, species_file, *_ = paths(slug)
    file = base / "sitelinks.json"
    counts = json.loads(file.read_text("utf-8")) if file.exists() else {}
    ids = [s for s in json.loads(species_file.read_text("utf-8")) if s not in counts]
    for i in range(0, len(ids), batch):
        values = " ".join(f"wd:{q}" for q in ids[i:i + batch])
        for r in sparql(f"SELECT ?s ?n WHERE {{ VALUES ?s {{ {values} }} ?s wikibase:sitelinks ?n }}"):
            counts[r["s"]["value"].rsplit("/", 1)[1]] = int(r["n"]["value"])
    file.write_text(json.dumps(counts), encoding="utf-8")
    print(f"{slug}: známost doplněna u {len(ids)} druhů", flush=True)


def plain_text(text):
    """„Tento druh má…“ -> „Má…“. Kde by věta závisela na rodu („je velký“), nebo změnila pořadí slov („se“), zůstává podmět."""
    match = re.match(r"Tento druh (\S)(\S*)", text)
    # minulý čas (u vyhynulých: „žil“, „lovil“) závisí na rodu, podmět musí zůstat
    if not match or match.group(1) + match.group(2) in ("je", "není", "se", "si", "byl") or match.group(2).endswith("l"):
        return text
    return match.group(1).upper() + text[len("Tento druh ") + 1:]


def add_easter_egg(species):
    """Přidá EASTER_EGG mezi druhy třídy. Chybějící druh nebo tvrzení je chyba, ať vtípek tiše nezmizí."""
    by_name = {s["name"]: s for s in species}
    human = EASTER_EGG["species"]
    facts = [{"id": f"{human['id']}#{i}", "text": text, "cat": cat, "not": sorted(by_name[n]["id"] for n in others)}
             for i, (text, cat, others) in enumerate(EASTER_EGG["facts"])]
    for name, fact_id in EASTER_EGG["false_for_human"]:
        for f in by_name[name]["facts"]:
            if f["id"] == fact_id:  # test losování ohlídá, že jich zůstane dost
                f["not"].append(human["id"])
    species.append({**human, "facts": facts})


def write_game_data():
    """Do hry patří jen druhy s kontinenty, tedy po všech krocích, a třídy s dostatkem druhů."""
    roots = json.loads(ROOTS_FILE.read_text("utf-8"))["roots"]
    groups = {slug: {"slug": slug, "name": name, "kingdom": kingdom, "species": []} for slug, (_, name, kingdom) in GAME_GROUPS.items()
              if slug != "dvoudelozne"}
    groups.update({slug: {"slug": slug, "name": name, "kingdom": "rostliny", "species": []} for slug, name in DICOT_GROUPS.items()})
    groups.update({slug: {"slug": slug, "name": CLASSES[slug][1], "kingdom": "extra", "species": []} for slug in sorted(EXTRA)})
    others = {kingdom: {"slug": slug, "name": name, "kingdom": kingdom, "species": []} for kingdom, (slug, name) in OTHER_GROUPS.items()}
    # Extra má přednost: vyhynulý savec nebo mikroskopická řasa ze staršího stahování jde tam, ne do své říše.
    extra_of, clade = {}, {}
    for slug in EXTRA:
        file = paths(slug)[0] / "members.json"
        if file.exists():
            info = json.loads(file.read_text("utf-8"))
            extra_of.update(dict.fromkeys(info["members"], slug))
            clade.update({**dict.fromkeys(info.get("dinosaurs", []), "dinosaurs"), **dict.fromkeys(info.get("birds", []), "birds")})
    for slug, (_, _, kingdom) in CLASSES.items():
        file = paths(slug)[0] / "built.json"
        if not file.exists():
            continue
        for s in json.loads(file.read_text("utf-8"))["species"]:
            s["facts"] = [f for f in s["facts"] if f.pop("reviewed", False)]
            s["photos"] = [{k: v for k, v in p.items() if k not in ("reviewed", "i")} for p in s["photos"] if p.get("reviewed")]
            if s["continents"] and s["photos"]:
                s["latin"] = s["latin"] or LATIN_NAMES.get(s["id"], "")
                s["order"] = modern_order(s["order"], s["family"])
                own = set(roots.get(s["id"], []))
                key = extra_of.get(s["id"]) or next((key for key, cfg in GAME_GROUPS.items() if own & set(cfg[0].split())), None)
                if key == "dvoudelozne":
                    key = dicot_group(s["order"])
                if s["order"] in ORDERS_OF_FISH:
                    key = "ryby"
                (groups[key] if key else others[kingdom])["species"].append(s)
    for group in groups.values():
        if len(group["species"]) < MIN_CLASS_SPECIES and group["kingdom"] in others:
            others[group["kingdom"]]["species"] += group["species"]
            group["species"] = []
    for s in groups["savci"]["species"]:
        s["peers"] = peer_group(s)
    if groups[EASTER_EGG["class"]]["species"]:
        add_easter_egg(groups[EASTER_EGG["class"]]["species"])
    for group in [*groups.values(), *others.values()]:
        for s in group["species"]:
            s["emoji"] = species_emoji(group["slug"], {**s, "clade": clade.get(s["id"])})
    classes = [g for g in [*groups.values(), *others.values()] if len(g["species"]) >= MIN_CLASS_SPECIES]
    # odsazené kvůli ručnímu čtení a čitelným rozdílům v gitu, build.js odsazení při kompilaci odstraní
    (ROOT / "game" / "data.js").write_text("window.GAME_DATA = " + json.dumps(classes, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    {"fetch": fetch, "photos": more_photos, "retry": retry_photos, "fill": fill_photos, "wild": sync_wild_review, "human": sync_human_review,
     "foreign": fetch_foreign, "next": next_batch, "todo": todo, "build": build, "popularity": popularity}[sys.argv[1]](sys.argv[2])
