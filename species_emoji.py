"""Emoji pro každý druh ve hře: podle českého jména, latinského rodu nebo druhu, čeledi a řádu.

Pravidla se zkoušejí popořadě, platí první, které sedí. Na konci každé skupiny je výchozí emoji skupiny,
úplná záloha je hvězdička.
"""
import re

FALLBACK = "⭐"


def name(pattern):
    """Začátek českého jména, např. name("Lev|Tygr")."""
    rx = re.compile(rf"^(?:{pattern})(?:\s|$)")
    return lambda s: rx.search(s["name"])


def latin(pattern):
    """Začátek latinského jména: rod („Malus“) nebo rod a druh („Solanum tuberosum“)."""
    rx = re.compile(rf"^(?:{pattern})(?:\s|$)")
    return lambda s: rx.search(s["latin"].replace("× ", ""))


def family(*names):
    return lambda s: s["family"] in names


def order(*names):
    return lambda s: s["order"] in names


ANY = lambda s: True  # noqa: E731

SNAKES = ("zmijovití", "užovkovití", "korálovcovití", "hroznýšovití", "krajty", "krajtovkovití", "slepákovití", "slepanovití",
          "Psammophiidae", "Pareatidae", "Vodnářky", "Lamprophiidae", "Aniliidae", "duhovcovití", "slepýšovití", "Pygopodidae")
REEF_FISH = ("sapínovití", "bodlokovití", "pomcovití", "klipkovití", "pyskounovití", "Zanclidae", "Vřeténkovití", "ropušnicovití",
             "guramovití", "tetrovití", "živorodkovití", "vrubozubcovití", "Danionidae", "gudeovití", "afričtí halančíkovití", "čichavcovití")
SHARKS = ("žralouni", "obrouni", "malotlamci", "šedouni", "Ostrouni", "Různozubci", "polorejnoci")
TREES = ("bukovité", "břízovité", "vrbovité", "jilmovité", "ořešákovité", "olivovníkovité", "platanovité", "lipovité", "zederachovité",
         "myrtovité", "dřínovité", "vavřínovité", "morušovníkovité", "jírovcovité", "šácholanovité", "proteovité", "láhevníkovité", "zapotovité",
         "ebenovité")
# smrtelně jedovaté houby (amanitiny, orelanin, gyromitrin, imunitní reakce na čechratku)
DEADLY_FUNGI = latin("Amanita phalloides|Amanita virosa|Amanita verna|Galerina marginata|Lepiota castanea|Cortinarius orellanus"
                     "|Inosperma erubescens|Paxillus involutus|Gyromitra esculenta")
# na začátku obou skupin hub: rosolovky a padlí jsou na Wikidatech v různých odděleních
FUNGI = [
    (DEADLY_FUNGI, "☠️"),
    (name("Rosolovka mozkovitá|Mozkovka rosolovitá|Ucháč obrovský|Ucháč čepcovitý"), "🧠"), (name("Květnatec"), "🐙"),
    # cizopasné houby podle napadené rostliny
    (name("Padlí révové"), "🍇"), (name("Padlí jabloňové"), "🍎"), (name("Rez hrušňová"), "🍐"),
    (name("Americké padlí angreštové"), "🫐"), (name("Suchá skvrnitost listů peckovin"), "🍒"), (name("Rez travní"), "🌾"),
    (name("Rez vejmutovková"), "🌲"),
]

