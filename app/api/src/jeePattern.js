/**
 * JEE Main & JEE Advanced exam pattern, marking schemes, and chapter/subtopic
 * reference data.
 *
 * IMPORTANT: This is compiled from publicly known, widely published JEE
 * exam facts (NTA's own syllabus/marking scheme, and chapter-weightage /
 * subtopic breakdowns that are common knowledge across every JEE coaching
 * ecosystem) -- it is NOT extracted from any copyrighted book. Weightages
 * are approximate ranges reflecting general multi-year trends, and subtopics
 * are used only to bias random selection so freshly generated (original)
 * questions cover real syllabus breadth instead of repeating the same few
 * angles on a chapter.
 */

const EXAM_PATTERNS = {
  "JEE Main": {
    subjects: ["Physics", "Chemistry", "Mathematics"],
    questionsPerSubject: { mcq: 20, numerical: 10, numericalAttempted: 5 },
    totalScoredPerSubject: 25,
    totalMarks: 300,
    formats: ["SingleCorrectMCQ", "Numerical"],
    marking: {
      SingleCorrectMCQ: { full: 4, wrong: -1, unattempted: 0 },
      Numerical: { full: 4, wrong: -1, unattempted: 0 },
    },
  },
  "JEE Advanced": {
    subjects: ["Physics", "Chemistry", "Mathematics"],
    totalMarks: null, // varies by year/paper mix, not a fixed constant
    formats: ["SingleCorrectMCQ", "Numerical", "MultipleCorrectMCQ", "MatrixMatch", "Comprehension"],
    marking: {
      // Full marks only if every part is answered correctly; partial marking
      // rewards partially-correct multi-select answers; any wrong selection
      // forfeits partial credit. These are the well-known JEE Advanced rules.
      SingleCorrectMCQ: { full: 3, wrong: -1, unattempted: 0 },
      Numerical: { full: 4, wrong: 0, unattempted: 0 },
      MultipleCorrectMCQ: {
        full: 4,
        perCorrectPartial: 1, // awarded per correct option chosen, only if zero incorrect chosen
        anyWrongChosen: -2,
        unattempted: 0,
      },
      MatrixMatch: { fullPerRow: 3, wrongRow: 0, unattempted: 0 },
      Comprehension: { full: 3, wrong: -1, unattempted: 0 },
    },
  },
};

