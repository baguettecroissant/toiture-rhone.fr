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

// Deterministic hashing helper to select variant consistently per commune slug
function getStringHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function selectVariant(slug: string, key: string, variants: string[]): string {
  const hash = getStringHash(slug + "-" + key);
  return variants[hash % variants.length];
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

  const slug = commune.slug;

  // 1. Geographic Classification (Lyon Metro, Beaujolais, Monts du Lyonnais)
  const lat = commune.latitude || 45.76;
  const lon = commune.longitude || 4.83;
  const pop = commune.population || 5000;
  
  let geoZone: 'lyon_metro' | 'beaujolais' | 'monts_lyonnais' = 'lyon_metro';
  if (lat > 45.9) {
    geoZone = 'beaujolais';
  } else if (lon < 4.65) {
    geoZone = 'monts_lyonnais';
  }

  // 2. City Density Classification
  const density: 'city' | 'village' = pop > 25000 ? 'city' : 'village';

  // 3. Smart local neighbor communes (dynamic semantic internal linking)
  const nearby = getSmartNearbyCommunes(slug, communes as any[], 3, 0);
  const nearbyNames = nearby.map(n => n.nom).join(', ');

  // --- Dynamic text spinning pools ---

  // Title spinning
  let title = "";
  if (pageType === 'refection') {
    title = selectVariant(slug, 'title_refection', [
      `Réfection de Toiture à ${commune.nom} (${commune.codePostal}) — Couvreur RGE`,
      `Rénovation & Remplacement de Toiture à ${commune.nom} (69)`,
      `Couvreur à ${commune.nom} : Réfection & Travaux de Toiture RGE`
    ]);
  } else if (pageType === 'demoussage') {
    title = selectVariant(slug, 'title_demoussage', [
      `Démoussage & Nettoyage de Toiture à ${commune.nom} (${commune.codePostal})`,
      `Nettoyage de Toiture & Traitement Hydrofuge à ${commune.nom}`,
      `Démoussage de Tuiles à ${commune.nom} : Prix & Devis de Nettoyage`
    ]);
  } else {
    title = selectVariant(slug, 'title_artisan', [
      `Trouver un Couvreur RGE à ${commune.nom} (${commune.codePostal}) — Devis Gratuits`,
      `Artisan Couvreur à ${commune.nom} : Devis Rénovation de Toiture RGE`,
      `Meilleurs Couvreurs de ${commune.nom} (69) : Comparez 3 Tarifs 2026`
    ]);
  }

  // Intro Paragraph spinning
  let introParagraph = "";
  if (pageType === 'refection') {
    introParagraph = selectVariant(slug, 'intro_refection', [
      `Votre toiture à ${commune.nom} présente des signes de fatigue, de mousse ou d'infiltrations ? Nos maîtres couvreurs partenaires certifiés RGE interviennent pour la réfection complète ou partielle de votre couverture en zinc haussmannien ou en tuiles canal. Bénéficiez d'une pose soignée aux normes DTU 40.41, avec un coût moyen estimé entre ${minRPrice}€ et ${maxRPrice}€ le m² incluant la zinguerie neuve.`,
      `Envisager la réfection de son toit à ${commune.nom} exige l'intervention d'un couvreur-zingueur qualifié RGE. Spécialisés dans la rénovation du bâti rhodanien et des immeubles de la Presqu'île, nos artisans partenaires prennent en main l'étanchéité, le liteonnage et la zinguerie complète. Comptez environ ${minRPrice}€ à ${maxRPrice}€ par m² pour des travaux pérennes garantis par assurance décennale.`,
      `Pour préserver la valeur de votre patrimoine immobilier à ${commune.nom}, une réfection de toiture performante s'impose. Nos équipes locales réalisent la pose de toiture zinc à joint debout ou de tuiles de qualité supérieure. Les tarifs de réfection constatés sur votre secteur oscillent entre ${minRPrice}€ et ${maxRPrice}€ TTC au m², éligibles aux aides locales (Éco-Rénov) et nationales.`
    ]);
  } else if (pageType === 'demoussage') {
    introParagraph = selectVariant(slug, 'intro_demoussage', [
      `L'apparition de mousses, de lichens ou de traces de pollution sur vos tuiles à ${commune.nom} altère gravement leur imperméabilité. Un démoussage complet combiné à un traitement fongicide et hydrofuge protecteur redonne de l'éclat et de la force à votre toit. Pour ce type de nettoyage en profondeur dans le Rhône, prévoyez de ${minDPrice}€ à ${maxDPrice}€ par m².`,
      `À ${commune.nom}, le climat continental conjugué aux précipitations et au gel hivernal favorise la porosité des couvertures. Notre nettoyage de toiture professionnel (sans chlore ni haute pression agressive) élimine les germes incrustés pour un tarif de ${minDPrice}€ à ${maxDPrice}€ TTC au m², assurant une protection hydrofuge durable sur plusieurs années.`,
      `Protégez votre habitation des infiltrations d'eau à ${commune.nom} grâce à un démoussage de toiture régulier. Nos couvreurs locaux appliquent des traitements autonettoyants de surface respectueux du support en zinc ou en terre cuite. Comptez un budget moyen de ${minDPrice}€ à ${maxDPrice}€ le m² selon la pente et l'accès.`
    ]);
  } else {
    introParagraph = selectVariant(slug, 'intro_artisan', [
      `Vous recherchez un artisan couvreur de confiance certifié RGE à ${commune.nom} ou ses environs ? Nous vous connectons avec un réseau local de professionnels qualifiés Qualibat. Obtenez et comparez gratuitement jusqu'à 3 devis détaillés pour vos travaux de couverture et profitez des aides d'État à la rénovation énergétique.`,
      `Trouver un couvreur disponible et compétent à ${commune.nom} peut s'avérer complexe. Grâce à nos partenaires agréés RGE, accédez rapidement aux meilleurs spécialistes de la toiture dans le 69. Que ce soit pour une réparation d'urgence après tempête ou un projet global, recevez vos chiffrages personnalisés sans aucun engagement.`,
      `Besoin d'un diagnostic toiture complet ou d'un devis couvreur à ${commune.nom} ? Comparez les offres de ${rge} artisans couvreurs RGE partenaires actifs sur votre secteur. Profitez de conseils d'experts pour vos travaux d'isolation par l'extérieur (sarking) ou de rénovation de couverture traditionnelle.`
    ]);
  }

  // Climate Context spinning
  let climateContext = "";
  if (geoZone === 'lyon_metro') {
    climateContext = selectVariant(slug, 'climate_lyon_metro', [
      `Située dans l'aire urbaine lyonnaise à ${commune.nom}, votre toiture subit la pollution urbaine et les amplitudes thermiques marquées. La suie et les polluants atmosphériques accélèrent le ternissement et la corrosion des toits en zinc de la Presqu'île ou des tuiles mécaniques. Nos artisans préconisent des nettoyages réguliers et l'application d'un vernis protecteur ou d'un écran sous-toiture HPV pour protéger les copropriétés contre la condensation sous toit.`,
      `Le climat urbain de ${commune.nom} requiert des précautions d'étanchéité majeures. Les étés de plus en plus chauds font monter la température sous toiture jusqu'à 70°C. La pose d'isolants thermiques performants avec un fort déphasage (laine de bois) est recommandée pour garantir le confort d'été des combles habités.`
    ]);
  } else if (geoZone === 'beaujolais') {
    climateContext = selectVariant(slug, 'climate_beaujolais', [
      `Dans le secteur vallonné du Beaujolais à ${commune.nom}, l'humidité des vallées et l'exposition aux vents de Saône favorisent la prolifération ultra-rapide des mousses et des lichens jaunes sur la terre cuite. Les maisons traditionnelles en pierres dorées exigent des couvertures en tuiles canal terre cuite de teintes locales ocre et rouge naturel pour s'harmoniser avec le patrimoine viticole.`,
      `Le microclimat du Beaujolais autour de ${commune.nom} expose les toits à de violents orages d'été de grêle et à des gelées d'hiver. Des fixations renforcées par clouage ou crochetage des tuiles de courant sont indispensables pour prévenir le glissement et les fuites d'eau.`
    ]);
  } else {
    climateContext = selectVariant(slug, 'climate_monts_lyonnais', [
      `En altitude dans les Monts du Lyonnais ou l'Ouest Rhodanien à ${commune.nom}, les hivers sont rudes avec des chutes de neige fréquentes et des périodes de gel prolongées. Le poids de la neige (pouvant dépasser 100 kg/m²) exerce une pression énorme sur la charpente en bois. Une réfection exige souvent le renforcement des pannes et l'installation d'arrêts de neige pour sécuriser les gouttières.`,
      `Les toitures des Monts du Lyonnais à ${commune.nom} subissent des chocs thermiques intenses. Les tuiles non gélives certifiées NF Zone de Montagne et une isolation extérieure type Sarking (panneaux polyuréthane étanches) sont requises pour éliminer tout pont thermique et éviter la formation de blocs de glace aux avant-toits.`
    ]);
  }

  // ABF / Urban regulations spinning
  const abfRegulations = selectVariant(slug, 'abf_regulations', [
    `Si votre logement à ${commune.nom} se trouve dans le Vieux-Lyon, sur les pentes de la Croix-Rousse ou à proximité d'un édifice classé, les Architectes des Bâtiments de France (ABF) imposent des normes extrêmement strictes : respect du zinc naturel (sans laquage moderne), de l'ardoise naturelle ou de la tuile canal traditionnelle ocre/rouge. Les gouttières nantaises ou havraises en zinc sont souvent obligatoires en remplacement des gouttières pendantes.`,
    `Les règles d'urbanisme à ${commune.nom} encadrent la réfection de couverture pour préserver l'identité locale. Une Déclaration Préalable (DP) de travaux en mairie est nécessaire pour tout changement d'aspect extérieur. Nos couvreurs partenaires locaux vous fournissent les fiches techniques des matériaux conformes au Plan Local d'Urbanisme (PLU).`,
    `La conservation de l'esprit industriel et historique à ${commune.nom} proscrit l'usage de certains matériaux modernes comme le bac acier brut ou le PVC de couleur sur les rives de toit. Le zinc naturel de 0.65mm et le bois traité restent les standards recommandés.`
  ]);

  // Housing Typology spinning
  let housingTypologyInsight = "";
  if (density === 'city') {
    housingTypologyInsight = selectVariant(slug, 'typology_city', [
      `Le parc immobilier à ${commune.nom} se caractérise par des immeubles collectifs denses et des copropriétés. Effectuer des travaux de toiture y requiert une organisation rigoureuse : demande d'occupation du domaine public en mairie pour l'installation d'un échafaudage de voirie, grutage ou monte-matériaux, et coordination étroite avec le syndic de copropriété.`,
      `À ${commune.nom}, la mitoyenneté étroite des immeubles haussmanniens ou des maisons de ville rend la gestion des interfaces étanches complexe. Les raccords de solin à joint debout entre deux bâtiments doivent être inspectés et refaits pour éviter les litiges d'infiltrations d'une propriété à l'autre.`
    ]);
  } else {
    housingTypologyInsight = selectVariant(slug, 'typology_village', [
      `L'habitat à ${commune.nom} est majoritairement pavillonnaire, composé de villas individuelles et d'anciennes fermes restaurées. Les charpentes en bois de pays (sapin, chêne) doivent faire l'objet d'un examen phytosanitaire avant la réfection pour traiter d'éventuels capricornes ou vrillettes avant de poser la nouvelle couverture.`,
      `Les toitures individuelles à ${commune.nom} sont souvent entourées de végétation. Les aiguilles de pin et les feuilles mortes obstruent les naissances et les tuyaux de descente de gouttières, provoquant des débordements. La pose de pare-feuilles et de crapaudines en zinc est fortement conseillée lors des travaux.`
    ]);
  }

  // Energy Profile spinning
  const energyProfileText = selectVariant(slug, 'energy_profile', [
    `La toiture représente 30% des déperditions de chaleur d'une maison mal isolée à ${commune.nom}. Isoler thermiquement vos combles ou installer des panneaux isolants de sarking lors de la réfection est un investissement rapidement rentabilisé qui améliore la classe DPE de votre bien immobilier.`,
    `Le profil énergétique des habitations anciennes à ${commune.nom} révèle des factures de chauffage et de climatisation élevées. La mise en place d'une isolation sous rampants étanche à l'air combinée à un écran sous-toiture HPV réduit les courants d'air froid en hiver et limite l'échauffement des combles en été.`,
    `Avec les étés chauds du Rhône, isoler votre toiture à ${commune.nom} avec un matériau à haute densité (laine de bois ou ouate de cellulose) offre un confort d'été remarquable, retardant de plusieurs heures la pénétration de la chaleur dans les chambres mansardées.`
  ]);

  // Master Roofer tip spinning
  const vitrageRecommendation = selectVariant(slug, 'master_roofer_tip', [
    `Conseil du couvreur : Pour les toitures lyonnaises en zinc ou en ardoise à ${commune.nom}, privilégiez l'installation d'un écran de sous-toiture HPV (Hautement Perméable à la Vapeur) qui protège la charpente de l'humidité tout en permettant à l'isolant de respirer librement.`,
    `Astuce de pro : Lors du nettoyage de vos tuiles terre cuite à ${commune.nom}, refusez le jet haute pression à bout portant. Cela détruit le vernis superficiel de la tuile et la rend poreuse, favorisant le retour rapide de la mousse dès le premier hiver. Exigez un traitement hydrofuge professionnel.`,
    `Information importante : L'isolation sarking réalisée en même temps que la réfection de toiture par un artisan RGE sur ${commune.nom} ouvre droit à des aides conséquentes de l'ANAH et à un taux de TVA réduit à 5,5% sur l'ensemble de la facture.`
  ]);

  // Table Intro spinning
  const tableIntro = selectVariant(slug, 'table_intro', [
    `Consultez la grille des tarifs moyens indicatifs constatés pour les travaux de ${pageType === 'refection' ? 'rénovation de couverture' : pageType === 'demoussage' ? 'nettoyage et démoussage' : 'couverture et isolation'} à ${commune.nom} pour l'année 2026. Ces prix sont hors taxes et à ajuster selon les accès de votre chantier.`,
    `Grille tarifaire 2026 : Chiffrages de référence au m² pour votre projet de toiture à ${commune.nom}. Les tarifs fluctuent selon la hauteur du bâtiment, la pente du toit, le type de matériau (zinc, tuile, ardoise) et la complexité des raccords de zinguerie.`,
    `Voici les prix moyens pratiqués par les artisans qualifiés RGE du Rhône sur la commune de ${commune.nom}. Obtenez des devis comparatifs locaux pour un chiffrage précis adapté à la configuration de votre toit.`
  ]);

  // Expert tip spinning
  const expertTip = selectVariant(slug, 'expert_tip', [
    `Pour prévenir les infiltrations d'eau sous toiture à ${commune.nom}, inspectez régulièrement l'état des closoirs de faîtage et l'étanchéité des mortiers de scellement après les épisodes de gel.`,
    `Pensez à nettoyer les chéneaux et gouttières de votre habitation à ${commune.nom} à la fin de l'automne pour assurer la libre évacuation des eaux de pluie et de la neige fondue.`,
    `L'application d'un traitement hydrofuge perlant incolore après démoussage à ${commune.nom} protège les tuiles contre les agressions du gel et retarde l'apparition de micro-organismes pendant 10 ans.`
  ]);

  // Savings estimate spinning
  const savingsEstimate = selectVariant(slug, 'savings_estimate', [
    `Isoler thermiquement la toiture de votre maison à ${commune.nom} permet de réduire de 25% à 30% vos dépenses annuelles de chauffage.`,
    `Un démoussage et un traitement hydrofuge réguliers prolongent la durée de vie de votre couverture à ${commune.nom} de plus de 15 ans, évitant une réfection complète précoce.`,
    `Les subventions publiques de la Métropole de Lyon et de l'État (CEE) peuvent prendre en charge jusqu'à 50% du surcoût lié aux travaux d'isolation extérieure (sarking).`
  ]);

  // Local profile text spinning
  const localProfileParagraph = selectVariant(slug, 'local_profile', [
    `Située dans le département du Rhône au sein de la collectivité ${commune.intercommunalite || 'de votre secteur'}, la commune de ${commune.nom} possède un patrimoine architectural à préserver. L'entretien des charpentes et la réfection des toitures zinc ou tuiles y sont des chantiers majeurs pour valoriser le bâti ancien.`,
    `Riche de son histoire et intégrée à ${commune.intercommunalite || 'la métropole locale'}, la commune de ${commune.nom} voit de nombreux projets de rénovation thermique et d'extension. Nos artisans couvreurs partenaires y interviennent régulièrement pour réhabiliter les couvertures traditionnelles.`,
    `La résistance aux intempéries et le respect des règles d'urbanisme locales sont essentiels pour les toitures de ${commune.nom}. La toiture y est l'élément protecteur numéro un face aux variations climatiques rhodaniennes.`
  ]);

  // Diagnostic Énergétique spinning
  const diagnosticEnergetique = selectVariant(slug, 'diagnostic', [
    `Un diagnostic complet de votre toiture à ${commune.nom} permet de détecter les tuiles poreuses ou cassées, les infiltrations discrètes et les zones de déperdition thermique. C'est l'étape préalable incontournable avant d'envisager des travaux de couverture.`,
    `Nos artisans couvreurs partenaires réalisent une inspection minutieuse de la structure de votre toiture à ${commune.nom} (état de la charpente, des voliges et de la zinguerie) pour vous proposer une solution technique adaptée à vos besoins.`,
    `Un bilan thermique sous toiture permet de cibler précisément l'épaisseur d'isolant nécessaire pour éliminer l'inconfort thermique hivernal et estival persistant dans les pièces sous toit à ${commune.nom}.`
  ]);

  // Dynamic Pose steps spinning
  const step1Desc = selectVariant(slug, 'step1', [
    `Installation des structures de protection collective, mise en sécurité du chantier à ${commune.nom} conformément aux règles de sécurité, puis dépose minutieuse de l'ancienne couverture.`,
    `Mise en place de l'échafaudage réglementaire, sécurisation des abords sur la commune de ${commune.nom}, et retrait soigné des anciennes tuiles, ardoises ou feuilles de zinc défectueuses.`
  ]);
  const step2Desc = selectVariant(slug, 'step2', [
    `Contrôle minutieux de l'état mécanique de la charpente en bois, puis installation d'un écran sous-toiture HPV respirant agrafé sur les chevrons.`,
    `Examen des pannes et chevrons de la charpente, traitement fongicide curatif si nécessaire, et pose tendue de l'écran de sous-toiture étanche à l'eau.`
  ]);
  const step3Desc = selectVariant(slug, 'step3', [
    `Fixation par clouage des contre-lattes et liteaux de soutien en bois traité, puis traçage précis pour l'alignement futur du zinc ou des tuiles.`,
    `Liteonnage horizontal et vertical pour créer la grille de pose, permettant une ventilation sous-tuile efficace et un calage parfait de la couverture.`
  ]);
  const step4Desc = selectVariant(slug, 'step4', [
    `Mise en place des tuiles, ardoises ou feuilles de zinc avec fixation métallique systématique selon les normes du DTU applicable (DTU 40.41 pour le zinc).`,
    `Pose de la couverture avec scellement mécanique et joint debout pour résister aux tempêtes de vent et au gel fréquents sur la région de ${commune.nom}.`
  ]);
  const step5Desc = selectVariant(slug, 'step5', [
    `Réalisation des solins de raccordement, pose des gouttières zinc neuves et nettoyage complet des combles et du jardin avec évacuation des déchets du 69.`,
    `Raccordements de zinguerie étanches sur les cheminées et rives, nettoyage final du chantier et évacuation des gravats vers une déchetterie agréée du Rhône.`
  ]);

  const poseSteps = [
    { title: selectVariant(slug, 'step1_title', ["Préparation & Échafaudage", "Sécurisation & Dépose"]), description: step1Desc },
    { title: selectVariant(slug, 'step2_title', ["Contrôle Charpente & Écran HPV", "Vérification Bois & Sous-Toiture"]), description: step2Desc },
    { title: selectVariant(slug, 'step3_title', ["Liteonnage & Alignement", "Supportage & Calage"]), description: step3Desc },
    { title: selectVariant(slug, 'step4_title', ["Fixation & Pose (DTU)", "Pose de Couverture"]), description: step4Desc },
    { title: selectVariant(slug, 'step5_title', ["Zinguerie & Nettoyage final", "Finitions Zinc & Fin de chantier"]), description: step5Desc }
  ];

  // Dynamic internal links
  const guideLinks = [
    { href: "/guides/prix-refection-toiture-lyon-2026-zinc-tuile-ardoise/", label: selectVariant(slug, 'g1', ["Tarifs Toiture 2026", "Budget Toiture 2026"]), desc: selectVariant(slug, 'g1_d', ["Quel budget prévoir au m² pour votre toit ?", "Les prix moyens des couvreurs dans le 69."]) },
    { href: "/guides/toiture-zinc-joint-debout-savoir-faire-immeubles-lyonnais/", label: selectVariant(slug, 'g2', ["Guide Toiture Zinc Lyon", "L'art du Joint Debout"]), desc: selectVariant(slug, 'g2_d', ["La pose traditionnelle du zinc haussmannien.", "Pourquoi choisir le zinc à Lyon."]) },
    { href: "/guides/demoussage-toiture-rhone-quand-comment-prix/", label: selectVariant(slug, 'g3', ["Démoussage & Nettoyage", "Entretenir sa couverture"]), desc: selectVariant(slug, 'g3_d', ["Quand et comment traiter ses tuiles.", "Les prix du démoussage dans le Rhône."]) }
  ];

  // --- Dynamic FAQ Pool & Spinning ---
  const allFAQs = [
    {
      q: `Pourquoi privilégier le zinc pour la toiture à ${commune.nom} ?`,
      a: selectVariant(slug, 'faq1', [
        `Dans le Rhône et particulièrement à ${commune.nom}, le zinc est le matériau historique par excellence pour les immeubles haussmanniens et les anciennes copropriétés. Il offre une légèreté remarquable qui soulage la charpente en bois ancienne, et garantit une durée de vie supérieure à 50 ans. Sa pose à joint debout par un couvreur-zingueur assure une étanchéité totale contre la pluie et la neige.`,
        `Le zinc est particulièrement adapté au centre-ville de ${commune.nom}. Il permet une étanchéité parfaite sur les toitures à faible pente de la Presqu'île de Lyon. Résistant à la corrosion et recyclable, il s'inscrit parfaitement dans les exigences environnementales et patrimoniales du département.`
      ])
    },
    {
      q: `À quelle fréquence effectuer le démoussage du toit à ${commune.nom} ?`,
      a: selectVariant(slug, 'faq2', [
        `Il est conseillé de procéder à un démoussage et à un traitement hydrofuge tous les 3 à 5 ans. Bien que le climat rhodanien à ${commune.nom} connaisse des étés secs, l'humidité hivernale et les gelées favorisent la porosité des tuiles en terre cuite et des ardoises. Le démoussage élimine les mousses retentrices d'eau pour éviter que le gel ne fasse éclater le support.`,
        `Un nettoyage professionnel à ${commune.nom} est recommandé dès que des traces noires ou vertes de pollution et de lichens apparaissent. Le traitement hydrofuge perlant appliqué par nos couvreurs partenaires crée une barrière imperméable durable qui prolonge l'esthétique et la force de vos tuiles.`
      ])
    },
    {
      q: `Comment réagir en cas d'urgence de fuite de toiture après une tempête à ${commune.nom} ?`,
      a: selectVariant(slug, 'faq3', [
        `Vous disposez d'un délai légal de 5 jours ouvrés pour déclarer le sinistre à votre assurance habitation. Contactez immédiatement un couvreur qualifié sur ${commune.nom} pour planifier un bâchage d'urgence (mise hors d'eau temporaire) afin de protéger vos plafonds, puis d'établir un devis détaillé des réparations définitives pour l'expert de votre assurance.`,
        `Après des vents violents ou de la grêle sur ${commune.nom}, prenez des photos des dégâts extérieurs. Faites intervenir un artisan pour sécuriser les lieux et prévenir de plus graves infiltrations. Ce déplacement urgent de mise hors d'eau est généralement remboursé par votre contrat d'assurance.`
      ])
    },
    {
      q: `Quelles aides de la Métropole de Lyon ou du 69 existent pour rénover son toit à ${commune.nom} ?`,
      a: selectVariant(slug, 'faq4', [
        `Si vous intégrez des travaux d'isolation thermique (isolation des combles ou sarking) lors de la réfection de toiture à ${commune.nom}, vous pouvez bénéficier du dispositif Éco-Rénov de la Métropole de Lyon. Cette aide est cumulable avec MaPrimeRénov' de l'ANAH et les primes CEE pour les travaux réalisés par un couvreur certifié RGE.`,
        `Les aides nationales et locales de ${commune.nom} subventionnent l'amélioration de la performance énergétique. L'isolation de la toiture par l'extérieur (sarking) est éligible à un taux de TVA réduit à 5,5% et à des primes CEE substantielles proportionnelles à votre profil fiscal.`
      ])
    },
    {
      q: `Qu'est-ce que l'isolation de toiture par sarking à ${commune.nom} ?`,
      a: selectVariant(slug, 'faq5', [
        `Le sarking est une technique d'isolation thermique par l'extérieur. Elle consiste à fixer des panneaux isolants rigides (polyuréthane, laine de bois) directement sur les chevrons de la charpente, sous les tuiles ou l'ardoise. À ${commune.nom}, cette solution haut de gamme élimine 100% des ponts thermiques sans perdre de surface habitable sous les combles.`,
        `Isoler par sarking à ${commune.nom} permet de conserver la charpente et les poutres apparentes à l'intérieur de la maison. Cette méthode offre une protection thermique continue ultra-performante contre le froid glacial de l'hiver et la chaleur étouffante de l'été.`
      ])
    },
    {
      q: `Combien de temps durent les travaux de réfection de toiture à ${commune.nom} ?`,
      a: selectVariant(slug, 'faq6', [
        `Pour une maison ou un immeuble moyen (100 m² de toiture) à ${commune.nom}, le chantier s'étale généralement sur 5 à 10 jours ouvrés pour une équipe de 2 à 3 couvreurs. Cette durée dépend beaucoup de l'état initial de la charpente en bois et des conditions météorologiques (absence de vent violent et de pluie nécessaire pour le travail en hauteur).`,
        `Le planning moyen d'une rénovation de toit sur ${commune.nom} comprend : 2 jours de dépose et de vérification de charpente, 2 jours d'isolation et liteonnage, et 3 jours de pose du zinc ou des tuiles suivi des finitions de zinguerie.`
      ])
    },
    {
      q: `Quels sont les avantages d'un traitement hydrofuge de toiture à ${commune.nom} ?`,
      a: selectVariant(slug, 'faq7', [
        `L'hydrofuge pénètre les pores de la tuile en terre cuite et crée un effet perlant empêchant l'eau de pluie de pénétrer dans l'argile. À ${commune.nom}, cela permet de protéger les tuiles contre l'usure précoce, d'éviter que le gel ne les casse, et de limiter considérablement l'adhérence des lichens et mousses pour conserver un toit propre très longtemps.`,
        `Appliquer un hydrofuge de qualité sur votre toiture à ${commune.nom} restaure la protection imperméable d'origine de vos tuiles canal. En glissant sur le toit, l'eau de pluie emporte les poussières et résidus de pollution, créant un effet autonettoyant naturel sans altérer la perméabilité à l'air de la terre cuite.`
      ])
    },
    {
      q: `Comment choisir un bon couvreur de confiance certifié RGE à ${commune.nom} ?`,
      a: selectVariant(slug, 'faq8', [
        `Vérifiez impérativement plusieurs éléments : l'existence d'une garantie décennale valide couvrant explicitement l'activité de couverture-zinguerie dans les Bouches-du-Rhône, le label RGE Qualibat à jour pour l'année 2026, et des références de chantiers visitables sur le secteur de ${commune.nom}. Enfin, comparez au moins 3 devis détaillés mentionnant les cotes réelles et les marques de tuiles.`,
        `À ${commune.nom}, privilégiez un artisan couvreur local répertorié sur l'annuaire officiel France Rénov'. Exigez ses attestations d'assurance (décennale et responsabilité civile professionnelle) avant le début des travaux. Un bon professionnel viendra toujours effectuer un contrôle visuel sur votre toit avant d'établir un devis.`
      ])
    }
  ];

  // Deterministically select 4 FAQs based on the pageType and the commune slug
  const faqIndices: number[] = [];
  const seed = getStringHash(slug + "-" + pageType);
  
  if (pageType === 'refection') {
    faqIndices.push(0, 3, 4, 5);
  } else if (pageType === 'demoussage') {
    faqIndices.push(1, 6, 2, 7);
  } else {
    faqIndices.push(7, 3, 0, 2);
  }

  const selectedFAQs = faqIndices.map(idx => allFAQs[idx]);
  const finalFAQs = [
    selectedFAQs[seed % 4],
    selectedFAQs[(seed + 1) % 4],
    selectedFAQs[(seed + 2) % 4],
    selectedFAQs[(seed + 3) % 4]
  ].filter((v, i, a) => a.indexOf(v) === i); // Deduplicate

  while (finalFAQs.length < 4) {
    const missing = allFAQs.find(f => !finalFAQs.includes(f));
    if (missing) finalFAQs.push(missing);
    else break;
  }

  const faqItems = finalFAQs.map(f => ({
    question: f.q,
    answer: f.a
  }));

  // Secteur info text
  const marketDataText = selectVariant(slug, 'market_data', [
    `Secteur ${commune.nom} (${commune.codePostal}) : ${rge} couvreurs partenaires certifiés RGE disponibles sous ${delays} jours pour vos diagnostics et chiffrages.`,
    `Marché local ${commune.nom} : nous comptons actuellement ${rge} artisans de confiance certifiés disposant de créneaux d'intervention sous ${delays} jours.`,
    `Zone ${commune.nom} : planifiez une visite avec l'un de nos ${rge} couvreurs qualifiés RGE. Délai de réponse moyen constaté de ${delays} jours.`
  ]);

  // Real estate insight
  const realEstateInsight = selectVariant(slug, 'real_estate', [
    `Faire réaliser la réfection ou l'isolation de sa toiture à ${commune.nom} valorise de manière significative votre patrimoine immobilier. Une couverture propre, étanche et isolée est un argument de vente majeur qui rassure les acheteurs et justifie une plus-value sur le marché immobilier du Rhône.`,
    `Dans le cadre d'une vente ou d'une mise en location à ${commune.nom}, le DPE joue un rôle déterminant. Rénover le toit permet d'éviter que le logement soit classé comme passoire thermique, augmentant sa valeur patrimoniale globale.`,
    `Investir dans la réfection de toiture à ${commune.nom} sécurise votre habitation contre les sinistres et sinistres climatiques futurs, réduisant également le coût de vos contrats d'assurance habitation.`
  ]);

  // General local agencies helper
  const localAgencyName = selectVariant(slug, 'agency_name', [
    `l'Espace Conseil France Rénov' du Rhône`,
    `l'ADIL du 69 (Agence Départementale d'Information sur le Logement)`,
    `le guichet unique de la rénovation Éco-Rénov de la Métropole de Lyon`
  ]);

  const localAgencyDetail = selectVariant(slug, 'agency_detail', [
    `le guichet public chargé de l'accompagnement des particuliers. Un conseiller neutre et gratuit vous aide dans l'analyse de vos devis et les dossiers de subventions`,
    `l'organisme public d'information qui vous renseigne gratuitement sur vos droits, les aides locales (prêt à taux zéro, éco-PTZ) et la fiscalité de vos travaux de rénovation`,
    `le pôle métropolitain de conseil en transition écologique qui vous guide pas à pas dans l'obtention des financements nationaux et régionaux`
  ]);

  // Calendar
  const calendrierRenovation = selectVariant(slug, 'calendar', [
    `Le remplacement complet d'une toiture à ${commune.nom} dure généralement entre 5 et 10 jours ouvrés selon les conditions climatiques et l'accès.`,
    `Le planning moyen d'un chantier de toiture sur ${commune.nom} s'établit sur une semaine de travail continu, excluant les dimanches et jours de fort vent ou de neige.`,
    `Prévoyez une amplitude de 5 à 12 jours pour la réfection globale, comprenant la dépose de l'ancien toit et la mise en place de la nouvelle zinguerie.`
  ]);

  // Local agencies
  const conseilAides = selectVariant(slug, 'aides', [
    `Les travaux d'isolation thermique extérieure (sarking) réalisés par un artisan certifié RGE ouvrent droit à des subventions nationales (MaPrimeRénov' et primes CEE).`,
    `Bénéficiez du taux de TVA réduit à 5,5% sur la main-d'œuvre et le matériel en faisant réaliser vos travaux de toiture et d'isolation par un professionnel RGE.`,
    `L'éco-prêt à taux zéro (éco-PTU) permet de financer jusqu'à 30 000€ de travaux d'isolation de toiture à ${commune.nom} sans aucun intérêt bancaire.`
  ]);

  return {
    title,
    introParagraph,
    tableIntro,
    marketDataText,
    realEstateInsight,
    abfRegulations,
    climateContext,
    poseSteps,
    diagnosticEnergetique,
    vitrageRecommendation,
    calendrierRenovation,
    faqItems,
    sourcesCitation: "Données de marché estimées pour l'année 2026 issues des rapports de l'ANAH, du CSTB et des fédérations du bâtiment du Rhône.",
    conseilAides,
    localAgencyName,
    localAgencyDetail,
    guideLinks,
    expertTip,
    savingsEstimate,
    localProfileParagraph,
    housingTypologyInsight,
    energyProfileText,
    smartNearbyCommunesText: `Nous intervenons également activement sur les localités limitrophes de ${commune.nom} : ${nearbyNames}.`
  };
}