RULES = {
    "savci": [
        (lambda s: s.get("egg"), "🧑"),
        (name("Lev"), "🦁"), (name("Tygr"), "🐅"),
        (name("Levhart|Gepard|Jaguár|Irbis|Ocelot|Margay|Serval|Puma|Jaguarundi|Levhartka"), "🐆"),
        (family("kočkovití"), "🐈"),
        (name("Pes domácí"), "🐕"), (name("Vlk|Vlček|Šakal|Kojot|Dhoul|Pes hyenový|Vakovlk"), "🐺"),
        (name("Psík"), "🦝"), (family("psovití"), "🦊"),
        (name("Panda velká"), "🐼"), (name("Medvěd lední"), "🐻‍❄️"), (family("medvědovití"), "🐻"),
        (family("medvídkovití", "Pandy malé"), "🦝"),
        (name("Jezevec|Medojed|Rosomák"), "🦡"), (family("lasicovití"), "🦦"), (family("skunkovití"), "🦨"),
        (family("tuleňovití", "lachtanovití", "mrožovití", "kapustňákovití", "dugongovití"), "🦭"),
        (family("plejtvákovití", "velrybovití", "vorvaňovití", "vorvaňovcovití", "Eschrichtiidae"), "🐋"),
        (name("Kosatka"), "🫍"),
        (family("delfínovití", "sviňuchovití", "delfínovcovití", "Iniovití", "narvalovití"), "🐬"),
        (name("Los"), "🫎"), (family("jelenovití", "daněk", "Kabar", "kančilovití", "vidlorohovití"), "🦌"),
        (family("žirafovití"), "🦒"),
        (name("Velbloud jednohrbý"), "🐪"), (name("Velbloud"), "🐫"), (family("velbloudovití"), "🦙"),
        (family("hrochovití"), "🦛"), (name("Prase domácí"), "🐖"), (family("prasatovití", "pekariovití"), "🐗"),
        (name("Buvol|Anoa|Tamarau|Arni"), "🐃"), (name("Bizon|Zubr|Zubroň|Beefalo|Pižmoň"), "🦬"),
        (name("Skot|Tur domácí"), "🐄"), (name("Tur|Jak|Gaur|Banteng|Kouprej|Zebu"), "🐂"),
        (name("Koza|Kozorožec|Kamzík|Tahr|Serau|Goral|Takin|Markhur"), "🐐"),
        (name("Ovce domácí"), "🐑"), (name("Ovce|Muflon|Argali|Urial|Paovce|Nahur"), "🐏"),
        (family("turovití"), "🦌"),
        (name("Zebra"), "🦓"), (name("Osel|Kiang|Mula|Onagr"), "🫏"), (family("koňovití"), "🐎"),
        (family("nosorožcovití"), "🦏"), (name("Mamut"), "🦣"), (family("slonovití"), "🐘"),
        (name("Krysa|Potkan|Rypoš|Hutia-konga"), "🐀"),
        (name("Křeček|Křečík|Lumík|Hraboš|Hrabošík|Norník|Hryzec|Ondatra"), "🐹"),
        (name("Veverka|Veveřička|Ratufa|Svišť|Psoun|Čipmank|Burunduk|Poletucha|Poletuška|Sysel|Plch|Plšík"), "🐿️"),
        (family("bobrovití"), "🦫"), (family("dikobrazovití", "urzonovití"), "🦔"),
        (family("morčatovití", "činčilovití", "Agutiovití", "pakovití", "pakaranovití", "osmákovití", "korovití"), "🐹"),
        (order("hlodavci"), "🐁"),
        (family("pišťuchovití"), "🐹"), (order("zajícovci"), "🐇"),
        (family("ježkovití", "bodlínovití", "ježurovití"), "🦔"), (family("rejskovití", "štětinatcovití", "bércounovití"), "🐁"),
        (order("letouni"), "🦇"),
        (name("Gorila|Šimpanz"), "🦍"), (name("Orangutan"), "🦧"), (order("primáti"), "🐒"),
        (family("klokanovití", "klokánkovití"), "🦘"), (family("koalovití"), "🐨"),
        (family("vakoveverkovití", "vakoplšíkovití", "vakoplchovití"), "🐿️"),
        (family("vačicovití", "vačíci", "bandikutovití", "bandikutovití jemnosrstí"), "🐀"), (name("Vakomyš"), "🐀"),
        (family("lenochodovití tříprstí", "Megalonychidae"), "🦥"),
        (family("damanovití"), "🐹"), (family("tanovití"), "🐿️"),
        (ANY, "🐾"),
    ],
    "ptaci": [
        (name("Krocan"), "🦃"), (name("Kur"), "🐓"), (name("Páv"), "🦚"),
        (order("hrabaví", "Q15731102"), "🐔"),
        (family("tučňákovití"), "🐧"),
        (order("dravci", "sokoli"), "🦅"),
        (name("Labuť"), "🦢"), (name("Husa|Berneška|Husice|Husička|Kamiš|Čája|Husovec"), "🪿"), (family("kachnovití"), "🦆"),
        (order("sovy"), "🦉"), (name("Dronte"), "🦤"), (order("plameňáci"), "🦩"), (order("papoušci"), "🦜"),
        (family("krkavcovití"), "🐦‍⬛"), (name("Kos černý"), "🐦‍⬛"),
        (family("holubovití"), "🕊️"),
        (ANY, "🐦"),
    ],
    "plazi": [
        (order("krokodýli"), "🐊"), (order("želvy"), "🐢"), (family(*SNAKES), "🐍"), (ANY, "🦎"),
    ],
    "obojzivelnici": [
        (order("ocasatí", "Urodela"), "🦎"), (order("červoři"), "🪱"), (ANY, "🐸"),
    ],
    "ryby": [
        (name("Měsíčník"), "🐟"), (order("čtverzubci"), "🐡"), (family(*REEF_FISH), "🐠"), (name("Klaun|Bojovnice|Neonka"), "🐠"),
        (ANY, "🐟"),
    ],
    "paryby": [
        (order(*SHARKS), "🦈"), (ANY, "🐟"),
    ],
    "mekkysi": [
        (name("Praménka|Písečník"), "🐌"), (order("chobotnice"), "🐙"), (order("sépie", "Sepiolida"), "🦑"), (order("Nautilida"), "🐚"),
        (lambda s: s.get("clade") == "mlži", "🦪"),
        (order("Littorinimorpha", "Neogastropoda", "Trochida", "Patellida", "Chitonida"), "🐚"),
        (ANY, "🐌"),
    ],
    "ostatni_zivocichove": [
        (name("Talířovka|Kořenoústka|Medúzka|Medúza|Nezmar|Měchýřovka|Salpa"), "🪼"),
        (name("Korál|Sasanka|Sumka|Zřasenka|Turbinatka|Větevník"), "🪸"),
        (name("Hvězdice|Ježovka|Sumýš|Hadice|Lilijice"), "⭐"),
        (name("Houba"), "🧽"),
        (name("Mihule|Sliznatka"), "🐟"),
        (name("Stonoha|Strašník|Dlouženka|Stonožka|Mnohonožka|Plochule|Svinule|Mnohonožka"), "🐛"),
        (name("Podrepka|Larvěnka|Mákovka"), "🐜"),
        (name("Ostrorep"), "🦀"),
        (ANY, "🪱"),
    ],
    "hmyz": [
        (order("motýli"), "🦋"), (family("slunéčkovití"), "🐞"), (order("brouci", "škvoři"), "🪲"),
        (family("mravencovití"), "🐜"), (order("blanokřídlí"), "🐝"),
        (family("komárovití", "tiplicovití"), "🦟"), (order("dvoukřídlí"), "🪰"),
        (order("rovnokřídlí", "kudlanky", "strašilky"), "🦗"), (order("švábi", "Zygentoma"), "🪳"),
        (order("vážky", "jepice", "síťokřídlí", "srpice", "střechatky"), "🪰"),
        (ANY, "🪲"),
    ],
    "pavoukovci": [
        (order("štíři", "štírci"), "🦂"), (ANY, "🕷️"),
    ],
    "korysi": [
        (name("Rak|Humr"), "🦞"), (name("Krab"), "🦀"), (name("Vilejš|Coronula"), "🐚"), (order("stejnonožci"), "🪲"), (ANY, "🦐"),
    ],
    "nahosemenne": [
        (order("cykasotvaré"), "🌴"), (order("jinanotvaré"), "🌳"),
        (order("Welwitschiales", "chvojníkotvaré", "liánovcotvaré"), "🌿"), (ANY, "🌲"),
    ],
    "vytrusne": [
        (order("dvouhrotcotvaré", "ploníkotvaré", "rokytotvaré", "Andreaeales", "prutníkotvaré", "vranečkotvaré", "blánatcotvaré",
               "porostnicotvaré", "játrovkotvaré", "Marchantiales", "Jungermanniales", "rašeliníkotvaré", "hlevíkotvaré",
               "děrkavcotvaré", "baňatkotvaré", "zkrutkotvaré", "Hypnales", "Bryales", "Dicranales", "Pottiales", "Polytrichales",
               "Sphagnales", "Grimmiales", "Orthotrichales", "Funariales", "Bartramiales", "Hookeriales"), "🌱"),
        (name("Porostnice|Játrovka|Hlevík|Rašeliník|Měřík|Ploník|Rokytník|Kostrbatec|Bělomech|Rohozub|Štěrbovka|Dvouhrotec|"
              "Bezvláska|Baňatka|Lazovec|Vlasolistec|Křivonožka|Dřípovičník|Prutník|Měřík|Zkrutek|Rašeliník"), "🌱"),
        (ANY, "🌿"),
    ],
    "dvoudelozne": [
        # co se z rostliny vyrábí, je zábavnější než obecný list nebo kvítek
        (latin("Theobroma cacao"), "🍫"), (latin("Ilex paraguariensis"), "🧉"), (latin("Acer saccharum"), "🥞"),
        (latin("Cola acuminata|Cola nitida|Paullinia cupana"), "🥤"), (latin("Glycyrrhiza glabra|Stevia rebaudiana"), "🍬"),
        (latin("Aspalathus linearis|Matricaria chamomilla|Ilex guayusa"), "🍵"),
        (latin("Sesamum indicum"), "🥯"), (latin("Manihot esculenta"), "🧋"),
        (latin("Rheum rhabarbarum"), "🥧"), (latin("Capsicum annuum"), "🫑"),
        (latin("Solanum lycopersicum"), "🍅"), (latin("Solanum tuberosum"), "🍟"), (latin("Solanum melongena"), "🍆"),
        (latin("Capsicum"), "🌶️"),
        (latin("Malus"), "🍎"), (latin("Pyrus|Cydonia"), "🍐"), (latin("Prunus persica"), "🍑"),
        (latin("Prunus avium|Prunus cerasus"), "🍒"), (latin("Prunus"), "🌸"), (latin("Fragaria"), "🍓"), (latin("Rosa"), "🌹"),
        (latin("Rubus|Vaccinium|Ribes"), "🫐"),
        (latin("Citrus limon|Citrus medica|Microcitrus"), "🍋"), (latin("Citrus"), "🍊"),
        (latin("Vitis"), "🍇"), (latin("Actinidia"), "🥝"), (latin("Persea"), "🥑"), (latin("Mangifera|Carica"), "🥭"),
        (latin("Olea"), "🫒"), (latin("Arachis"), "🥜"), (latin("Phaseolus|Vigna|Glycine|Lens|Cicer|Vicia faba|Lablab"), "🫘"),
        (latin("Pisum"), "🫛"), (latin("Castanea|Juglans|Corylus|Macadamia|Anacardium occidentale|Pistacia vera|Bertholletia"), "🌰"),
        (latin("Cucumis sativus"), "🥒"), (latin("Cucumis melo"), "🍈"), (latin("Citrullus"), "🍉"), (latin("Cucurbita"), "🎃"),
        (latin("Daucus"), "🥕"), (latin("Brassica oleracea"), "🥦"), (latin("Brassica|Lactuca|Spinacia|Beta"), "🥬"),
        (latin("Ipomoea batatas"), "🍠"), (latin("Coffea"), "☕"), (latin("Camellia sinensis"), "🍵"),
        (latin("Helianthus"), "🌻"), (latin("Acer"), "🍁"), (latin("Trifolium|Oxalis|Melilotus|Medicago"), "☘️"),
        (latin("Hibiscus|Papaver|Alcea|Malva"), "🌺"), (latin("Nymphaea|Nuphar|Nelumbo|Victoria"), "🪷"),
        (latin("Lavandula|Salvia|Hyssopus|Thymus|Campanula|Viola|Myosotis|Lupinus|Delphinium|Aconitum"), "🪻"),
        (family("kaktusovité"), "🌵"), (family("leknínovité", "lotosovité"), "🪷"),
        (family("hvězdnicovité", "pryskyřníkovité", "prvosenkovité", "brukvovité"), "🌼"),
        (family("hluchavkovité", "zvonkovité", "brutnákovité", "violkovité"), "🪻"),
        (latin("Tilia|Durio|Theobroma|Ceiba|Adansonia|Bombax|Ochroma|Cola|Brachychiton|Pachira"), "🌳"),
        (family("slézovité", "makovité", "mučenkovité"), "🌺"), (family("tykvovité"), "🥒"),
        (family("růžovité", "hvozdíkovité", "vřesovcovité", "bobovité", "hořcovité", "kakostovité", "pupalkovité", "zimolezovité",
                "pižmovkovité", "lomikamenovité", "tlusticovité", "hortenziovité", "kalinovité", "toješťovité", "mořenovité",
                "zárazovité", "jitrocelovité", "krtičníkovité", "rosnatkovité", "lnovité", "svlačcovité", "netýkavkovité",
                "vrabečnicovité", "trubačovité", "cistovité", "jirnicovité", "čajovníkovité", "pivoňkovité"), "🌸"),
        (family("mýdelníkovité", *TREES), "🌳"),
        (ANY, "🌿"),
    ],
    "jednodelozne": [
        (latin("Triticum aestivum"), "🥖"), (latin("Triticum durum"), "🍝"), (latin("Triticum spelta|Secale cereale"), "🍞"),
        (latin("Oryza sativa"), "🍚"), (latin("Avena sativa|Avena nuda|Panicum miliaceum"), "🥣"), (latin("Saccharum officinarum"), "🍭"),
        (latin("Vanilla planifolia"), "🍦"),
        (latin("Zea"), "🌽"), (latin("Allium cepa|Allium porrum|Allium schoenoprasum|Allium fistulosum"), "🧅"), (latin("Allium"), "🧄"),
        (latin("Cocos"), "🥥"), (latin("Ananas"), "🍍"), (latin("Musa|Ensete"), "🍌"), (latin("Zingiber"), "🫚"),
        (latin("Tulipa|Lilium|Fritillaria|Erythronium"), "🌷"),
        (latin("Galanthus|Narcissus|Leucojum|Gagea|Sternbergia"), "🌼"),
        (latin("Agave amica|Polianthes"), "🌸"), (latin("Agave|Yucca|Aloe"), "🌵"),
        (family("zázvorníkovité"), "🫚"), (family("ocúnovité"), "🌸"),
        (latin("Iris|Crocus|Hyacinthus|Muscari|Scilla|Gladiolus|Agapanthus"), "🪻"),
        (family("lipnicovité", "šáchorovité", "sítinovité", "orobincovité"), "🌾"),
        (family("arekovité"), "🌴"), (family("liliovité"), "🌷"), (family("kosatcovité", "hyacintovité"), "🪻"),
        (family("vstavačovité", "bromeliovité", "strelíciovité", "kanovité", "Heliconiaceae"), "🌺"),
        (family("amarylkovité"), "🌼"), (family("chřestovité", "asfodelovité"), "🌸"),
        (ANY, "🌿"),
    ],
    "stopkovytrusne": [
        *FUNGI, (name("Pýchavka|Prášivka"), "💨"), (name("Hvězdovka|Hvězdák"), "⭐"), (name("Kuřátka"), "🪸"),
        (latin("Auricularia auricula-judae"), "👂"), (latin("Pleurotus ostreatus"), "🦪"), (latin("Ustilago maydis"), "🌽"),
        (latin("Phallus impudicus"), "🪰"), (latin("Psilocybe"), "🌈"),
        (latin("Amanita"), "🍄"), (ANY, "🍄‍🟫"),
    ],
    "vreckovytrusne": [
        *FUNGI, (latin("Claviceps purpurea"), "🌾"), (name("Smrž"), "🧽"), (name("Housenice"), "🐛"),
        # lišejníky na kamenech a kůře; dutohlávky, hávnatka a pukléřka islandská rostou hlavně na zemi
        (latin("Amandinea|Hypogymnia|Rhizocarpon|Lecanora|Vulpicida|Xanthoria|Evernia|Cladonia coniocraea"), "🪨"),
        (ANY, "🍄‍🟫"),
    ],
}