const SUBJECT_CHAPTERS = {
  Physics: [
    { name: "Units, Dimensions & Measurement", weight: 3, topics: ["dimensional analysis", "significant figures & errors", "vernier/screw gauge readings"] },
    { name: "Kinematics", weight: 4, topics: ["projectile motion", "relative velocity", "motion graphs", "1D/2D motion with variable acceleration"] },
    { name: "Laws of Motion", weight: 5, topics: ["friction on inclined planes", "connected bodies & pulleys", "circular motion & banking of roads", "pseudo forces in non-inertial frames"] },
    { name: "Work, Energy & Power", weight: 4, topics: ["work-energy theorem", "conservation of mechanical energy", "elastic/inelastic collisions", "power in variable-force systems"] },
    { name: "Rotational Motion", weight: 6, topics: ["moment of inertia of rigid bodies", "torque & angular momentum conservation", "rolling without slipping", "combined translation + rotation"] },
    { name: "Gravitation", weight: 3, topics: ["orbital velocity & satellite energy", "escape velocity", "Kepler's laws", "gravitational potential energy"] },
    { name: "Mechanical Properties of Solids & Fluids", weight: 4, topics: ["stress-strain & Young's modulus", "Bernoulli's theorem", "viscosity & terminal velocity", "surface tension & capillary rise"] },
    { name: "Thermodynamics & Kinetic Theory of Gases", weight: 5, topics: ["first law & thermodynamic processes", "specific heats of gases", "kinetic theory & rms speed", "Carnot engine efficiency"] },
    { name: "Oscillations & Waves", weight: 6, topics: ["SHM energy & phase", "spring-mass/pendulum systems", "wave equation & superposition", "standing waves & beats", "Doppler effect"] },
    { name: "Electrostatics", weight: 7, topics: ["Coulomb's law & field superposition", "Gauss's law applications", "electric potential & potential energy", "capacitors & dielectrics", "dipole in a field"] },
    { name: "Current Electricity", weight: 7, topics: ["Kirchhoff's laws & circuit reduction", "Wheatstone bridge & meter bridge", "EMF, internal resistance & power", "RC circuits (charging/discharging)"] },
    { name: "Magnetic Effects of Current & Magnetism", weight: 6, topics: ["Biot-Savart & Ampere's law", "force on current-carrying conductors", "moving charge in magnetic field", "magnetic dipole & bar magnet"] },
    { name: "Electromagnetic Induction & AC", weight: 6, topics: ["Faraday's & Lenz's law", "self/mutual inductance", "AC circuits with R, L, C", "LCR resonance & power factor"] },
    { name: "Electromagnetic Waves", weight: 2, topics: ["EM spectrum properties", "displacement current", "energy in EM waves"] },
    { name: "Ray & Wave Optics", weight: 6, topics: ["refraction at spherical surfaces & lenses", "prism & dispersion", "interference (YDSE)", "diffraction & polarization", "optical instruments"] },
    { name: "Dual Nature of Matter & Radiation", weight: 4, topics: ["photoelectric effect", "de Broglie wavelength", "Compton effect basics"] },
    { name: "Atoms & Nuclei", weight: 5, topics: ["Bohr model & spectral lines", "radioactive decay law", "binding energy & nuclear reactions", "mass-energy equivalence"] },
    { name: "Semiconductor Electronics & Communication Systems", weight: 5, topics: ["p-n junction diode & rectification", "transistor characteristics", "logic gates", "modulation basics"] },
    { name: "Experimental Physics", weight: 2, topics: ["error propagation in experiments", "standard JEE lab experiments (verniers, resonance tube, etc.)"] },
  ],
  Chemistry: [
    { name: "Some Basic Concepts of Chemistry (Mole Concept)", weight: 5, topics: ["limiting reagent problems", "empirical/molecular formula", "stoichiometry & % yield", "equivalent weight & normality"] },
    { name: "Atomic Structure", weight: 4, topics: ["quantum numbers & orbital shapes", "Bohr model calculations", "electronic configuration & exceptions", "Heisenberg/de Broglie for electrons"] },
    { name: "Chemical Bonding & Molecular Structure", weight: 6, topics: ["VSEPR geometry", "hybridization", "molecular orbital theory", "bond order & magnetic behaviour", "hydrogen bonding effects"] },
    { name: "States of Matter & Gaseous State", weight: 3, topics: ["ideal gas law applications", "real gases & van der Waals equation", "Graham's law of diffusion"] },
    { name: "Chemical Thermodynamics", weight: 5, topics: ["enthalpy of reaction (Hess's law)", "entropy & spontaneity", "Gibbs free energy", "bond enthalpy calculations"] },
    { name: "Chemical & Ionic Equilibrium", weight: 6, topics: ["Kc/Kp & Le Chatelier's principle", "acid-base equilibria & pH", "buffer solutions", "solubility product & common ion effect"] },
    { name: "Redox Reactions & Electrochemistry", weight: 5, topics: ["balancing redox by ion-electron method", "Nernst equation & cell EMF", "electrolysis & Faraday's laws", "conductivity & Kohlrausch's law"] },
    { name: "Chemical Kinetics", weight: 4, topics: ["rate law & order of reaction", "integrated rate equations", "Arrhenius equation", "half-life problems"] },
    { name: "Solutions", weight: 4, topics: ["colligative properties", "Raoult's law & deviations", "molality/molarity conversions", "van't Hoff factor"] },
    { name: "Solid State & Surface Chemistry", weight: 3, topics: ["unit cells & packing efficiency", "defects in solids", "adsorption isotherms", "colloids"] },
    { name: "Periodic Table & Periodicity", weight: 3, topics: ["periodic trends (radius, IE, EA)", "diagonal relationship", "anomalous properties of first-row elements"] },
    { name: "p-Block Elements", weight: 6, topics: ["group 13-14 compounds & anomalies", "group 15-16 oxoacids", "group 17-18 chemistry", "structure of interhalogens/oxides"] },
    { name: "d- and f-Block Elements", weight: 4, topics: ["transition metal general properties", "colour & magnetic properties", "lanthanoid contraction", "important compounds (KMnO4, K2Cr2O7)"] },
    { name: "Coordination Compounds", weight: 5, topics: ["IUPAC nomenclature", "CFT & crystal field splitting", "isomerism in complexes", "magnetic behaviour & hybridization"] },
    { name: "Metallurgy (General Principles)", weight: 2, topics: ["ore concentration methods", "extraction processes (reduction methods)", "refining techniques"] },
    { name: "General Organic Chemistry (GOC) & Isomerism", weight: 6, topics: ["inductive/resonance/hyperconjugation effects", "structural & stereoisomerism", "reaction intermediates stability", "acidity/basicity comparisons"] },
    { name: "Hydrocarbons", weight: 4, topics: ["alkane/alkene/alkyne reactions", "Markovnikov/anti-Markovnikov addition", "aromatic substitution mechanisms"] },
    { name: "Haloalkanes & Haloarenes", weight: 3, topics: ["SN1 vs SN2 mechanisms", "elimination reactions", "Grignard reagent reactions"] },
    { name: "Alcohols, Phenols & Ethers", weight: 4, topics: ["preparation & reactions of alcohols", "phenol acidity & reactions", "Williamson ether synthesis"] },
    { name: "Aldehydes, Ketones & Carboxylic Acids", weight: 4, topics: ["nucleophilic addition reactions", "aldol/Cannizzaro reactions", "carboxylic acid derivatives", "named reactions (Clemmensen, HVZ)"] },
    { name: "Amines & Diazonium Salts", weight: 3, topics: ["basicity comparisons", "preparation methods", "diazonium salt reactions"] },
    { name: "Biomolecules, Polymers & Chemistry in Everyday Life", weight: 3, topics: ["carbohydrate/protein structure basics", "polymer classification", "drugs & everyday chemistry facts"] },
    { name: "Practical & Environmental Chemistry", weight: 2, topics: ["qualitative salt analysis", "pollution & environmental chemistry facts"] },
  ],
  Mathematics: [
    { name: "Sets, Relations & Functions", weight: 4, topics: ["domain/range of functions", "types of relations", "composition & inverse functions"] },
    { name: "Complex Numbers & Quadratic Equations", weight: 5, topics: ["Argand plane & modulus-argument", "roots of quadratics & nature of roots", "cube roots of unity", "De Moivre's theorem"] },
    { name: "Matrices & Determinants", weight: 6, topics: ["properties of determinants", "matrix inverse & adjoint", "system of linear equations", "Cramer's rule"] },
    { name: "Permutations, Combinations & Binomial Theorem", weight: 5, topics: ["circular permutations", "combinations with restrictions", "binomial expansion & general term", "sum of binomial coefficients"] },
    { name: "Sequences & Series", weight: 4, topics: ["AP/GP sum formulas", "AM-GM-HM inequalities", "sum of special series (Sn, Sn^2)"] },
    { name: "Limits, Continuity & Differentiability", weight: 6, topics: ["standard limit forms & L'Hopital-style evaluation", "continuity at a point", "differentiability & corner points"] },
    { name: "Application of Derivatives", weight: 5, topics: ["tangent/normal to curves", "maxima/minima optimization", "increasing/decreasing functions", "rate of change problems"] },
    { name: "Indefinite & Definite Integration", weight: 6, topics: ["substitution & by-parts techniques", "definite integral properties", "integration of rational/trig functions"] },
    { name: "Application of Integrals & Differential Equations", weight: 5, topics: ["area under curves", "first-order differential equations", "variable separable & linear DE"] },
    { name: "Straight Lines & Pair of Straight Lines", weight: 3, topics: ["distance/angle formulas", "family of lines", "pair of straight lines through origin"] },
    { name: "Circles", weight: 4, topics: ["equation of circle from given conditions", "tangent & chord of contact", "family of circles"] },
    { name: "Conic Sections (Parabola, Ellipse, Hyperbola)", weight: 5, topics: ["standard forms & focal properties", "tangent/normal to conics", "eccentricity-based problems"] },
    { name: "Three Dimensional Geometry", weight: 5, topics: ["direction cosines/ratios", "equation of line & plane", "shortest distance between lines", "angle between planes"] },
    { name: "Vector Algebra", weight: 4, topics: ["dot & cross product applications", "scalar triple product", "vector equations of lines/planes"] },
    { name: "Statistics & Probability", weight: 5, topics: ["mean/variance of grouped data", "conditional probability & Bayes' theorem", "binomial distribution"] },
    { name: "Trigonometric Ratios, Identities & Equations", weight: 4, topics: ["trigonometric identities", "general solution of trig equations", "properties of triangles"] },
    { name: "Mathematical Reasoning & Logic", weight: 2, topics: ["truth tables", "logical connectives & implications"] },
  ],
};

