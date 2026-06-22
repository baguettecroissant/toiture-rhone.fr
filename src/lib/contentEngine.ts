import communes from '../data/communes.json';
import { getSmartNearbyCommunes } from './geoLinks';

export interface Commune {
  nom: string;
  slug: string;
  codeInsee: string;
  codePostal: string;
  population: number;
  latitude?: number;
  longitude?: number;
  intercommunalite?: string;
  introText?: string;
  conseilLocal?: string;
  faq?: { q: string; a: string }[];
  marketData?: {
    couvreursRGE: number;
    prixM2Refection: number;
    prixM2Demoussage: number;
    delaiMoyenJours: number;
  };
}

export function getDynamicPrices(commune: Commune) {
  const rPrice = commune.marketData?.prixM2Refection || 135;
  const dPrice = commune.marketData?.prixM2Demoussage || 25;
  
  return {
    refectionZinc: { min: Math.round(rPrice * 1.05), max: Math.round(rPrice * 1.45) },
    refectionMeca: { min: Math.round(rPrice * 0.70), max: Math.round(rPrice * 1.1) },
    refectionArdoise: { min: Math.round(rPrice * 0.95), max: Math.round(rPrice * 1.35) },
    demoussageHydro: { min: Math.round(dPrice * 0.8), max: Math.round(dPrice * 1.2) },
    reparationFuite: { min: 350, max: 1200 },
    faitageMl: { min: 40, max: 80 },
    zinguerieMl: { min: 55, max: 100 },
    isolationSarking: { min: 90, max: 170 },
    charpenteM2: { min: 70, max: 130 },
    etancheiteTerrasse: { min: 60, max: 110 }
  };
}

// Deterministic PRNG to ensure stable output for identical inputs
class SeededRandom {
  private state: number;