for _dicots in ("rosidy", "asteridy", "ostatni_dvoudelozne"):  # dvouděložné jsou ve hře ve třech skupinách
    RULES[_dicots] = RULES["dvoudelozne"]
# Extra: „clade“ doplní pipeline podle stromu na Wikidatech (ptáci jsou na Wikidatech i dinosauři).
RULES["vyhynula_zvirata"] = [
    (name("Mamut"), "🦣"), (name("Dronte"), "🦤"), (lambda s: s.get("clade") == "birds", "🐦"),
    (lambda s: s.get("clade") == "dinosaurs", "🦖"), (ANY, "🦴"),
]
RULES["mikroorganismy"] = [(ANY, "🦠")]
RULES["endoparaziti"] = [(ANY, "🪱")]


def species_emoji(group, species):
    for test, emoji in RULES.get(group, []):
        if test(species):
            return emoji
    return FALLBACK


if __name__ == "__main__":
    def sp(n, la, fam="", o=""):
        return {"name": n, "latin": la, "family": fam, "order": o}
    assert species_emoji("savci", sp("Lev", "Panthera leo", "kočkovití", "šelmy")) == "🦁"
    assert species_emoji("savci", sp("Levhart skvrnitý", "Panthera pardus", "kočkovití", "šelmy")) == "🐆"
    assert species_emoji("savci", sp("Liška obecná", "Vulpes vulpes", "psovití", "šelmy")) == "🦊"
    assert species_emoji("savci", sp("Lasice kolčava", "Mustela nivalis", "lasicovití", "šelmy")) == "🦦"
    assert species_emoji("dvoudelozne", sp("Třešeň ptačí", "Prunus avium", "růžovité")) == "🍒"
    assert species_emoji("dvoudelozne", sp("Slivoň švestka", "Prunus domestica", "růžovité")) == "🌸"
    assert species_emoji("stopkovytrusne", sp("Muchomůrka červená", "Amanita muscaria")) == "🍄"
    assert species_emoji("stopkovytrusne", sp("Muchomůrka zelená", "Amanita phalloides")) == "☠️"
    assert species_emoji("vreckovytrusne", sp("Ucháč obecný", "Gyromitra esculenta")) == "☠️"
    assert species_emoji("stopkovytrusne", sp("Pýchavka obrovská", "Calvatia gigantea")) == "💨"
    assert species_emoji("vreckovytrusne", sp("Terčovník zední", "Xanthoria parietina")) == "🪨"
    assert species_emoji("vreckovytrusne", sp("Dutohlávka sobí", "Cladonia rangiferina")) == "🍄‍🟫"
    assert species_emoji("vreckovytrusne", sp("Ucháč obrovský", "Gyromitra gigas")) == "🧠"
    assert species_emoji("stopkovytrusne", sp("Rez hrušňová", "Gymnosporangium sabinae")) == "🍐"
    assert species_emoji("asteridy", sp("Cesmína paraguayská", "Ilex paraguariensis", "cesmínovité")) == "🧉"
    assert species_emoji("rosidy", sp("Kakaovník pravý", "Theobroma cacao", "slézovité")) == "🍫"
    assert species_emoji("rosidy", sp("Kakaovník velkokvětý", "Theobroma grandiflorum", "slézovité")) == "🌳"
    assert species_emoji("jednodelozne", sp("Pšenice setá", "Triticum aestivum", "lipnicovité")) == "🥖"
    assert species_emoji("asteridy", sp("Paprika křídlatá", "Capsicum baccatum", "lilkovité")) == "🌶️"
    assert species_emoji("neznámá", sp("X", "Y")) == FALLBACK
    print("OK")