function weightedPick(items, weightKey = "weight") {
  const total = items.reduce((s, c) => s + c[weightKey], 0);
  let r = Math.random() * total;
  for (const item of items) {
    r -= item[weightKey];
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

/** Picks a {chapter, topic} pair, weighted by chapter trend-weight and
 * uniformly among that chapter's subtopics. Optionally excludes recently
 * used (chapter, topic) pairs to encourage variety across a session.
 * chapterFilter, if given (a chapter name string, or an array of chapter
 * names), restricts the chapter pool to just those — still weighted among
 * whichever of them are allowed. Used when a student selects one or more
 * specific chapters in Practice mode; omit/null for fully random. */
function pickWeightedChapterTopic(subject, avoidPairs = [], chapterFilter = null) {
  const allChapters = SUBJECT_CHAPTERS[subject];
  if (!allChapters) throw new Error(`Unknown subject: ${subject}`);

  const avoidKey = (c, t) => `${c}::${t}`;
  const avoidSet = new Set(avoidPairs.map((p) => avoidKey(p.chapter, p.topic)));

  let chapters = allChapters;
  if (chapterFilter) {
    const names = Array.isArray(chapterFilter) ? chapterFilter : [chapterFilter];
    const nameSet = new Set(names);
    const filtered = allChapters.filter((c) => nameSet.has(c.name));
    if (filtered.length === 0) throw new Error(`Unknown chapter(s) for ${subject}: ${names.join(", ")}`);
    chapters = filtered;
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const chapter = weightedPick(chapters);
    const topic = chapter.topics[Math.floor(Math.random() * chapter.topics.length)];
    if (!avoidSet.has(avoidKey(chapter.name, topic))) {
      return { chapter: chapter.name, topic };
    }
  }
  // fall back to whatever we land on if everything collides (small pool edge case)
  const chapter = weightedPick(chapters);
  const topic = chapter.topics[Math.floor(Math.random() * chapter.topics.length)];
  return { chapter: chapter.name, topic };
}

/** Normalizes a request's chapter selection (string, array of strings, or
 * absent) into either null (no restriction) or a de-duplicated array of
 * valid chapter names for that subject, silently dropping unknown names. */
function normalizeChapterFilter(subject, input) {
  if (!input) return null;
  const names = Array.isArray(input) ? input : [input];
  const valid = new Set(SUBJECT_CHAPTERS[subject].map((c) => c.name));
  const filtered = [...new Set(names.filter((n) => valid.has(n)))];
  return filtered.length ? filtered : null;
}

module.exports = { EXAM_PATTERNS, SUBJECT_CHAPTERS, pickWeightedChapterTopic, normalizeChapterFilter };
