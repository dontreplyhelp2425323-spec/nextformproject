// ═══════════════════════════════════
// NEXT FORM PROJECT — exercises.js
// Base de données centralisée des exercices
// ═══════════════════════════════════


const EXERCISES = [
  // ══════ DOS ══════
  { nom: 'Tirage vertical', groupe: 'dos', difficulte: 3.5, type: 'muscu', variantes: [
    { nom: 'Prise large', difficulte: 3.5 },
    { nom: 'Prise neutre', difficulte: 3.25 },
    { nom: 'Poignée V', difficulte: 3.0 },
    { nom: 'Prise serrée', difficulte: 3.75 },
  ]},
  { nom: 'Rowing machine', groupe: 'dos', difficulte: 3.25, type: 'muscu', variantes: [
    { nom: 'Pronation', difficulte: 3.25 },
    { nom: 'Supination', difficulte: 3.5 },
    { nom: 'Poignée V', difficulte: 3.0 },
  ]},
  { nom: 'Tirage horizontal', groupe: 'dos', difficulte: 3, type: 'muscu', variantes: [
    { nom: 'Prise large', difficulte: 3 },
    { nom: 'Poignée V', difficulte: 3 },
    { nom: 'Prise neutre', difficulte: 3 },
    { nom: 'A genoux avec banc', difficulte: 3 },
  ]},
  { nom: 'Rowing haltère (haltère)', groupe: 'dos', difficulte: 4, type: 'muscu' },
  { nom: 'Tirage barre T', groupe: 'dos', difficulte: 2.5, type: 'muscu', variantes: [
    { nom: 'Prise large', difficulte: 2.5 },
    { nom: 'Prise neutre', difficulte: 2.75 },
    { nom: 'Prise serrée', difficulte: 3.0 },
  ]},
  { nom: 'Pullover machine', groupe: 'dos', difficulte: 5, type: 'muscu' },

  // ══════ BICEPS ══════
  { nom: 'Curl marteau (haltère)', groupe: 'biceps', difficulte: 7.5, type: 'muscu' },
  { nom: 'Curl pupitre ', groupe: 'biceps', difficulte: 5, type: 'muscu', variantes:[
  { nom:'machine',difficulte:5},
   { nom:'machine',difficulte:56.25 },
  ] },
  { nom: 'Curl bayesian', groupe: 'biceps', difficulte: 9, type: 'muscu' },
  { nom: 'Curl assis ', groupe: 'biceps', difficulte: 5, type: 'muscu' },
  { nom: 'Curl barre  ', groupe: 'biceps', difficulte: 5, type: 'muscu' },

  // ══════ PECTORAUX ══════
  { nom: 'Bench', groupe: 'pecs', difficulte: 4, type: 'muscu' },
  { nom: 'Bench incline', groupe: 'pecs', difficulte: 4.75, type: 'muscu' },
  { nom: 'Pec fly', groupe: 'pecs', difficulte: 5, type: 'muscu', variantes:[
    { nom: 'appuie debout', difficulte: 6 },
    { nom: 'appuie assis', difficulte: 5 }
  ] },
  // ══════ ABDOS ══════
  { nom: 'crunch', groupe: 'abdos', difficulte: 2.5, type: 'muscu' },
  // ══════ ÉPAULES ══════
  { nom: 'Élévations latérales ', groupe: 'epaules', difficulte: 9.79, type: 'muscu' , variantes: [
  { nom : 'haltere', difficulte: 9.8 },
  { nom : 'poulie', difficulte: 9.8 }
  ]},
  { nom: 'Face pull', groupe: 'epaules', difficulte: 5, type: 'muscu' },
  { nom: 'Shrugs ', groupe: 'epaules', difficulte: 5, type: 'muscu', variantes: [
  { nom : 'haltere', difficulte: 6 },
  { nom : 'barre', difficulte: 5 },
  { nom : 'smith', difficulte: 4.9}
  ]},
  { nom: 'Développé militaire ', groupe: 'pecs', difficulte: 6.25, type: 'muscu', variantes: [
  { nom : 'haltere', difficulte: 6.5 },
  { nom : 'smith', difficulte: 6.25 }
  ]},
 

  // ══════ TRICEPS ══════
  { nom: 'Extension triceps avant ', groupe: 'triceps', difficulte: 5, type: 'muscu', variantes: [
    { nom:'cordes', difficulte: 5 },
    { nom:'cordes', difficulte: 4.5 }
  ] },

  { nom: 'Extension triceps arrière', groupe: 'triceps', difficulte: 7.75, type: 'muscu', variantes: [
    { nom: 'haltere', difficulte:8},
    { nom: 'barre', difficulte:6.9},
    { nom: 'corde', difficulte:7.75}
  ]},
  { nom: 'Machine dips', groupe: 'triceps', difficulte: 3, type: 'muscu' },
  { nom: 'Barre au front ', groupe: 'triceps', difficulte: 7.5, type: 'muscu' },

  // ══════ JAMBES ══════
  { nom: 'Squat', groupe: 'jambes', difficulte: 6, type: 'muscu' },
  { nom: 'Hack squat', groupe: 'jambes', difficulte: 4.5, type: 'muscu' },
  { nom: 'Leg Presse', groupe: 'jambes', difficulte: 3, type: 'muscu' },
  { nom: 'Leg curl', groupe: 'jambes', difficulte: 3, type: 'muscu' },
  { nom: 'Leg extension', groupe: 'jambes', difficulte: 3, type: 'muscu' },
  { nom: 'Adducteur interne', groupe: 'jambes', difficulte: 2.5, type: 'muscu' },
  { nom: 'Adducteur externe', groupe: 'jambes', difficulte: 2.5, type: 'muscu' },
  { nom: 'Hip thrust', groupe: 'jambes', difficulte: 3.5, type: 'muscu' },
  { nom: 'Fentes (haltère)', groupe: 'jambes', difficulte: 4.5, type: 'muscu' },
  { nom: 'Soulevé de terre', groupe: 'jambes', difficulte: 4, type: 'muscu' },
  { nom: 'Soulevé de terre roumain', groupe: 'jambes', difficulte: 4, type: 'muscu' },
  { nom: 'Mollets debout', groupe: 'jambes', difficulte: 5, type: 'muscu' },
  { nom: 'Mollets assis', groupe: 'jambes', difficulte: 3, type: 'muscu' },

  // ══════ POIDS DE CORPS (poids = poids AJOUTÉ) ══════
  { nom: 'Dips', groupe: 'pecs', difficulte: 9, type: 'poids_de_corps' },
  { nom: 'Tractions', groupe: 'dos', difficulte: 12, type: 'poids_de_corps' },
  { nom: 'Pompes', groupe: 'pecs', difficulte: 11, type: 'poids_de_corps' },
  { nom: 'muscle up', groupe: 'dos,biceps', difficulte: 14, type: 'poids_de_corps' },

  // ══════ CARDIO ══════
  { nom: 'Tapis de course', groupe: 'cardio', difficulte: 2, type: 'cardio' },
  { nom: 'Vélo elliptique', groupe: 'cardio', difficulte: 2, type: 'cardio' },
  { nom: 'Rameur', groupe: 'cardio', difficulte: 3, type: 'cardio' },
  { nom: 'Vélo stationnaire', groupe: 'cardio', difficulte: 2, type: 'cardio' },
];

function getExercise(nom) {
  return EXERCISES.find(e => e.nom === nom) || null;
}

function getExercisesByGroupe(groupe) {
  return EXERCISES.filter(e => e.groupe === groupe);
}

function getAllExerciseNames() {
  return EXERCISES.map(e => e.nom);
}

function getMusculationExercises() {
  return EXERCISES.filter(e => e.type === 'muscu' || e.type === 'poids_de_corps');
}

function getCardioExercises() {
  return EXERCISES.filter(e => e.type === 'cardio');
}