  constructor(seedStr: string) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    this.state = h >>> 0;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

// Recursive spintax parser that resolves `{A|B|{C|D}}` from inside out
export function parseSpintax(slug: string, key: string, template: string): string {
  const prng = new SeededRandom(slug + "-" + key);
  let text = template;
  
  const braceRegex = /\{([^{}]+)\}/;
  let match;
  while ((match = braceRegex.exec(text)) !== null) {
    const options = match[1].split('|');
    const chosenIndex = prng.nextInt(options.length);
    const chosen = options[chosenIndex];
    text = text.slice(0, match.index) + chosen + text.slice(match.index + match[0].length);
  }
  return text;
}

// Helper to substitute variables
function replaceVariables(template: string, vars: Record<string, string>): string {
  let text = template;
  for (const [key, val] of Object.entries(vars)) {
    text = text.split(`{${key}}`).join(val);
  }
  return text;
}

export function generateCommuneContent(commune: Commune, pageType: 'refection' | 'demoussage' | 'artisan') {
  const rPrice = commune.marketData?.prixM2Refection || 135;
  const dPrice = commune.marketData?.prixM2Demoussage || 25;
  const minRPrice = Math.round(rPrice * 0.9);
  const maxRPrice = Math.round(rPrice * 1.3);
  const minDPrice = Math.round(dPrice * 0.8);
  const maxDPrice = Math.round(dPrice * 1.2);
  const rge = commune.marketData?.couvreursRGE || 3;
  const delays = commune.marketData?.delaiMoyenJours || 15;
  const pop = commune.population || 5000;

  const slug = commune.slug;

  // 1. Geographic Classification (Lyon Metro, Beaujolais, Monts du Lyonnais)
  const lat = commune.latitude || 45.76;
  const lon = commune.longitude || 4.83;
  
  let geoZone: 'lyon_metro' | 'beaujolais' | 'monts_lyonnais' = 'lyon_metro';
  if (lat > 45.9) {
    geoZone = 'beaujolais';
  } else if (lon < 4.65) {
    geoZone = 'monts_lyonnais';
  }

  // 2. City Density Classification
  const density: 'city' | 'village' = pop > 25000 ? 'city' : 'village';

  // 3. Smart local neighbor communes
  const nearby = getSmartNearbyCommunes(slug, communes as any[], 4, 0);
  const nearbyNames = nearby.map(n => n.nom).join(', ');
  const proxC1 = nearby[0]?.nom || "Lyon";
  const proxC2 = nearby[1]?.nom || "Villeurbanne";
  const proxC3 = nearby[2]?.nom || "Vénissieux";
  const proxC4 = nearby[3]?.nom || "Caluire-et-Cuire";

  // Variables mapping for substitution
  const vars: Record<string, string> = {
    VILLE: commune.nom,
    ZIP: commune.codePostal,
    DEPARTEMENT: "Rhône",
    DEPARTEMENT_CODE: "69",
    MIN_PRIX_REF: minRPrice.toString(),
    MAX_PRIX_REF: maxRPrice.toString(),
    MIN_PRIX_DEM: minDPrice.toString(),
    MAX_PRIX_DEM: maxDPrice.toString(),
    RGE_NB: rge.toString(),
    DELAIS: delays.toString(),
    POPULATION: pop.toLocaleString('fr-FR'),
    INTERCO: commune.intercommunalite || "la métropole lyonnaise",
    PROX_C1: proxC1,
    PROX_C2: proxC2,
    PROX_C3: proxC3,
    PROX_C4: proxC4
  };

  // --- Dynamic text templates ---

  // Title templates
  let titleTemplate = "";
  if (pageType === 'refection') {
    titleTemplate = "{Réfection|Rénovation|Remplacement|Réfection complète} de {toiture|toit|couverture} à {VILLE} ({ZIP}) : {Devis Couvreur RGE|Couvreur-Zingueur Qualifié|Comparez 3 Tarifs|Artisan Décennale}";
  } else if (pageType === 'demoussage') {
    titleTemplate = "{Démoussage|Nettoyage|Nettoyage de toiture|Entretien et démoussage} à {VILLE} ({ZIP}) : {Prix & Devis|Traitement Hydrofuge|Tarifs 2026 de couvreur|Nettoyage professionnel}";
  } else {
    titleTemplate = "{Trouver un Couvreur RGE|Artisan Couvreur|Meilleur Couvreur|Couvreur-Zingueur} à {VILLE} ({ZIP}) : {Devis Gratuits|Comparez les Tarifs|Rénovation de Toiture RGE}";
  }

  // Intro Paragraph templates
  let introTemplate = "";
  if (pageType === 'refection') {
    introTemplate = "{{Votre toiture|Le toit de votre maison|La couverture de votre habitation} à {VILLE} {présente des signes d'usure|commence à montrer des faiblesses|semble fatiguée ou subit des infiltrations} ? {Nos couvreurs-zingueurs partenaires|Nos artisans couvreurs locaux|Les entreprises de couverture de notre réseau}, qualifiés RGE et certifiés Qualibat, {interviennent rapidement|sont à votre disposition|se déplacent chez vous} pour une {rénovation complète|réfection partielle ou totale|remise à neuf conforme aux normes DTU 40.41}. {Pour ce type de projet dans le Rhône|Sur votre secteur de {VILLE}}, il faut compter {en moyenne|un budget de} {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m² {fourniture et pose comprises|tout inclus}, {selon la complexité du toit|selon les matériaux retenus (zinc, tuile ou ardoise)} et avec la garantie décennale.|{Besoin d'une réfection de toiture|Pour refaire à neuf le toit de votre maison} à {VILLE} ({ZIP}) ? {Faites appel à un couvreur RGE|confiez vos travaux à un professionnel qualifié} du département du {DEPARTEMENT}. Spécialisés dans les toitures traditionnelles en {tuiles canal de terre cuite|zinc à joint debout}, nos partenaires réalisent un diagnostic gratuit de votre support. Les tarifs moyens constatés pour une réfection de couverture sur {VILLE} {se situent entre|oscillent entre} {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ par m², {éligibles aux subventions énergétiques nationales|vous permettant de bénéficier de la TVA réduite à 5,5% et des aides de l'ANAH}.}";
  } else if (pageType === 'demoussage') {
    introTemplate = "{{L'accumulation de mousses|La présence de lichens, de mousses|La prolifération de micro-organismes et de suie} sur votre toit à {VILLE} {rend vos tuiles poreuses|compromet l'étanchéité des matériaux|risque de provoquer des fissures lors du gel}. {Un démoussage complet et minutieux|Un nettoyage hydrofuge professionnel|L'application d'un traitement fongicide de surface} {permet de restaurer|redonne une seconde jeunesse à|protège durablement} votre couverture. Comptez {généralement|un tarif moyen de} {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€ le m² à {VILLE} pour {ce type d'entretien de toiture|un nettoyage complet avec traitement algicide et hydrofuge perlant}.|{À {VILLE} ({ZIP}), les précipitations et le gel hivernal|Le climat humide et les variations thermiques à {VILLE}} favorisent le développement des végétaux sur les toits. {Notre réseau de couvreurs partenaires|Un artisan couvreur qualifié} réalise le nettoyage et le traitement {hydrofuge incolore ou coloré|sans chlore pour préserver l'intégrité de vos tuiles}. Ce traitement préventif et curatif, tarifé entre {MIN_PRIX_DEM}€ et {MAX_PRIX_DEM}€ le m², {prolonge la durée de vie de votre toit de 15 ans|évite des frais de réfection complète prématurés}.}";
  } else {
    introTemplate = "{Vous recherchez {un couvreur RGE de confiance|un artisan couvreur qualifié|un couvreur-zingueur disponible} à {VILLE} ({ZIP}) ? {Comparez rapidement 3 devis|Obtenez des chiffrages détaillés|Bénéficiez d'un diagnostic toiture gratuit} de la part de professionnels certifiés Qualibat RGE actifs sur {la commune|votre secteur}. Que ce soit pour {une simple réparation de fuite|une rénovation complète|une isolation par l'extérieur en sarking}, profitez d'une mise en relation directe sans engagement.|{Trouver le bon artisan pour vos travaux de toiture|Sélectionner un couvreur qualifié et assuré} à {VILLE} est essentiel pour garantir la pérennité de votre toit. Nous trions sur le volet {les meilleurs couvreurs du {DEPARTEMENT_CODE}|les spécialistes de la couverture zinc et tuile dans le secteur de {VILLE}}. {Accédez à des chiffrages clairs|Recevez des propositions sur-mesure} sous {DELAIS} jours et assurez-vous d'obtenir {les aides de l'État (MaPrimeRénov')|un travail de qualité couvert par la garantie décennale réglementaire}.}";
  }

  // Climate Context templates
  let climateTemplate = "";
  if (geoZone === 'lyon_metro') {
    climateTemplate = "{En zone urbaine dense à {VILLE}|Sur la métropole lyonnaise à {VILLE}|Dans le bassin lyonnais}, les toitures sont exposées {à la pollution atmosphérique et aux suies|aux micro-particules de pollution et aux variations thermiques}. {Les toits en zinc des immeubles anciens|Les toitures en zinc naturel ou en tuiles mécaniques} {subissent une corrosion accélérée|se ternissent plus vite et accumulent des dépôts acides}. {Nos experts recommandent|Les artisans couvreurs conseillent} {l'application régulière de traitements hydrofuges protecteurs|un nettoyage périodique et la pose d'écrans sous-toiture HPV pour réguler la condensation sous les toits de copropriété}. {De plus, les étés de plus en plus chauds|Avec le réchauffement urbain et les canicules}, {une isolation à fort déphasage (laine de bois) est primordiale|la pose d'isolants performants est requise pour préserver le confort thermique des combles}.";
  } else if (geoZone === 'beaujolais') {
    climateTemplate = "{Dans le secteur viticole du Beaujolais autour de {VILLE}|Dans les vallons du Beaujolais à {VILLE}|Sur les coteaux de {VILLE}}, {l'humidité des vallées et le vent de Saône|l'exposition aux vents humides} favorisent le développement rapide des {lichens jaunes et des mousses épaisses|mousses sur les pentes orientées nord}. {Le respect du patrimoine historique|La préservation de l'architecture locale} impose {l'usage de tuiles canal en terre cuite|le recours aux tuiles ocre et rouge naturel}. {Les règles locales de {VILLE}|Les règlements d'urbanisme locaux} encadrent {les teintes autorisées pour s'intégrer aux bâtisses en pierres dorées|les projets de rénovation afin de conserver l'harmonie chromatique avec le vignoble beaujolais}.";
  } else {
    climateTemplate = "{En altitude dans les Monts du Lyonnais à {VILLE}|Dans le secteur montagneux et vallonné de {VILLE}|Dans l'Ouest Rhodanien vers {VILLE}}, {les hivers rudes avec neige et gel prolongé|le climat montagnard et les gelées intenses} exercent {une pression mécanique importante sur les charpentes|des contraintes sévères sur les matériaux de couverture}. {Une attention particulière doit être portée|Les couvreurs doivent veiller} {au dimensionnement de la structure bois|au poids supporté par la charpente en cas de fortes chutes de neige}. {Il est recommandé de poser des tuiles certifiées non gélives|La pose d'arrêts de neige et l'installation d'une isolation extérieure de type Sarking} {sont indispensables pour éviter les infiltrations et les ponts thermiques|permettent de prévenir la formation de barrières de glace destructrices au niveau des gouttières}.";
  }

  // ABF Regulations template
  const abfTemplate = "{{Si votre projet à {VILLE} {se situe en secteur sauvegardé|est à proximité d'un monument historique ou d'un site classé|est soumis à l'avis des Architectes des Bâtiments de France (ABF)}, {les contraintes esthétiques sont strictes|vous devrez respecter des normes strictes de matériaux}. {Le zinc naturel à joint debout ou les tuiles terre cuite ocre-rouge|L'ardoise naturelle posée au crochet ou la tuile canal traditionnelle} {sont souvent obligatoires|sont exigés en remplacement des matériaux modernes}. {Toute modification d'aspect extérieur exige|Il convient de déposer} une Déclaration Préalable (DP) en mairie de {VILLE} {avant de lancer les travaux|pour valider la conformité architecturale de la couverture}.}|{{Les règles d'urbanisme (PLU) de {VILLE}|Le Plan Local d'Urbanisme de {VILLE}} encadre précisément la rénovation de toiture. {Les matériaux composites, le bac acier brut ou les gouttières en PVC de couleur|L'imitation ardoise ou le PVC brillant} {sont proscrits dans la majorité des quartiers historiques|sont strictement interdits sur le secteur}. {Nos couvreurs certifiés RGE vous guideront|Les artisans partenaires vous conseillent} {dans le choix de matériaux conformes (zinc naturel, terre cuite mate)|dans la constitution de votre dossier de travaux en mairie}.}}";

  // Housing Typology templates
  let housingTemplate = "";
  if (density === 'city') {
    housingTemplate = "{Le parc de logements à {VILLE} se caractérise par {une forte proportion de copropriétés et d'immeubles collectifs|des bâtiments de ville mitoyens et des immeubles anciens}. {Les chantiers de toiture nécessitent|La réfection de couverture y exige} {une logistique rigoureuse : échafaudage de voirie avec demande d'occupation du domaine public en mairie, monte-matériaux ou grutage|une coordination avec le syndic de copropriété et la sécurisation du passage des piétons}. {Le raccordement des rives et des solins de cheminées|L'étanchéité des raccords entre bâtiments mitoyens} {est un point de vigilance crucial pour éviter tout litige de voisinage|doit être traité avec le plus grand soin par les couvreurs-zingueurs}.}";
  } else {
    housingTemplate = "{À {VILLE}, l'habitat est essentiellement composé de {pavillons individuels, de villas récentes et de corps de ferme restaurés|maisons individuelles et d'anciennes fermes en pierre}. {La charpente en bois (sapin ou chêne)|La structure bois traditionnelle} {doit faire l'objet d'un examen phytosanitaire|est inspectée minutieusement avant la pose de la couverture} afin de déceler d'éventuelles attaques de capricornes ou de vrillettes. {De plus, la proximité d'arbres|La présence de végétation environnante} {rend indispensable l'installation de grilles pare-feuilles sur les gouttières zinc|impose un nettoyage régulier des naissances de gouttières pour éviter tout engorgement d'eau de pluie}.}";
  }

  // Energy Profile template
  const energyTemplate = "{Saviez-vous que la toiture représente {jusqu'à 30% des déperditions thermiques|près d'un tiers des pertes de chaleur} d'une maison mal isolée à {VILLE} ? {Isoler vos combles ou opter pour une isolation par l'extérieur (sarking)|La mise en œuvre d'une isolation sous rampants lors de la réfection} {est l'investissement le plus rentable|permet de réduire drastiquement vos factures énergétiques}. {Cette opération améliore instantanément la classe DPE|Cette démarche valorise directement la note du Diagnostic de Performance Énergétique (DPE)} de votre bien immobilier à {VILLE}.|{La rénovation thermique globale du toit à {VILLE}|L'isolation thermique de la toiture dans le {DEPARTEMENT_CODE}} est devenue une priorité pour faire face aux hausses de l'énergie. {En associant la pose de tuiles neuves à une isolation performante (laine de roche ou fibre de bois)|En installant un pare-vapeur et un isolant thermique certifié}, vous réduisez vos besoins de chauffage en hiver et {gardez la fraîcheur sous combles pendant les étés rhodaniens|limitez la surchauffe des pièces mansardées en plein été}.}";

  // Real Estate templates
  const realEstateTemplate = "{Investir dans {la réfection de sa couverture|la rénovation de sa toiture} à {VILLE} {valorise significativement votre patrimoine immobilier|constitue une valeur refuge pour votre habitation}. {Un toit neuf, sain et isolé|Une toiture en zinc ou en tuiles garantie 10 ans} {est un argument déclencheur lors d'une vente immobilière dans le Rhône|rassure les futurs acheteurs et permet d'éviter les négociations de prix à la baisse}. {Cela protège également la structure du bâtiment contre les infiltrations|Cette rénovation sécurise la charpente et les plafonds pour les 30 prochaines années}.|{Sur le marché immobilier dynamique de {VILLE}|Pour valoriser un bien immobilier à {VILLE}}, {l'état de la toiture est scruté par les acquéreurs et les experts d'assurances|la toiture est le premier rempart visible contre les intempéries}. {Une rénovation complète avec facture et garantie décennale à l'appui|Un entretien certifié par un artisan RGE} {apporte une vraie plus-value et évite les mauvaises surprises lors des audits énergétiques obligatoires|permet de justifier un prix de vente au m² dans la fourchette haute du marché local}.}";

  // Local Profile templates
  const localProfileTemplate = "{{Située au cœur de la collectivité {INTERCO} dans le département du {DEPARTEMENT}, la commune de {VILLE} ({ZIP}) {possède un caractère architectural typique|abrite un patrimoine de maisons et de bâtiments à préserver}. {L'entretien régulier des toits et la rénovation des couvertures|La rénovation de l'habitat et la lutte contre les passoires thermiques} {sont des enjeux locaux majeurs pour les propriétaires du secteur|y font l'objet d'aides ciblées de la part des collectivités territoriales}. {Nos couvreurs locaux interviennent quotidiennement|Les artisans couvreurs-zingueurs partenaires y travaillent régulièrement} pour redonner de l'éclat aux habitations de {VILLE}.|La commune de {VILLE} ({ZIP}), intégrée à {INTERCO}, se caractérise par {un climat de transition marqué par des hivers parfois rigoureux et des étés chauds|un relief et une exposition climatique qui sollicitent fortement les toits en zinc, en tuile ou en ardoise}. {Afin de préserver la valeur des habitations et de garantir la sécurité face aux intempéries|Pour valoriser le bâti et assurer l'étanchéité à long terme}, {l'entretien de la toiture doit être confié à des artisans locaux qualifiés RGE|il est capital de faire appel à des couvreurs connaissant parfaitement les spécificités des vents et des gelées sur le {DEPARTEMENT_CODE}}.}}\n\n{{Avec sa population de {POPULATION} habitants, {VILLE} {connaît un développement soutenu de ses projets de rénovation|voit de nombreux propriétaires entreprendre des travaux d'amélioration énergétique}. {La couverture de toit y est l'élément le plus exposé aux intempéries rhodaniennes|La rénovation des toitures y est encouragée pour améliorer l'efficacité thermique globale}. {Que votre logement soit une maison contemporaine ou un immeuble ancien|Que vous possédiez une maison de ville ou un pavillon}, {nos partenaires vous accompagnent dans tous vos travaux de zinguerie, charpente et couverture|nos équipes partenaires adaptent leur savoir-faire traditionnel aux exigences modernes du PLU de {VILLE}}.}|{Pour vos projets de toiture à {VILLE}, faire appel à un couvreur qualifié RGE est le meilleur moyen de s'assurer de la conformité du chantier. En s'appuyant sur des matériaux certifiés et des techniques de pose traditionnelles ou modernes, nos artisans partenaires assurent la protection à long terme de votre patrimoine immobilier dans le Rhône. Les aides de l'ANAH et du département peuvent d'ailleurs alléger significativement votre facture totale de travaux de couverture.}}";

  // Roofer recommendation (tip)
  const tipTemplate = "{Conseil de couvreur-zingueur : {sur les toitures en zinc lyonnaises|pour les toits à faible pente}, {l'installation d'un écran sous-toiture HPV (Hautement Perméable à la Vapeur) est incontournable|veillez à ce que la ventilation sous-tuile soit optimale pour éviter la condensation}. {Cela protège la charpente en bois de l'humidité stagnante|Cela empêche le pourrissement précoce des liteaux et voliges}.|{Astuce de pro : {n'utilisez jamais de nettoyeur haute pression à bout portant sur des tuiles en terre cuite|évitez les produits de démoussage contenant du chlore ou de l'acide}}. {Cela détruit le vernis de protection de la tuile|Ces produits rendent la tuile poreuse et gélive}. {Privilégiez des traitements fongicides biodégradables à action lente avec hydrofuge perlant|Exigez l'application d'un hydrofuge incolore respectueux du support}.|{Info pratique : {les travaux d'isolation (combles ou sarking) réalisés en même temps que la toiture par un artisan RGE|le recours à un couvreur qualifié RGE pour vos travaux de toiture et d'isolation}} {permettent de bénéficier de MaPrimeRénov' et de la TVA à 5,5%|ouvrent droit aux aides de la Métropole de Lyon et aux certificats d'économie d'énergie (CEE)}.}";

  // Table Intro template
  const tableIntroTemplate = "{{Découvrez ci-dessous la grille des tarifs moyens indicatifs|Voici le tableau des prix moyens constatés au m²|Retrouvez les estimations budgétaires de référence} pour les prestations de {couverture, de zinguerie et d'isolation|rénovation, de nettoyage et d'étanchéité} à {VILLE} ({ZIP}) pour l'année 2026. {Ces tarifs fluctuent selon la pente du toit, le matériau (zinc, tuile canal, ardoise) et la hauteur du bâtiment|Ces coûts sont hors taxes et indicatifs, à affiner via un devis gratuit prenant en compte les spécificités de votre chantier}.|{{Voici un aperçu des prix pratiqués par les artisans couvreurs du Rhône|Ce tableau récapitule les budgets à prévoir} sur le secteur de {VILLE}. {Les montants incluent la fourniture et la pose par un artisan assuré en décennale|Nous vous conseillons de demander plusieurs devis pour comparer les offres en fonction des accès et de la complexité du toit}.}}";

  // Expert tip template
  const expertTipTemplate = "{Inspectez l'état des closoirs de faîtage et des solins en mortier ou plomb après chaque hiver pour prévenir les infiltrations d'eau.|Pensez à vider et nettoyer les gouttières et chéneaux en zinc à la fin de l'automne pour faciliter l'évacuation des eaux de pluie et de la neige.|L'application d'un hydrofuge perlant incolore sur tuiles nettoyées garantit une protection contre l'humidité et le gel pendant 10 ans.}";

  // Savings estimate template
  const savingsTemplate = "{Une isolation de toiture performante (sarking ou sous rampants) réduit jusqu'à 30% vos dépenses de chauffage à {VILLE}.|Un entretien régulier (démoussage + hydrofuge) retarde de 15 ans la nécessité de refaire à neuf votre toiture.|Les subventions de l'ANAH et de {INTERCO} peuvent financer jusqu'à 50% du montant de vos travaux d'isolation thermique.}";

  // Diagnostic Energétique template
  const diagnosticTemplate = "{Un diagnostic toiture régulier permet d'anticiper les fuites et de vérifier l'intégrité de la charpente bois.|Nos artisans partenaires effectuent un contrôle visuel de votre toiture et de sa zinguerie pour détecter tout défaut d'étanchéité.|Un bilan d'isolation thermique par caméra thermique est la solution idéale pour cibler les déperditions de votre toit à {VILLE}.}";

  // Calendrier Renovation template
  const calendarTemplate = "{Le remplacement complet d'une toiture de 100 m² à {VILLE} s'étale sur 5 à 10 jours ouvrés selon les conditions météo.|Le planning d'un chantier de rénovation de toit dans le Rhône dure en moyenne une semaine complète en l'absence d'intempéries.|Prévoyez un délai de 5 à 12 jours pour la pose de la couverture et des gouttières zinc neuves sur votre habitation.}";

  // Conseil Aides template
  const aidesTemplate = "{Les aides financières de l'État (CEE, MaPrimeRénov') et locales (Éco-Rénov) incitent à réaliser la rénovation énergétique du toit.|Bénéficiez du taux de TVA réduit à 5,5% sur l'ensemble de la facture (matériel et main d'œuvre) pour vos travaux de toiture RGE.|L'éco-prêt à taux zéro (éco-PTZ) permet de financer votre projet d'isolation de toiture à {VILLE} sans intérêts bancaires.}";

  // Local Agency templates
  const agencyNameTemplate = "{l'Espace Conseil France Rénov' du Rhône|l'ADIL du Rhône (69)|le guichet d'information Éco-Rénov de la Métropole de Lyon}";
  const agencyDetailTemplate = "{le service public de référence qui propose des conseils neutres, gratuits et personnalisés aux particuliers pour leurs projets de rénovation de l'habitat|l'organisme départemental agréé qui vous conseille sur les financements, la fiscalité des travaux et vos droits de propriétaire|le pôle local de transition écologique destiné à accompagner les habitants de la région lyonnaise dans l'optimisation de leurs aides financières}";

  // Market Data template
  const marketTemplate = "{Secteur {VILLE} : nos {RGE_NB} couvreurs qualifiés RGE interviennent sous {DELAIS} jours pour vos diagnostics et devis.|Zone {VILLE} ({ZIP}) : accédez aux plannings de nos {RGE_NB} artisans partenaires sous {DELAIS} jours pour votre projet.|Marché local de {VILLE} : comparez les offres de nos {RGE_NB} professionnels actifs disposant de créneaux d'intervention sous {DELAIS} jours.}";

  // --- Step-by-Step Installation Process ---
  const step1Title = "{Sécurisation & Dépose|Préparation du chantier & Dépose|Installation et Dépose de l'ancien toit}";
  const step1Desc = "{Mise en place de l'échafaudage de sécurité à {VILLE}, protection des abords, puis dépose soignée des tuiles ou du zinc défectueux.|Installation des garde-corps et des structures de protection, sécurisation de la voirie, puis retrait et tri des anciens matériaux de couverture.}";
  
  const step2Title = "{Contrôle Charpente & Écran HPV|Inspection du bois & Sous-toiture|Vérification Charpente & Écran étanche}";
  const step2Desc = "{Examen mécanique des pannes et des chevrons de la charpente, traitement fongicide curatif si nécessaire, puis pose de l'écran de sous-toiture HPV.|Vérification de la planéité de la structure en bois de pays, traitement contre les nuisibles de la charpente, et pose tendue du pare-pluie respirant.}";
  
  const step3Title = "{Liteonnage & Alignement|Pose du supportage|Support de couverture}";
  const step3Desc = "{Fixation par clouage des contre-lattes et liteaux de soutien en bois traité autoclave, créant la grille de ventilation sous-couverture.|Pose du lattage horizontal et vertical pour assurer la libre circulation de l'air sous les tuiles ou sous la toiture zinc.}";
  
  const step4Title = "{Pose de la Couverture (DTU)|Fixation du zinc ou des tuiles|Installation des matériaux de couverture}";
  const step4Desc = "{Installation des tuiles mécaniques de terre cuite, des ardoises ou des feuilles de zinc naturel conformément aux règles strictes du DTU 40.41.|Mise en place de la couverture avec scellement mécanique systématique pour résister aux vents violents et au gel à {VILLE}.}";
  
  const step5Title = "{Finitions Zinc & Zinguerie|Zinguerie & Nettoyage final|Raccordements & Fin de chantier}";
  const step5Desc = "{Façonnage et pose des gouttières en zinc neuves, raccordement étanche des solins de cheminée, nettoyage complet du chantier et évacuation des gravats.|Finition des raccords de rives et d'étanchéité, pose de la zinguerie pendante ou nantaise, évacuation des déchets vers une déchetterie agréée du Rhône.}";

  const poseSteps = [
    { 
      title: parseSpintax(slug, 'step1_t', replaceVariables(step1Title, vars)), 
      description: parseSpintax(slug, 'step1_d', replaceVariables(step1Desc, vars)) 
    },
    { 
      title: parseSpintax(slug, 'step2_t', replaceVariables(step2Title, vars)), 
      description: parseSpintax(slug, 'step2_d', replaceVariables(step2Desc, vars)) 
    },
    { 
      title: parseSpintax(slug, 'step3_t', replaceVariables(step3Title, vars)), 
      description: parseSpintax(slug, 'step3_d', replaceVariables(step3Desc, vars)) 
    },
    { 
      title: parseSpintax(slug, 'step4_t', replaceVariables(step4Title, vars)), 
      description: parseSpintax(slug, 'step4_d', replaceVariables(step4Desc, vars)) 
    },
    { 
      title: parseSpintax(slug, 'step5_t', replaceVariables(step5Title, vars)), 
      description: parseSpintax(slug, 'step5_d', replaceVariables(step5Desc, vars)) 
    }
  ];

  // Dynamic Internal Linking guides
  const guide1Title = "{Tarifs Toiture 2026 dans le Rhône|Budget Rénovation Toiture 2026|Prix Moyen Pose de Toit}";
  const guide1Desc = "{Découvrez les tarifs au m² pratiqués par les couvreurs du 69 pour le zinc, l'ardoise et la tuile.|Quel budget prévoir pour refaire sa couverture à {VILLE} et ses environs ?}";
  
  const guide2Title = "{L'Art du Zinc à Joint Debout|Toiture Zinc Haussmannienne à Lyon|Guide de la Couverture Zinc}";
  const guide2Desc = "{La pose traditionnelle du zinc naturel respectant les DTU de couverture.|Pourquoi le zinc est le matériau star de la Presqu'île de Lyon et du Rhône.}";
  
  const guide3Title = "{Démoussage & Nettoyage de Toit|Entretenir sa Couverture de Tuiles|Guide Anti-Mousse Toiture}";
  const guide3Desc = "{Toutes les étapes pour nettoyer ses tuiles et appliquer un hydrofuge efficace.|Comment protéger son toit des lichens sans l'endommager avec du chlore.}";

  const guideLinks = [
    { 
      href: "/guides/prix-refection-toiture-lyon-2026-zinc-tuile-ardoise/", 
      label: parseSpintax(slug, 'g1_t', replaceVariables(guide1Title, vars)), 
      desc: parseSpintax(slug, 'g1_d', replaceVariables(guide1Desc, vars)) 
    },
    { 
      href: "/guides/toiture-zinc-joint-debout-savoir-faire-immeubles-lyonnais/", 
      label: parseSpintax(slug, 'g2_t', replaceVariables(guide2Title, vars)), 
      desc: parseSpintax(slug, 'g2_d', replaceVariables(guide2Desc, vars)) 
    },
    { 
      href: "/guides/demoussage-toiture-rhone-quand-comment-prix/", 
      label: parseSpintax(slug, 'g3_t', replaceVariables(guide3Title, vars)), 
      desc: parseSpintax(slug, 'g3_d', replaceVariables(guide3Desc, vars)) 
    }
  ];

  // --- Dynamic FAQ Pool & Spinning ---
  const allFAQs = [
    {
      q: "{Pourquoi privilégier le zinc pour la toiture à {VILLE} ?|Quel est l'intérêt d'une toiture en zinc à {VILLE} ?}",
      a: "{Dans le département du Rhône et notamment à {VILLE}, le zinc naturel est apprécié pour sa longévité exceptionnelle dépassant 50 ans. Il convient parfaitement aux toits à faible pente et allège la charge sur les charpentes anciennes des immeubles de ville. La pose par joint debout réalisée par nos partenaires couvreurs assure une imperméabilité parfaite.|Le zinc offre une esthétique moderne et une excellente durabilité face aux intempéries de {VILLE}. Ce matériau recyclable ne nécessite aucun entretien et s'avère idéal pour les rénovations de copropriétés ou les extensions contemporaines.}"
    },
    {
      q: "{À quelle fréquence faire le démoussage du toit à {VILLE} ?|Quand faut-il nettoyer et démousser sa toiture à {VILLE} ?}",
      a: "{Il est recommandé d'effectuer un traitement hydrofuge et un démoussage tous les 3 à 5 ans. L'humidité stagnante en hiver combinée au gel rend les tuiles poreuses, ce qui favorise les fissures. Un nettoyage professionnel sans chlore préserve l'intégrité de votre toiture à {VILLE}.|Un nettoyage de toiture à {VILLE} s'impose dès l'apparition de mousses vertes ou de lichens noirs. L'application d'un produit fongicide associé à un hydrofuge incolore perlant protège les matériaux de couverture contre la porosité pendant plus d'une décennie.}"
    },
    {
      q: "{Que faire en cas d'urgence de fuite sur mon toit à {VILLE} ?|Comment réagir après une fuite de toiture suite à un orage à {VILLE} ?}",
      a: "{Déclarez le sinistre à votre compagnie d'assurance habitation sous 5 jours. Contactez immédiatement un couvreur à {VILLE} pour un bâchage d'urgence (mise hors d'eau temporaire) afin de stopper les dégâts des eaux intérieurs avant l'établissement d'un devis de réparation définitive.|Prenez des clichés des infiltrations et des tuiles envolées après de fortes rafales ou de la grêle sur {VILLE}. Un artisan couvreur se déplacera en urgence pour sécuriser la toiture. Ces frais conservatoires urgents sont généralement pris en charge par l'assurance.}"
    },
    {
      q: "{Quelles sont les aides de la Métropole de Lyon ou de l'État pour ma toiture à {VILLE} ?|Puis-je obtenir des subventions pour refaire ma toiture à {VILLE} ?}",
      a: "{En cumulant des travaux d'isolation thermique (sarking ou combles perdus) lors de la réfection de toiture à {VILLE}, vous devenez éligible à MaPrimeRénov' de l'ANAH, aux certificats d'économies d'énergie (CEE) et aux aides locales de {INTERCO}. Un couvreur RGE est requis pour débloquer ces subventions.|Les aides financières nationales et régionales à {VILLE} encouragent l'efficacité énergétique. Les chantiers d'isolation sous toiture profitent d'un taux de TVA préférentiel à 5,5% et peuvent être financés par un éco-PTZ à taux zéro.}"
    },
    {
      q: "{Qu'est-ce que la technique d'isolation de toiture par sarking à {VILLE} ?|Pourquoi choisir l'isolation de toiture extérieure (sarking) à {VILLE} ?}",
      a: "{Le sarking consiste à poser des panneaux isolants rigides directement sur les chevrons, sous la couverture de toit. À {VILLE}, cette isolation thermique par l'extérieur (ITE) élimine tous les ponts thermiques sans empiéter sur l'espace habitable de vos combles.|Cette technique d'isolation continue par l'extérieur protège la charpente des variations de température et offre un excellent confort thermique à {VILLE}, maintenant les combles au chaud en hiver et au frais pendant les étés caniculaires.}"
    },
    {
      q: "{Combien de temps durent les travaux de réfection de toiture à {VILLE} ?|Quelle est la durée moyenne d'un chantier de toiture à {VILLE} ?}",
      a: "{Pour une maison individuelle moyenne à {VILLE}, comptez entre 5 et 10 jours de travaux continus selon les conditions climatiques. Cette période comprend la dépose du vieux toit, le contrôle de charpente, la pose de l'isolant et la couverture neuve.|Le planning de pose s'étale généralement sur une à deux semaines. Les travaux de hauteur exigent une météo clémente (absence de vents violents et de précipitations) pour garantir la sécurité des couvreurs à {VILLE}.}"
    },
    {
      q: "{Quels sont les avantages d'un hydrofuge de toiture à {VILLE} ?|Pourquoi appliquer un traitement hydrofuge sur ses tuiles à {VILLE} ?}",
      a: "{L'hydrofuge pénètre le matériau et empêche l'humidité d'y stagner. À {VILLE}, ce traitement prévient l'effritement lié au gel hivernal et crée une pellicule autonettoyante sur laquelle l'eau glisse en emportant les saletés et la pollution.|Appliqué sur des tuiles propres, l'hydrofuge redonne de l'éclat à la toiture à {VILLE}. Il empêche les germes de s'incruster et retarde la prolifération future de la végétation de surface, limitant les futurs frais d'entretien.}"
    },
    {
      q: "{Comment choisir un couvreur qualifié RGE de confiance à {VILLE} ?|Quels critères vérifier pour sélectionner un bon artisan couvreur à {VILLE} ?}",
      a: "{Exigez toujours des documents valides : une assurance décennale à jour couvrant la toiture et la zinguerie dans le Rhône, la certification RGE Qualibat pour l'année 2026, et des exemples de chantiers réalisés près de {VILLE}. Obtenez également 3 devis détaillés.|Consultez l'annuaire France Rénov' pour repérer un couvreur RGE qualifié sur {VILLE}. Méfiez-vous des artisans effectuant du démarchage à domicile et demandez des devis mentionnant clairement la surface de toiture et les garanties offertes.}"
    }
  ];

  // Deterministically select 4 FAQs based on the pageType and the commune slug
  const faqIndices: number[] = [];
  const seed = parseSpintax(slug, 'faq_seed', "{1|2|3|4|5|6|7|0}");
  const seedNum = parseInt(seed, 10) || 0;
  
  if (pageType === 'refection') {
    faqIndices.push(0, 3, 4, 5);
  } else if (pageType === 'demoussage') {
    faqIndices.push(1, 6, 2, 7);
  } else {
    faqIndices.push(7, 3, 0, 2);
  }

  const selectedFAQs = faqIndices.map(idx => allFAQs[idx]);
  const finalFAQs = [
    selectedFAQs[seedNum % 4],
    selectedFAQs[(seedNum + 1) % 4],
    selectedFAQs[(seedNum + 2) % 4],
    selectedFAQs[(seedNum + 3) % 4]
  ].filter((v, i, a) => a.indexOf(v) === i); // Deduplicate

  while (finalFAQs.length < 4) {
    const missing = allFAQs.find(f => !finalFAQs.includes(f));
    if (missing) finalFAQs.push(missing);
    else break;
  }

  const faqItems = finalFAQs.map((f, i) => ({
    question: parseSpintax(slug, `faq_q_${i}`, replaceVariables(f.q, vars)),
    answer: parseSpintax(slug, `faq_a_${i}`, replaceVariables(f.a, vars))
  }));

  // Resolve all final fields using parseSpintax + replaceVariables
  return {
    title: parseSpintax(slug, 'title', replaceVariables(titleTemplate, vars)),
    introParagraph: parseSpintax(slug, 'intro', replaceVariables(introTemplate, vars)),
    tableIntro: parseSpintax(slug, 'table_intro', replaceVariables(tableIntroTemplate, vars)),
    marketDataText: parseSpintax(slug, 'market_data', replaceVariables(marketTemplate, vars)),
    realEstateInsight: parseSpintax(slug, 'real_estate', replaceVariables(realEstateTemplate, vars)),
    abfRegulations: parseSpintax(slug, 'abf', replaceVariables(abfTemplate, vars)),
    climateContext: parseSpintax(slug, 'climate', replaceVariables(climateTemplate, vars)),
    poseSteps,
    diagnosticEnergetique: parseSpintax(slug, 'diag', replaceVariables(diagnosticTemplate, vars)),
    vitrageRecommendation: parseSpintax(slug, 'tip', replaceVariables(tipTemplate, vars)),
    calendrierRenovation: parseSpintax(slug, 'calendar', replaceVariables(calendarTemplate, vars)),
    faqItems,
    sourcesCitation: "Données de marché estimées pour l'année 2026 issues des rapports de l'ANAH, du CSTB et des fédérations du bâtiment du Rhône.",
    conseilAides: parseSpintax(slug, 'aides', replaceVariables(aidesTemplate, vars)),
    localAgencyName: parseSpintax(slug, 'agency_name', replaceVariables(agencyNameTemplate, vars)),
    localAgencyDetail: parseSpintax(slug, 'agency_detail', replaceVariables(agencyDetailTemplate, vars)),
    guideLinks,
    expertTip: parseSpintax(slug, 'expert_tip', replaceVariables(expertTipTemplate, vars)),
    savingsEstimate: parseSpintax(slug, 'savings', replaceVariables(savingsTemplate, vars)),
    localProfileParagraph: parseSpintax(slug, 'local_profile', replaceVariables(localProfileTemplate, vars)),
    housingTypologyInsight: parseSpintax(slug, 'housing_type', replaceVariables(housingTemplate, vars)),
    energyProfileText: parseSpintax(slug, 'energy_profile', replaceVariables(energyTemplate, vars)),
    smartNearbyCommunesText: `Nous intervenons également activement sur les localités limitrophes de {VILLE} : ${nearbyNames}.`.replace(/{VILLE}/g, commune.nom)
  };
}
