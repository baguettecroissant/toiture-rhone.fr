#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const communesPath = join(__dirname, '..', 'src', 'data', 'communes.json');

if (!existsSync(communesPath)) {
  console.error('communes.json not found. Run fetch-cities.mjs first.');
  process.exit(1);
}

const communes = JSON.parse(readFileSync(communesPath, 'utf-8'));

function hash(slug, seed = 0) {
  let h = seed * 31;
  for (let i = 0; i < slug.length; i++) {
    h = ((h << 5) - h + slug.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Map postal code/slug to Rhône intercommunalities
function getIntercommunalite(cp, slug) {
  const codePostal = String(cp);
  
  if (['villefranche-sur-saone', 'limas', 'gleize', 'arnas'].includes(slug) || codePostal.startsWith('69400')) {
    return "Communauté d'agglomération de Villefranche Beaujolais Saône";
  }
  if (['tarare', 'cours-la-ville', 'cours', 'amplepuis'].includes(slug) || ['69170', '69470', '69550'].includes(codePostal)) {
    return "Communauté d'agglomération de l'Ouest Rhodanien";
  }
  if (['belleville-en-beaujolais', 'belleville'].includes(slug) || codePostal.startsWith('69220')) {
    return "Communauté de communes Saône-Beaujolais";
  }
  if (['l-arbresle', 'arbresle'].includes(slug) || codePostal.startsWith('69210')) {
    return "Communauté de communes du Pays de L'Arbresle";
  }
  return "Métropole de Lyon";
}

function getHabitatType(slug) {
  const h = hash(slug, 1);
  const types = [
    "immeubles haussmanniens avec toitures en zinc et appartements anciens",
    "maisons de ville et pavillons individuels avec tuiles en terre cuite",
    "immeubles anciens de canuts de la Croix-Rousse et appartements à hauts plafonds",
    "résidences contemporaines et toits terrasses plats de la Confluence ou Gerland",
    "villas résidentielles et maisons individuelles avec toitures en tuiles romanes ou mécaniques"
  ];
  if (slug.includes('lyon') || ['villeurbanne', 'caluire-et-cuire'].includes(slug)) {
    return "immeubles anciens haussmanniens en zinc et copropriétés lyonnaises";
  }
  return types[h % types.length];
}

function getAnecdotePatrimoine(slug) {
  const anecdotes = [
    "la protection historique des façades à proximité des monuments phares du Rhône et du Beaujolais",
    "le respect des teintes traditionnelles rouge tuile et zinc ardoisé imposées par les règlements d'urbanisme locaux",
    "l'architecture locale lyonnaise où les toits à forte pente doivent faire face aux surcharges de neige en hiver",
    "les toitures traditionnelles en zinc posées à joint debout pour assurer une étanchéité à toute épreuve face aux intempéries",
    "les demeures en pierres dorées du Beaujolais dont la toiture en tuiles canal ocre est la signature patrimoniale majeure"
  ];
  
  if (slug.includes('lyon')) {
    return "la proximité de la basilique de Fourvière et de la Presqu'île classée UNESCO, exigeant des toitures en zinc patiné naturel ou ardoisé parfaitement intégrées au paysage lyonnais";
  }
  if (slug.includes('villeurbanne')) {
    return "l'héritage architectural des Gratte-Ciel de Villeurbanne, premier quartier de gratte-ciel en France, imposant des techniques d'étanchéité de toiture terrasse spécifiques";
  }
  if (slug.includes('croix-rousse')) {
    return "les célèbres immeubles de canuts de la Croix-Rousse dont les toitures à double pan avec faîtage ventilé doivent être restaurées dans le respect du bâti historique des tisseurs de soie";
  }
  if (slug.includes('confluence')) {
    return "l'architecture moderne et écologique de Lyon Confluence, requérant des membranes d'étanchéité EPDM de pointe et des toitures végétalisées isolantes";
  }
  if (slug.includes('villefranche')) {
    return "la proximité du Beaujolais historique, valorisant les couvertures en tuiles canal terre cuite sur les anciennes maisons de vignerons en pierres dorées";
  }
  
  const h = hash(slug, 2);
  return anecdotes[h % anecdotes.length];
}

function getLocalIntroText(commune) {
  const { nom, slug, population } = commune;
  const habitat = getHabitatType(slug);
  const anecdote = getAnecdotePatrimoine(slug);
  
  return `Avec ses ${population.toLocaleString('fr-FR')} habitants, la commune de ${nom} présente un parc immobilier varié, composé en grande partie de ${habitat}. Le climat continental rhodanien local, caractérisé par des étés chauds mais surtout des hivers froids avec des risques de gel et de chutes de neige importantes, met les couvertures à rude épreuve. De plus, ${anecdote}. C'est pourquoi faire appel à un couvreur qualifié dans le Rhône est indispensable pour assurer la durabilité de votre toiture.`;
}

function getLocalAdvice(commune) {
  const { nom, slug } = commune;
  const h = hash(slug, 3);
  const advices = [
    `Pour la réfection de toiture à ${nom}, sachez que l'isolation thermique extérieure (sarking) est éligible aux subventions MaPrimeRénov' et aux primes CEE, vous permettant d'économiser jusqu'à 30% sur votre facture énergétique globale.`,
    `Dans les copropriétés anciennes de ${nom}, la rénovation de toiture zinc requiert un vote en assemblée générale (majorité de l'article 24). Un artisan couvreur RGE local peut vous accompagner pour constituer les dossiers de subventions collectives auprès de la Métropole de Lyon.`,
    `Avant de valider votre devis de toiture à ${nom}, exigez l'attestation d'assurance décennale de l'artisan à jour pour l'année 2026, couvrant spécifiquement les travaux de couverture-zinguerie dans le Rhône.`,
    `Un traitement hydrofuge de toiture après démoussage est recommandé à ${nom} pour protéger vos tuiles ou ardoises de l'humidité hivernale et éviter l'éclatement dû au gel répété en période hivernale.`
  ];
  return advices[h % advices.length];
}

function getLocalFAQ(commune) {
  const { nom, slug } = commune;
  
  const faqList = [
    {
      q: `Pourquoi privilégier le zinc pour la toiture à ${nom} ?`,
      a: `À Lyon et à ${nom}, le zinc est le matériau roi des immeubles haussmanniens et canuts. Il offre une légèreté exceptionnelle, limitant la charge sur la charpente en bois ancienne, et garantit une étanchéité parfaite de plus de 50 ans. Posé à joint debout par un zingueur qualifié, il résiste parfaitement à la neige et aux tempêtes de vent du Rhône.`
    },
    {
      q: `À quelle fréquence effectuer le démoussage du toit à ${nom} ?`,
      a: `Compte tenu du climat continental humide du 69, il est conseillé de nettoyer et démousser sa toiture tous les 3 à 5 ans. L'accumulation de mousse et de lichens retient l'humidité sur les tuiles en terre cuite, ce qui peut provoquer des fissures ou des cassures lors des gelées hivernales à ${nom}.`
    },
    {
      q: `Comment réagir en cas d'urgence de fuite de toiture après une tempête à ${nom} ?`,
      a: `Vous devez déclarer le sinistre à votre assurance habitation sous 5 jours. Pour limiter les dégâts intérieurs à ${nom}, contactez immédiatement un couvreur pour une mise hors d'eau rapide (bâchage temporaire). L'assurance prend généralement en charge les mesures conservatoires urgentes.`
    },
    {
      q: `Quelles aides de la Métropole de Lyon existent pour rénover son toit à ${nom} ?`,
      a: `La Métropole de Lyon propose des aides locales pour la rénovation énergétique (dont l'isolation par l'extérieur ou sarking) dans le cadre de la plateforme Éco-Rénov. Ces aides sont cumulables avec MaPrimeRénov' de l'ANAH et les primes CEE si vos travaux sont réalisés par un couvreur certifié RGE à ${nom}.`
    }
  ];
  
  return faqList;
}

function getMarketData(commune) {
  const { slug, population } = commune;
  const h = hash(slug, 4);
  
  // Base values adjusted by population and a hash variation
  let rgeCount = 2;
  if (population > 100000) rgeCount = 50;      // Lyon / Villeurbanne
  else if (population > 50000) rgeCount = 25;
  else if (population > 20000) rgeCount = 12;
  else if (population > 10000) rgeCount = 7;
  else if (population > 5000) rgeCount = 4;
  
  rgeCount += (h % 3);
  rgeCount = Math.max(1, rgeCount);
  
  // Cost variation (Lyon is more expensive than countryside)
  const isLyonArea = slug.includes('lyon') || ['villeurbanne', 'caluire-et-cuire', 'venissieux', 'bron'].includes(slug);
  const basePriceRef = (isLyonArea ? 135 : 120) + (h % 30); // 120 - 165
  const basePriceDem = 18 + (h % 12);   // 18 - 30
  
  return {
    couvreursRGE: rgeCount,
    prixM2Refection: basePriceRef,
    prixM2Demoussage: basePriceDem,
    delaiMoyenJours: 12 + (h % 14) // 12 - 26 days lead time
  };
}

const enriched = communes.map(commune => {
  const intercommunalite = getIntercommunalite(commune.codePostal, commune.slug);
  const intro = getLocalIntroText(commune);
  const conseil = getLocalAdvice(commune);
  const faq = getLocalFAQ(commune);
  const market = getMarketData(commune);
  
  return {
    ...commune,
    intercommunalite,
    introText: intro,
    conseilLocal: conseil,
    faq: faq,
    marketData: market
  };
});

writeFileSync(communesPath, JSON.stringify(enriched, null, 2), 'utf-8');

console.log(`✅ Enriched ${enriched.length} Rhône (69) communes with unique SEO data.`);
console.log('Sample Lyon 3e:', JSON.stringify(enriched.find(c => c.slug.includes('lyon')), null, 2));
console.log('Sample Villefranche-sur-Saône:', JSON.stringify(enriched.find(c => c.slug === 'villefranche-sur-saone'), null, 2));
