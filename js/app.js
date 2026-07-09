// ═══════════════════════════════════
// NEXT FORM PROJECT — app.js
// ═══════════════════════════════════

// ── CONFIG ──
const SUPABASE_URL = 'https://hvzjqaahbbavzrrvsuwk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2empxYWFoYmJhdnpycnZzdXdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTg2NjgsImV4cCI6MjA5Mjk3NDY2OH0.pmvBEzZHVSOP_eZDzAx0sGBDucqTCJ61LlzJr_eT4gI';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const BONUS_EXOS = ['Soulevé de terre','Squat','Développé couché','Tractions','Développé militaire'];
const COULEURS   = ['#4ade80','#22c55e','#86efac','#34d399','#6ee7b7','#a3e635','#84cc16','#16a34a','#15803d','#166534'];

// ── SÉANCES PRÉDÉFINIES ──
const SEANCES = [];

// ── THÈMES COULEURS ──
const THEMES = {
  vert:   { accent: '#4ade80', accent2: '#22c55e', accentRgb: '74,222,128' },
  bleu:   { accent: '#60a5fa', accent2: '#3b82f6', accentRgb: '96,165,250' },
  violet: { accent: '#a78bfa', accent2: '#7c3aed', accentRgb: '167,139,250' },
  rouge:  { accent: '#f87171', accent2: '#ef4444', accentRgb: '248,113,113' },
  rose:   { accent: '#f472b6', accent2: '#ec4899', accentRgb: '244,114,182' }
};

// ── ÉTAT ──
let currentUser  = null;
let prData       = {};
let activeSeance = null;
let todayDone    = false;
let todayCount   = 0;
const MAX_SEANCES_PER_DAY = 2;
let customBonus  = null;
let bonusSeries  = 4;
let bonusText    = '';
let classementMode = 'semaine';
let lastWeekWinner = null;
let lastMonthWinner = null;
let isFinishing  = false;
let streakData   = {}; // { userId: { current: X, best: Y } }

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

function getAccentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#4ade80';
}

function getAccentRgb() {
  return getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim() || '74,222,128';
}

// ════════════════════════════════════
// FORMULE DE POINTS
// ════════════════════════════════════

function calcPoints(reps, poids, exoName, diffOverride) {
  const exo = getExercise(exoName);
  const diff = diffOverride != null ? diffOverride : (exo ? exo.difficulte : 5);
  const isHaltere = exoName.includes('(haltère)');
  const isPdC = exo && exo.type === 'poids_de_corps';

  // Pour les haltères : le poids entré = 1 haltère, on double pour le vrai total
  const realPoids = isHaltere ? poids * 2 : poids;

  let base;
  if (isPdC) {
    // Poids de corps : bonus de base (le mouvement lui-même vaut des points)
    // + bonus si poids ajouté
    const basePoints = diff * reps * 0.5;
    const poidsBonus = realPoids > 0 ? Math.pow(realPoids, 1.2) * 0.3 : 0;
    base = basePoints + poidsBonus;
  } else {
    const effectivePoids = Math.max(realPoids, 1);
    const poidsScore = Math.pow(effectivePoids, 1.2);
    const repsBonus = 1 + (reps * 0.08);
    base = poidsScore * repsBonus * diff * 0.12;
  }

  const bonus = exoName === getWeekBonusActual() ? 15 : 0;
  return Math.round(base) + bonus;
}

function calcCardioPoints(duree, vitesse, inclinaison) {
  // duree en minutes, vitesse en km/h, inclinaison en %
  const base = duree * (vitesse * 0.3) * (1 + inclinaison * 0.1);
  return Math.round(base * 0.4);
}

// ════════════════════════════════════
// UTILS
// ════════════════════════════════════

function getWeekNumber() {
  // Semaine ISO 8601 : commence le lundi à 00h00
  const d = new Date();
  const day = d.getUTCDay() || 7; // 1=lun … 7=dim
  const thu = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - day));
  const jan1 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  return Math.ceil(((thu - jan1) / 86400000 + 1) / 7);
}

function getWeekStart() {
  const d = new Date(), day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
  return monday.toISOString();
}

function getMonthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).toISOString();
}

function getPrevWeekRange() {
  const d = new Date(), day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const thisMonday = new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0);
  const prevMonday = new Date(thisMonday.getTime() - 7 * 86400000);
  return { start: prevMonday.toISOString(), end: thisMonday.toISOString() };
}

function getPrevMonthRange() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth() - 1, 1, 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function getWeekBonus() {
  return BONUS_EXOS[getWeekNumber() % BONUS_EXOS.length];
}

function getInitials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getCouleur(userId) {
  let hash = 0;
  for (let c of (userId || '')) hash = hash * 31 + c.charCodeAt(0);
  return COULEURS[Math.abs(hash) % COULEURS.length];
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  void t.offsetWidth;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('screen-' + name).classList.add('active');
  const tab = document.getElementById('tab-' + name);
  if (tab) tab.classList.add('active');
  if (name === 'classement') loadClassement();
  if (name === 'seance')     loadSeance();
  if (name === 'chrono')     loadChrono();
  if (name === 'nutrition')  loadNutrition();
  if (name === 'statistiques') loadStatistiques();
  if (name === 'profil')     loadProfil();
  if (name === 'admin')      loadAdmin();
  if (name === 'historique') loadHistorique();
  if (name === 'settings')   renderSettings();
  const tabbar = document.getElementById('tabbar');
  if (tabbar) tabbar.style.display = (name === 'auth' || name === 'discover') ? 'none' : '';
}

// ════════════════════════════════════
// AUTH
// ════════════════════════════════════

function switchAuthTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('form-login').style.display  = tab === 'login'  ? '' : 'none';
  document.getElementById('form-signup').style.display = tab === 'signup' ? '' : 'none';
  document.getElementById('auth-error').textContent = '';
}

async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  if (!email || !pass) { document.getElementById('auth-error').textContent = 'Remplis tous les champs'; return; }
  const { error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) document.getElementById('auth-error').textContent = error.message;
}

async function handleSignup() {
  const pseudo = document.getElementById('signup-pseudo').value.trim();
  const email  = document.getElementById('signup-email').value.trim();
  const pass   = document.getElementById('signup-password').value;
  if (!pseudo || !email || !pass) { document.getElementById('auth-error').textContent = 'Remplis tous les champs'; return; }
  if (pass.length < 6) { document.getElementById('auth-error').textContent = 'Mot de passe trop court (min 6)'; return; }
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { pseudo } } });
  if (error) { document.getElementById('auth-error').textContent = error.message; return; }
  if (data.user) {
    await sb.from('profiles').upsert({ id: data.user.id, pseudo, email, points_total: 0, nb_seances: 0, nb_pr: 0 });
    showToast('Bienvenue ' + pseudo + ' !');
  }
}

async function handleLogout() {
  await sb.auth.signOut();
  currentUser = null; activeSeance = null; todayDone = false; prData = {};
  document.getElementById('tabbar').style.display = 'none';
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-auth').classList.add('active');
}

async function handleForgotPassword() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) { document.getElementById('auth-error').textContent = 'Entre ton email d\'abord'; return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: 'https://next-form-project.vercel.app/' });
  if (error) { document.getElementById('auth-error').textContent = error.message; return; }
  showToast('Email de reset envoyé !');
  document.getElementById('auth-error').textContent = '';
}

function promptChangePseudo() {
  const newPseudo = prompt('Nouveau pseudo :');
  if (!newPseudo || !newPseudo.trim()) return;
  changePseudo(newPseudo.trim());
}

async function changePseudo(newPseudo) {
  const { error: e1 } = await sb.auth.updateUser({ data: { pseudo: newPseudo } });
  if (e1) { showToast('Erreur : ' + e1.message, 'error'); return; }
  const { error: e2 } = await sb.from('profiles').update({ pseudo: newPseudo }).eq('id', currentUser.id);
  if (e2) { showToast('Erreur : ' + e2.message, 'error'); return; }
  showToast('Pseudo changé !');
  loadProfil();
}

function promptChangePassword() {
  const newPass = prompt('Nouveau mot de passe (min 6 caractères) :');
  if (!newPass) return;
  if (newPass.length < 6) { showToast('Mot de passe trop court (min 6)', 'error'); return; }
  changePassword(newPass);
}

async function changePassword(newPass) {
  const { error } = await sb.auth.updateUser({ password: newPass });
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('Mot de passe changé !');
}

// ════════════════════════════════════
// CLASSEMENT
// ════════════════════════════════════

async function loadClassement() {
  const bonusName = getWeekBonusActual();
  document.getElementById('bonus-name').textContent = bonusName + (bonusSeries ? ' · ' + bonusSeries + ' séries' : '');
  const bonusPtsEl = document.querySelector('.bonus-pts');
  if (bonusText && bonusPtsEl) {
    bonusPtsEl.textContent = bonusText;
  } else if (bonusPtsEl) {
    bonusPtsEl.textContent = '+15 pts bonus par série';
  }
  const d = new Date();
  document.getElementById('week-label').textContent =
    classementMode === 'semaine'
      ? `Semaine ${getWeekNumber()} · ${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
      : `${d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;

  const periodStart = classementMode === 'semaine' ? getWeekStart() : getMonthStart();
  const { data: seances, error: e1 } = await sb.from('seances').select('user_id, points').gte('created_at', periodStart);
  const { data: profiles, error: e2 } = await sb.from('profiles').select('*');

  if (e1 || e2) { showToast('Erreur de chargement', 'error'); return; }

  loadActivity(profiles);
  await loadWinners();
  await loadAllStreaks(profiles);

  const ptsByUser = {};
  (seances || []).forEach(s => { ptsByUser[s.user_id] = (ptsByUser[s.user_id] || 0) + s.points; });

  const ranked = (profiles || [])
    .map(p => ({ ...p, pts_period: ptsByUser[p.id] || 0 }))
    .sort((a, b) => b.pts_period - a.pts_period);

  const myRank = ranked.findIndex(r => r.id === currentUser?.id) + 1;
  const myPts  = ptsByUser[currentUser?.id] || 0;
  const periodEl = document.getElementById('period-label');
  if (periodEl) periodEl.textContent = classementMode === 'semaine' ? 'Ton score cette semaine' : 'Ton score ce mois';
  document.getElementById('my-week-pts').textContent  = myPts.toLocaleString('fr-FR') + ' pts';
  document.getElementById('my-week-rank').textContent = myRank > 0
    ? `${myRank}${myRank === 1 ? 'er' : 'ème'} place sur ${ranked.length} guerriers`
    : 'Fais ta première séance !';

  const medals  = ['🥇','🥈','🥉'];
  const classes = ['gold','silver','bronze'];

  const toggleHtml = `
    <div class="classement-toggle">
      <button class="toggle-btn ${classementMode === 'semaine' ? 'active' : ''}" onclick="switchClassementMode('semaine')">Semaine</button>
      <button class="toggle-btn ${classementMode === 'mois' ? 'active' : ''}" onclick="switchClassementMode('mois')">Mois</button>
    </div>`;

  const renderRankItem = (r, i) => {
    const pdp = getAvatarSrc(r.avatar_url) || getAvatarSrc(localStorage.getItem('pdp_' + r.id));
    const avatarContent = pdp ? `<img src="${esc(pdp)}" alt="">` : esc(getInitials(r.pseudo));
    const avatarStyle = pdp ? 'background:none' : `background:${getCouleur(r.id)}22;color:${getCouleur(r.id)}`;
    const crown = lastWeekWinner === r.id ? ' 👑' : '';
    const diamond = lastMonthWinner === r.id ? ' 💎' : '';
    const userStreak = streakData[r.id];
    const streakBadge = userStreak && userStreak.current >= 2 ? ` <span class="streak-badge">${userStreak.current}🔥</span>` : '';
    return `
      <div class="rank-item ${r.id === currentUser?.id ? 'me' : ''} clickable" onclick="showUserProfil('${r.id}')">
        <div class="rank-num ${i < 3 ? classes[i] : ''}">${i < 3 ? medals[i] : i + 1}</div>
        <div class="rank-avatar" style="${avatarStyle}">${avatarContent}</div>
        <div class="rank-info">
          <div class="rank-name ${r.id === currentUser?.id ? 'me-label' : ''}">${esc(r.pseudo)}${crown}${diamond}${streakBadge}${r.id === currentUser?.id ? ' (toi)' : ''}</div>
          <div class="rank-streak">${r.nb_seances || 0} séances total</div>
        </div>
        <div class="rank-pts">${(r.pts_period || 0).toLocaleString('fr-FR')}</div>
      </div>`;
  };

  if (ranked.length === 0) {
    document.getElementById('rank-list').innerHTML = toggleHtml +
      `<div class="empty-state"><div class="empty-icon">👥</div><p>Personne encore ${classementMode === 'semaine' ? 'cette semaine' : 'ce mois'} !</p></div>`;
    return;
  }

  const top10 = ranked.slice(0, 10);
  const myRankIndex = ranked.findIndex(r => r.id === currentUser?.id);
  const meInTop10 = myRankIndex < 10;

  let html = toggleHtml + top10.map((r, i) => renderRankItem(r, i)).join('');

  // Si l'utilisateur n'est pas dans le top 10, afficher son rang séparé en bas
  if (!meInTop10 && myRankIndex >= 0) {
    const me = ranked[myRankIndex];
    html += `<div class="rank-separator">···</div>` + renderRankItem(me, myRankIndex);
  }

  document.getElementById('rank-list').innerHTML = html;
}

function switchClassementMode(mode) {
  classementMode = mode;
  loadClassement();
}

// ── STREAK HELPERS ──

// ISO week key "YYYY-Www" for a YYYY-MM-DD string
function isoWeekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  const day = d.getUTCDay() || 7; // 1=Mon … 7=Sun
  const thu = new Date(d);
  thu.setUTCDate(d.getUTCDate() + 4 - day);
  const jan1 = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thu - jan1) / 86400000 + 1) / 7);
  return `${thu.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function shiftDay(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Core streak algorithm — 1 joker (rest day) per ISO week.
// days: Set<YYYY-MM-DD>, today: YYYY-MM-DD
// Returns { current, best, jokerUsedThisWeek }
function computeStreak(days, today) {
  if (!days || days.size === 0) return { current: 0, best: 0, jokerUsedThisWeek: false };
  const sortedDays = [...days].sort().reverse();

  // ── current streak ──
  // Alive if last training was today or yesterday (still time to train today)
  const yesterday = shiftDay(today, -1);
  const anchor = days.has(today) ? today : days.has(yesterday) ? yesterday : null;
  let current = 0;
  let jokerUsedThisWeek = false;

  if (anchor) {
    const usedJokers = new Set();
    let cursor = anchor;
    let restPending = false; // true = joker consumed but next day not confirmed yet

    while (true) {
      if (days.has(cursor)) {
        current++;
        restPending = false;
        cursor = shiftDay(cursor, -1);
      } else if (!restPending) {
        const week = isoWeekKey(cursor);
        if (!usedJokers.has(week)) {
          usedJokers.add(week);
          restPending = true;
          cursor = shiftDay(cursor, -1);
        } else { break; }
      } else { break; } // two consecutive missed days
    }

    jokerUsedThisWeek = usedJokers.has(isoWeekKey(today));
  }

  // ── best streak ──
  // Walk consecutive training days; gap of 2 = 1 rest day, try joker for that ISO week
  let best = 0, streak = 0;
  const usedJokersBest = new Set();

  for (let i = 0; i < sortedDays.length; i++) {
    if (i === 0) {
      streak = 1;
    } else {
      const diff = Math.round(
        (new Date(sortedDays[i-1] + 'T12:00:00Z') - new Date(sortedDays[i] + 'T12:00:00Z')) / 86400000
      );
      if (diff === 1) {
        streak++;
      } else if (diff === 2) {
        const skipped = shiftDay(sortedDays[i-1], -1);
        const week = isoWeekKey(skipped);
        if (!usedJokersBest.has(week)) {
          usedJokersBest.add(week);
          streak++;
        } else {
          best = Math.max(best, streak);
          streak = 1;
          usedJokersBest.clear();
        }
      } else {
        best = Math.max(best, streak);
        streak = 1;
        usedJokersBest.clear();
      }
    }
  }
  best = Math.max(best, streak);

  return { current, best, jokerUsedThisWeek };
}

async function calcStreak(userId) {
  const { data } = await sb.from('seances').select('created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(200);
  if (!data || data.length === 0) return { current: 0, best: 0, jokerUsedThisWeek: false };

  const days = new Set();
  data.forEach(s => { days.add(new Date(s.created_at).toISOString().slice(0, 10)); });
  const today = new Date().toISOString().slice(0, 10);
  return computeStreak(days, today);
}

async function loadAllStreaks(profiles) {
  const { data: allSeances } = await sb.from('seances').select('user_id, created_at')
    .order('created_at', { ascending: false }).limit(500);

  if (!allSeances) return;

  const seancesByUser = {};
  allSeances.forEach(s => {
    if (!seancesByUser[s.user_id]) seancesByUser[s.user_id] = new Set();
    seancesByUser[s.user_id].add(new Date(s.created_at).toISOString().slice(0, 10));
  });

  const today = new Date().toISOString().slice(0, 10);

  (profiles || []).forEach(p => {
    const days = seancesByUser[p.id];
    if (!days || days.size === 0) { streakData[p.id] = { current: 0, best: 0, jokerUsedThisWeek: false }; return; }
    streakData[p.id] = computeStreak(days, today);
  });
}

async function loadWinners() {
  const prevWeek = getPrevWeekRange();
  const { data: weekSeances } = await sb.from('seances').select('user_id, points')
    .gte('created_at', prevWeek.start).lt('created_at', prevWeek.end);
  if (weekSeances && weekSeances.length > 0) {
    const ptsByUser = {};
    weekSeances.forEach(s => { ptsByUser[s.user_id] = (ptsByUser[s.user_id] || 0) + s.points; });
    const sorted = Object.entries(ptsByUser).sort((a, b) => b[1] - a[1]);
    lastWeekWinner = sorted[0] ? sorted[0][0] : null;
  }

  const prevMonth = getPrevMonthRange();
  const { data: monthSeances } = await sb.from('seances').select('user_id, points')
    .gte('created_at', prevMonth.start).lt('created_at', prevMonth.end);
  if (monthSeances && monthSeances.length > 0) {
    const ptsByUser = {};
    monthSeances.forEach(s => { ptsByUser[s.user_id] = (ptsByUser[s.user_id] || 0) + s.points; });
    const sorted = Object.entries(ptsByUser).sort((a, b) => b[1] - a[1]);
    lastMonthWinner = sorted[0] ? sorted[0][0] : null;
  }
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return 'il y a ' + mins + ' min';
  if (hours < 24) return 'il y a ' + hours + 'h';
  if (days === 1) return 'hier';
  return 'il y a ' + days + ' j';
}

async function loadActivity(profiles) {
  const pseudoMap = {};
  (profiles || []).forEach(p => { pseudoMap[p.id] = p.pseudo; });

  const { data: recentPR } = await sb.from('pr_history').select('user_id, exercice, poids, created_at').order('created_at', { ascending: false }).limit(10);
  const { data: recentSeances } = await sb.from('seances').select('user_id, points, seance_nom, created_at').order('created_at', { ascending: false }).limit(10);

  const activities = [];

  (recentPR || []).forEach(pr => {
    activities.push({
      type: 'pr',
      user: pseudoMap[pr.user_id] || '?',
      text: `a battu son PR sur <strong>${esc(pr.exercice)}</strong> — ${pr.poids} kg`,
      time: pr.created_at
    });
  });

  (recentSeances || []).forEach(s => {
    activities.push({
      type: 'seance',
      user: pseudoMap[s.user_id] || '?',
      text: `a terminé <strong>${esc(s.seance_nom || 'une séance')}</strong> — +${s.points} pts`,
      time: s.created_at
    });
  });

  activities.sort((a, b) => new Date(b.time) - new Date(a.time));

  const list = document.getElementById('activity-list');
  if (activities.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Aucune activité récente</p></div>';
    return;
  }
  list.innerHTML = activities.slice(0, 5).map(a => `
    <div class="activity-item">
      <div class="activity-icon">${a.type === 'pr' ? '🏆' : '💪'}</div>
      <div class="activity-text"><strong>${esc(a.user)}</strong> ${a.text}</div>
      <div class="activity-time">${timeAgo(a.time)}</div>
    </div>`).join('');
}

// ════════════════════════════════════
// SÉANCE
// ════════════════════════════════════

async function loadSeance() {
  await checkTodayDone();
  if (!activeSeance) {
    const restored = loadSeanceFromLocal();
    if (restored) activeSeance = restored;
  }
  const myStreak = await calcStreak(currentUser.id);
  const streakEl = document.getElementById('seance-streak');
  if (streakEl) {
    if (myStreak.current >= 1) {
      const jokerBadge = myStreak.jokerUsedThisWeek
        ? `<span class="streak-joker used" title="Jour de repos utilisé cette semaine">🛌</span>`
        : `<span class="streak-joker" title="1 jour de repos disponible cette semaine">🛌</span>`;
      streakEl.innerHTML = `<div class="streak-display"><span class="streak-flame">🔥</span><span class="streak-count">${myStreak.current} jour${myStreak.current > 1 ? 's' : ''}</span><span class="streak-label">de streak</span>${jokerBadge}</div>`;
      streakEl.style.display = '';
    } else {
      streakEl.innerHTML = `<div class="streak-display off"><span class="streak-flame">🔥</span><span class="streak-count">0</span><span class="streak-label">Commence ta streak !</span></div>`;
      streakEl.style.display = '';
    }
  }
  if (activeSeance) {
    renderActiveSeance();
  } else {
    renderSeanceChoix();
  }
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function checkTodayDone() {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const { count } = await sb.from('seances').select('*', { count: 'exact', head: true })
    .eq('user_id', currentUser.id).gte('created_at', todayStart.toISOString());
  todayCount = count || 0;
  todayDone = todayCount >= MAX_SEANCES_PER_DAY;
}

async function loadCustomSeances() {
  const { data } = await sb.from('custom_seances').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  return data || [];
}

function renderSeanceChoix() {
  const area = document.getElementById('seance-content');
  if (todayDone) {
    area.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>Tu as déjà fait tes ' + MAX_SEANCES_PER_DAY + ' séances aujourd\'hui !<br>Reviens demain.</p></div>';
    return;
  }

  const savedSeance = loadSeanceFromLocal();
  loadCustomSeances().then(customSeances => {
    const resumeHtml = savedSeance ? `
      <div class="section-title">Séance en cours</div>
      <div class="seance-choices">
        <div class="seance-choice-card" onclick="resumeSavedSeance()" style="border-color:rgba(var(--accent-rgb),0.4);position:relative">
          <span class="abandon-seance-btn" onclick="event.stopPropagation();abandonSavedSeance()" style="position:absolute;top:8px;right:10px;font-size:20px;color:var(--muted);cursor:pointer;line-height:1">&times;</span>
          <div class="seance-choice-name">${esc(savedSeance.nom)} (en cours)</div>
          <div class="seance-choice-detail">${savedSeance.exos.filter(e => e.done).length}/${savedSeance.exos.length} exercices faits · ${savedSeance.totalPts} pts</div>
        </div>
      </div>` : '';

    area.innerHTML = `
      ${resumeHtml}
      <div class="section-title">Séances prédéfinies</div>
      <div class="seance-choices">
        ${SEANCES.map((s, i) => {
          const totalSeries = s.exos.reduce((a, e) => a + (e.series || e.seriesMin || 0), 0);
          return `
          <div class="seance-choice-card" onclick="startSeance(${i})">
            <div class="seance-choice-name">${esc(s.nom)}</div>
            <div class="seance-choice-detail">${s.exos.length} exercices · ~${totalSeries} séries</div>
          </div>`;
        }).join('')}
      </div>
      <div class="section-title">Tes séances personnalisées</div>
      <div class="seance-choices">
        ${customSeances.length > 0 ? customSeances.map(cs => {
          const exos = JSON.parse(cs.exercices || '[]');
          return `
          <div class="seance-choice-card" onclick="startCustomSeance('${cs.id}')">
            <div class="seance-choice-name">${esc(cs.nom)}</div>
            <div class="seance-choice-detail">${exos.length} exercices</div>
            <div class="seance-choice-actions" onclick="event.stopPropagation()">
              <span class="seance-action-btn" onclick="editCustomSeance('${cs.id}')">Modifier</span>
              <span class="seance-action-btn danger" onclick="deleteCustomSeance('${cs.id}')">Suppr</span>
            </div>
          </div>`;
        }).join('') : '<div class="empty-state" style="padding:16px"><p>Aucune séance custom</p></div>'}
        <div class="seance-choice-card create-card" onclick="showCreateCustomSeance()">
          <div class="seance-choice-name">+ Créer une séance</div>
          <div class="seance-choice-detail">Choisis tes exercices</div>
        </div>
      </div>`;
  });
}

let customSeanceSelected = [];

function showCreateCustomSeance(existingId, existingData) {
  const existing = existingData ? JSON.parse(existingData.exercices || '[]') : [];
  customSeanceSelected = existing.map(e => ({ nom: e.nom, series: e.series || 3 }));
  window._customSeanceEditId = existingId || '';
  window._customSeanceNom = existingData ? existingData.nom : '';
  renderCustomSeanceForm();
}

function renderCustomSeanceForm() {
  const area = document.getElementById('seance-content');
  const existingId = window._customSeanceEditId;
  const existingNom = window._customSeanceNom;
  const allExos = EXERCISES;

  const selectedHtml = customSeanceSelected.length === 0
    ? '<div class="empty-state" style="padding:12px"><p>Aucun exercice sélectionné</p></div>'
    : customSeanceSelected.map((e, i) => `
      <div class="selected-exo-item">
        <div class="selected-exo-order">
          <span class="order-btn ${i === 0 ? 'disabled' : ''}" onclick="moveExoUp(${i})">▲</span>
          <span class="order-btn ${i === customSeanceSelected.length - 1 ? 'disabled' : ''}" onclick="moveExoDown(${i})">▼</span>
        </div>
        <span class="selected-exo-name">${esc(e.nom)}</span>
        <select class="exo-series-select" onchange="updateExoSeries(${i}, this.value)">
          ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${n === e.series ? 'selected' : ''}>${n}s</option>`).join('')}
        </select>
        <span class="selected-exo-remove" onclick="removeSelectedExo(${i})">✕</span>
      </div>`).join('');

  area.innerHTML = `
    <div class="section-title">${existingId ? 'Modifier' : 'Créer'} une séance</div>
    <div class="custom-seance-form">
      <div class="field"><label>Nom de la séance</label><input type="text" id="custom-seance-nom" placeholder="Ex: Push day" value="${esc(existingNom)}" oninput="window._customSeanceNom=this.value"></div>

      <div class="section-title">Tes exercices (${customSeanceSelected.length})</div>
      <div class="selected-exo-list" id="selected-exo-list">${selectedHtml}</div>

      <div class="section-title">Ajouter un exercice</div>
      <input class="nutri-search" type="text" id="exo-search-input" placeholder="Rechercher un exercice..." oninput="filterExoList()">
      <div class="exo-select-list" id="exo-select-list">
        ${allExos.map(e => {
          const isSelected = customSeanceSelected.some(s => s.nom === e.nom);
          const exData = getExercise(e.nom);
          const tag = exData && exData.type === 'cardio' ? 'Cardio' : (exData ? exData.groupe : '');
          return `
          <div class="exo-select-item ${isSelected ? 'selected' : ''}" onclick="toggleExoInList('${esc(e.nom).replace(/'/g, "\\'")}')">
            <span class="exo-select-name">${esc(e.nom)}</span>
            <span class="exo-select-diff">${tag}</span>
            <span class="exo-add-icon">${isSelected ? '✓' : '+'}</span>
          </div>`;
        }).join('')}
      </div>

      <button class="btn" onclick="saveCustomSeance('${existingId || ''}')" style="margin-top:16px">${existingId ? 'Sauvegarder' : 'Créer la séance'}</button>
      <button class="btn secondary" onclick="loadSeance()">Annuler</button>
    </div>`;
}

function filterExoList() {
  const q = document.getElementById('exo-search-input').value.toLowerCase();
  const items = document.querySelectorAll('#exo-select-list .exo-select-item');
  items.forEach(item => {
    const name = item.querySelector('.exo-select-name').textContent.toLowerCase();
    item.style.display = name.includes(q) ? '' : 'none';
  });
}

function toggleExoInList(nom) {
  const idx = customSeanceSelected.findIndex(e => e.nom === nom);
  if (idx >= 0) {
    customSeanceSelected.splice(idx, 1);
  } else {
    customSeanceSelected.push({ nom, series: 3 });
  }
  renderCustomSeanceForm();
}

function moveExoUp(i) {
  if (i <= 0) return;
  [customSeanceSelected[i - 1], customSeanceSelected[i]] = [customSeanceSelected[i], customSeanceSelected[i - 1]];
  renderCustomSeanceForm();
}

function moveExoDown(i) {
  if (i >= customSeanceSelected.length - 1) return;
  [customSeanceSelected[i], customSeanceSelected[i + 1]] = [customSeanceSelected[i + 1], customSeanceSelected[i]];
  renderCustomSeanceForm();
}

function updateExoSeries(i, val) {
  customSeanceSelected[i].series = parseInt(val) || 3;
}

function removeSelectedExo(i) {
  customSeanceSelected.splice(i, 1);
  renderCustomSeanceForm();
}

async function saveCustomSeance(existingId) {
  const nom = document.getElementById('custom-seance-nom').value.trim();
  if (!nom) { showToast('Donne un nom à ta séance', 'error'); return; }
  const exos = customSeanceSelected;
  if (exos.length === 0) { showToast('Choisis au moins un exercice', 'error'); return; }

  if (existingId) {
    const { error } = await sb.from('custom_seances').update({ nom, exercices: JSON.stringify(exos) }).eq('id', existingId);
    if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
    showToast('Séance modifiée !');
  } else {
    const { error } = await sb.from('custom_seances').insert({ user_id: currentUser.id, nom, exercices: JSON.stringify(exos) });
    if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
    showToast('Séance créée !');
  }
  loadSeance();
}

async function editCustomSeance(id) {
  const { data } = await sb.from('custom_seances').select('*').eq('id', id).single();
  if (!data) { showToast('Séance introuvable', 'error'); return; }
  showCreateCustomSeance(id, data);
}

async function deleteCustomSeance(id) {
  if (!confirm('Supprimer cette séance ?')) return;
  await sb.from('custom_seances').delete().eq('id', id);
  showToast('Séance supprimée');
  loadSeance();
}

async function startCustomSeance(id) {
  clearSeanceLocal();
  const { data } = await sb.from('custom_seances').select('*').eq('id', id).single();
  if (!data) { showToast('Séance introuvable', 'error'); return; }
  const exos = JSON.parse(data.exercices || '[]');
  activeSeance = {
    nom: data.nom,
    exos: exos.map(e => ({
      ...e,
      series: e.series || 3,
      needsChoice: false,
      done: false, skipped: false, prBroken: false, series_data: []
    })),
    currentExo: 0,
    currentSerie: 0,
    choosingSeries: false,
    totalPts: 0
  };
  prData = {};
  if (currentUser) localStorage.setItem('activeSeance_' + currentUser.id + '_date', getTodayKey());
  renderActiveSeance();
}

function toggleCustomSeanceDetail(id) {
  const detail = document.getElementById('cs-detail-' + id);
  const chevron = document.getElementById('cs-chevron-' + id);
  if (!detail) return;
  const open = detail.style.display !== 'none';
  detail.style.display = open ? 'none' : '';
  if (chevron) chevron.textContent = open ? '▾' : '▴';
}

async function copyCustomSeance(id) {
  const { data } = await sb.from('custom_seances').select('*').eq('id', id).single();
  if (!data) { showToast('Séance introuvable', 'error'); return; }
  const { error } = await sb.from('custom_seances').insert({
    user_id: currentUser.id,
    nom: data.nom + ' (copie)',
    exercices: data.exercices
  });
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast('Séance copiée dans tes séances !');
}

function startSeance(index) {
  clearSeanceLocal();
  const s = SEANCES[index];
  activeSeance = {
    nom: s.nom,
    exos: s.exos.map(e => ({
      ...e,
      series: e.series || 0,
      needsChoice: !e.series && e.seriesMin,
      done: false, skipped: false, prBroken: false, series_data: []
    })),
    currentExo: 0,
    currentSerie: 0,
    choosingSeries: false,
    totalPts: 0
  };
  prData = {};
  if (currentUser) localStorage.setItem('activeSeance_' + currentUser.id + '_date', getTodayKey());
  checkSeriesChoice();
}

function checkSeriesChoice() {
  const exo = activeSeance.exos[activeSeance.currentExo];
  const exoData = getExercise(exo.nom);
  // Si variantes disponibles et pas encore choisie
  if (exoData && exoData.variantes && exoData.variantes.length > 0 && !exo.varianteChoisie) {
    renderVarianteChoice();
    return;
  }
  if (exo.needsChoice && !exo.series) {
    activeSeance.choosingSeries = true;
    renderSeriesChoice();
  } else {
    activeSeance.choosingSeries = false;
    renderActiveSeance();
  }
}

function renderVarianteChoice() {
  const area = document.getElementById('seance-content');
  const s = activeSeance;
  const exo = s.exos[s.currentExo];
  const exoData = getExercise(exo.nom);
  const progress = s.exos.filter(e => e.done || e.skipped).length;

  area.innerHTML = `
    <div class="seance-header">
      <div class="seance-title-row">
        <button class="btn-back" onclick="confirmQuitSeance()">← Retour</button>
        <div class="seance-title">${esc(s.nom)}</div>
        <div class="pts-live">${s.totalPts} pts</div>
      </div>
      <div class="seance-progress">
        <div class="seance-progress-bar" style="width:${(progress / s.exos.length) * 100}%"></div>
      </div>
      <div class="seance-progress-text">${progress}/${s.exos.length} exercices</div>
    </div>
    <div class="section-title">${esc(exo.nom)} — Choisis ta variante</div>
    <div class="serie-choice-card">
      <div class="variante-choice-grid">
        ${exoData.variantes.map(v => `
          <button class="variante-choice-btn" onclick="choisirVariante('${esc(v.nom)}', ${v.difficulte})">
            <span class="variante-btn-nom">${esc(v.nom)}</span>
            <span class="variante-btn-diff">diff. ${v.difficulte}</span>
          </button>`).join('')}
      </div>
      <button class="skip-btn" onclick="choisirVariante('', ${exoData.difficulte})">Sans préférence</button>
    </div>`;
  saveSeanceToLocal();
}

function choisirVariante(nomVariante, difficulte) {
  const exo = activeSeance.exos[activeSeance.currentExo];
  exo.varianteChoisie = nomVariante || 'défaut';
  exo.varianteDiff = difficulte;
  if (exo.needsChoice && !exo.series) {
    activeSeance.choosingSeries = true;
    renderSeriesChoice();
  } else {
    activeSeance.choosingSeries = false;
    renderActiveSeance();
  }
}

function renderSeriesChoice() {
  const area = document.getElementById('seance-content');
  const s = activeSeance;
  const exo = s.exos[s.currentExo];
  const progress = s.exos.filter(e => e.done || e.skipped).length;

  const options = [];
  for (let i = exo.seriesMin; i <= exo.seriesMax; i++) {
    options.push(i);
  }

  area.innerHTML = `
    <div class="seance-header">
      <div class="seance-title-row">
        <button class="btn-back" onclick="confirmQuitSeance()">← Retour</button>
        <div class="seance-title">${esc(s.nom)}</div>
        <div class="pts-live">${s.totalPts} pts</div>
      </div>
      <div class="seance-progress">
        <div class="seance-progress-bar" style="width:${(progress / s.exos.length) * 100}%"></div>
      </div>
      <div class="seance-progress-text">${progress}/${s.exos.length} exercices</div>
    </div>
    <div class="section-title">${esc(exo.nom)} — Combien de séries ?</div>
    <div class="serie-choice-card">
      <div class="serie-choice-grid">
        ${options.map(n => `<button class="serie-choice-btn" onclick="chooseSeries(${n})">${n}</button>`).join('')}
      </div>
      <button class="skip-btn" onclick="skipExo()">Passer cet exercice</button>
    </div>`;
  saveSeanceToLocal();
}

function chooseSeries(n) {
  activeSeance.exos[activeSeance.currentExo].series = n;
  activeSeance.exos[activeSeance.currentExo].needsChoice = false;
  activeSeance.choosingSeries = false;
  activeSeance.currentSerie = 0;
  renderActiveSeance();
}

function renderActiveSeance() {
  const area = document.getElementById('seance-content');
  const s = activeSeance;
  const exo = s.exos[s.currentExo];
  const progress = s.exos.filter(e => e.done || e.skipped).length;
  const exoData = getExercise(exo.nom);
  const isCardio = exoData && exoData.type === 'cardio';
  const isPdC = exoData && exoData.type === 'poids_de_corps';

  const isHaltere = exo.nom.includes('(haltère)');
  let poidsLabel = 'Poids (kg)';
  let poidsPlaceholder = '60';
  if (isPdC) { poidsLabel = 'Poids en + (kg)'; poidsPlaceholder = '0'; }
  else if (isHaltere) { poidsLabel = 'Poids 1 haltère (kg)'; poidsPlaceholder = '16'; }

  const inputHtml = isCardio ? `
    <div class="sets-grid sets-grid-3">
      <div class="set-field"><label>Durée (min)</label><input type="number" id="inp-duree" placeholder="20" min="1" max="120"></div>
      <div class="set-field"><label>Vitesse (km/h)</label><input type="number" id="inp-vitesse" placeholder="8" min="1" max="25" step="0.5"></div>
      <div class="set-field"><label>Inclinaison (%)</label><input type="number" id="inp-inclinaison" placeholder="2" min="0" max="15"></div>
    </div>` : `
    <div class="sets-grid">
      <div class="set-field"><label>${poidsLabel}</label><input type="number" id="inp-poids" placeholder="${poidsPlaceholder}" min="0" max="500"></div>
      <div class="set-field"><label>Reps</label><input type="number" id="inp-reps" placeholder="10" min="1" max="100"></div>
    </div>`;

  area.innerHTML = `
    <div class="seance-header">
      <div class="seance-title-row">
        <button class="btn-back" onclick="confirmQuitSeance()">← Retour</button>
        <div class="seance-title">${esc(s.nom)}</div>
        <div class="pts-live">${s.totalPts} pts</div>
      </div>
      <div class="seance-progress">
        <div class="seance-progress-bar" style="width:${(progress / s.exos.length) * 100}%"></div>
      </div>
      <div class="seance-progress-text">${progress}/${s.exos.length} exercices</div>
    </div>
    <div class="section-title">${esc(exo.nom)}${exo.varianteChoisie && exo.varianteChoisie !== 'défaut' ? ' <span class="variante-badge">' + esc(exo.varianteChoisie) + '</span>' : ''}${isCardio ? '' : ' — Série ' + (s.currentSerie + 1) + '/' + exo.series}</div>
    <div class="serie-input-card">
      ${inputHtml}
      <button class="add-exo-btn" onclick="${isCardio ? 'validerCardio()' : 'validerSerie()'}">Valider${isCardio ? '' : ' la série'}</button>
      <button class="skip-btn" onclick="skipExo()">Passer cet exercice</button>
    </div>
    <div class="section-title">Résumé <span style="font-size:11px;color:var(--muted2)">(clique pour changer d'exo)</span></div>
    <div class="exo-list">
      ${s.exos.map((e, i) => {
        const eData = getExercise(e.nom);
        const eIsCardio = eData && eData.type === 'cardio';
        if (e.skipped) return `<div class="exo-item exo-skipped exo-done-clickable" onclick="switchToExo(${i})"><div class="exo-item-icon">⏭️</div><div class="exo-item-info"><div class="exo-item-name">${esc(e.nom)}</div><div class="exo-item-detail">Passé</div></div><div class="exo-item-edit">✏️</div></div>`;
        if (e.done) {
          const pts = e.series_data.reduce((a, sd) => a + sd.pts, 0);
          const varTag = e.varianteChoisie && e.varianteChoisie !== 'défaut' ? `<span class="variante-tag">${esc(e.varianteChoisie)}</span> ` : '';
          const detail = eIsCardio
            ? e.series_data.map(sd => sd.duree + 'min').join(', ')
            : varTag + e.series_data.map(sd => sd.poids + 'kg×' + sd.reps).join(', ');
          return `<div class="exo-item exo-done-clickable" onclick="switchToExo(${i})"><div class="exo-item-icon">✅</div><div class="exo-item-info"><div class="exo-item-name">${esc(e.nom)}</div><div class="exo-item-detail">${detail}</div></div><div class="exo-item-pts">+${pts}</div><div class="exo-item-edit">✏️</div></div>`;
        }
        if (i === s.currentExo && e.series_data.length > 0) {
          const varTag = e.varianteChoisie && e.varianteChoisie !== 'défaut' ? `<span class="variante-tag">${esc(e.varianteChoisie)}</span> ` : '';
          const detail = eIsCardio
            ? e.series_data.map(sd => sd.duree + 'min').join(', ')
            : varTag + e.series_data.map(sd => sd.poids + 'kg×' + sd.reps).join(', ');
          return `<div class="exo-item exo-current"><div class="exo-item-icon">💪</div><div class="exo-item-info"><div class="exo-item-name">${esc(e.nom)}</div><div class="exo-item-detail">${detail}</div></div></div>`;
        }
        if (i === s.currentExo) {
          return `<div class="exo-item exo-current"><div class="exo-item-icon">💪</div><div class="exo-item-info"><div class="exo-item-name">${esc(e.nom)}</div><div class="exo-item-detail">En cours...</div></div></div>`;
        }
        return `<div class="exo-item exo-pending exo-done-clickable" onclick="switchToExo(${i})"><div class="exo-item-icon">⏳</div><div class="exo-item-info"><div class="exo-item-name">${esc(e.nom)}</div><div class="exo-item-detail">${eIsCardio ? 'Cardio' : e.series + ' séries'}</div></div></div>`;
      }).join('')}
    </div>`;
  saveSeanceToLocal();
}

async function validerSerie() {
  const reps  = Math.min(Math.max(parseInt(document.getElementById('inp-reps').value) || 0, 0), 100);
  const poids = Math.min(Math.max(parseFloat(document.getElementById('inp-poids').value) || 0, 0), 500);
  if (!reps) { showToast('Entre ton nombre de reps', 'error'); return; }

  const exo = activeSeance.exos[activeSeance.currentExo];
  const pts = calcPoints(reps, poids, exo.nom, exo.varianteDiff);
  exo.series_data.push({ reps, poids, pts });
  activeSeance.totalPts += pts;
  activeSeance.currentSerie++;

  if (activeSeance.currentSerie >= exo.series) {
    exo.done = true;
    const maxPoids = Math.max(...exo.series_data.map(sd => sd.poids));
    if (maxPoids > 0) {
      const isPR = await checkPR(exo.nom, maxPoids);
      if (isPR) {
        // Persistance + points gérés côté serveur dans finir_seance (anti-triche).
        // Ici on met juste à jour l'affichage local.
        prData[exo.nom] = maxPoids;
        activeSeance.totalPts += 30;
        exo.prBroken = true;
        showToast(`🏆 Nouveau PR sur ${exo.nom} ! +30 pts`);
      }
    }
    advanceExo();
  } else {
    renderActiveSeance();
    showToast(`+${pts} pts`);
  }
}

async function validerCardio() {
  const duree = Math.min(Math.max(parseInt(document.getElementById('inp-duree').value) || 0, 0), 120);
  const vitesse = Math.min(Math.max(parseFloat(document.getElementById('inp-vitesse').value) || 0, 0), 25);
  const inclinaison = Math.min(Math.max(parseFloat(document.getElementById('inp-inclinaison').value) || 0, 0), 15);
  if (!duree || !vitesse) { showToast('Entre la durée et la vitesse', 'error'); return; }

  const exo = activeSeance.exos[activeSeance.currentExo];
  const pts = calcCardioPoints(duree, vitesse, inclinaison);
  exo.series_data.push({ duree, vitesse, inclinaison, pts });
  activeSeance.totalPts += pts;
  exo.done = true;
  showToast(`+${pts} pts cardio`);
  advanceExo();
}

function skipExo() {
  activeSeance.exos[activeSeance.currentExo].skipped = true;
  advanceExo();
}

function confirmQuitSeance() {
  if (confirm('Quitter la séance ? Ta progression sera sauvegardée, tu pourras reprendre.')) {
    saveSeanceToLocal();
    activeSeance = null;
    renderSeanceChoix();
  }
}

function switchToExo(index) {
  if (index === activeSeance.currentExo) return;
  const exo = activeSeance.exos[index];
  if (exo.done || exo.skipped) {
    reopenExo(index);
  } else {
    activeSeance.currentExo = index;
    activeSeance.currentSerie = 0;
    if (exo.needsChoice || (exo.seriesMin && exo.seriesMax && !exo.series)) {
      exo.needsChoice = true;
      exo.series = 0;
      checkSeriesChoice();
    } else {
      renderActiveSeance();
    }
  }
}

function saveSeanceToLocal() {
  if (!activeSeance || !currentUser) return;
  const key = 'activeSeance_' + currentUser.id;
  localStorage.setItem(key, JSON.stringify(activeSeance));
}

function loadSeanceFromLocal() {
  if (!currentUser) return null;
  const key = 'activeSeance_' + currentUser.id;
  const saved = localStorage.getItem(key);
  if (!saved) return null;
  try {
    const data = JSON.parse(saved);
    const savedDate = localStorage.getItem(key + '_date');
    const today = getTodayKey();
    if (savedDate && savedDate !== today) {
      localStorage.removeItem(key);
      localStorage.removeItem(key + '_date');
      return null;
    }
    return data;
  } catch (e) { return null; }
}

function clearSeanceLocal() {
  if (!currentUser) return;
  const key = 'activeSeance_' + currentUser.id;
  localStorage.removeItem(key);
  localStorage.removeItem(key + '_date');
}

function abandonSavedSeance() {
  if (!confirm('Abandonner cette séance ? Toute ta progression sera perdue.')) return;
  clearSeanceLocal();
  activeSeance = null;
  renderSeanceChoix();
}

function resumeSavedSeance() {
  const saved = loadSeanceFromLocal();
  if (saved) {
    activeSeance = saved;
    prData = {};
    renderActiveSeance();
  }
}

function reopenExo(index) {
  const exo = activeSeance.exos[index];
  let oldPts = exo.series_data.reduce((a, sd) => a + sd.pts, 0);
  if (exo.prBroken) oldPts += 30;
  activeSeance.totalPts -= oldPts;
  exo.done = false;
  exo.skipped = false;
  exo.prBroken = false;
  exo.series_data = [];
  exo.varianteChoisie = null;
  exo.varianteDiff = null;
  activeSeance.currentExo = index;
  activeSeance.currentSerie = 0;
  activeSeance.choosingSeries = false;
  if (exo.needsChoice || (exo.seriesMin && exo.seriesMax)) {
    exo.needsChoice = true;
    exo.series = 0;
    checkSeriesChoice();
  } else {
    renderActiveSeance();
  }
}

function advanceExo() {
  const next = activeSeance.exos.findIndex((e, i) => i > activeSeance.currentExo && !e.done && !e.skipped);
  if (next === -1) {
    finishSeance();
  } else {
    activeSeance.currentExo = next;
    activeSeance.currentSerie = 0;
    checkSeriesChoice();
  }
}

async function checkPR(exo, poids) {
  if (!poids) return false;
  if (prData[exo] !== undefined) return poids > prData[exo];
  const { data } = await sb.from('pr').select('poids').eq('user_id', currentUser.id).eq('exercice', exo).single();
  prData[exo] = data?.poids || 0;
  return poids > prData[exo];
}

async function savePR(exo, poids) {
  prData[exo] = poids;
  await sb.from('pr_history').insert({ user_id: currentUser.id, exercice: exo, poids });
  await sb.from('pr').upsert({ user_id: currentUser.id, exercice: exo, poids, created_at: new Date().toISOString() }, { onConflict: 'user_id,exercice' });
}

async function finishSeance() {
  if (isFinishing) return;
  isFinishing = true;

  const s = activeSeance;
  // On n'envoie QUE les données brutes : le serveur recalcule les points (anti-triche)
  const payload = s.exos.filter(e => e.done).map(e => {
    const eData = getExercise(e.nom);
    const isCardio = eData && eData.type === 'cardio';
    if (isCardio) {
      const sd = e.series_data[0] || {};
      return { nom: e.nom, cardio: true, series: [{ duree: sd.duree || 0, vitesse: sd.vitesse || 0, incl: sd.inclinaison || 0 }] };
    }
    return {
      nom: e.nom,
      diff: (e.varianteDiff != null ? e.varianteDiff : null),
      cardio: false,
      series: e.series_data.map(sd => ({ reps: sd.reps, poids: sd.poids }))
    };
  });

  const { data: res, error: e1 } = await sb.rpc('finir_seance', { p_seance_nom: s.nom, p_exos: payload });
  if (e1) { showToast('Erreur : ' + e1.message, 'error'); isFinishing = false; return; }

  const total = res?.points || 0;
  // Cache PR local invalidé (le serveur a pu créer des PR)
  prData = {};

  activeSeance = null;
  clearSeanceLocal();
  todayCount++;
  todayDone = todayCount >= MAX_SEANCES_PER_DAY;
  showToast(`Séance terminée ! +${total.toLocaleString('fr-FR')} pts`);
  showScreen('classement');

  setTimeout(() => { isFinishing = false; }, 5000);
}

// ════════════════════════════════════
// HISTORIQUE (maintenant dans le profil)
// ════════════════════════════════════

async function loadHistorique() {
  const { data, error } = await sb.from('seances').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(30);
  const list = document.getElementById('histo-list');
  if (error) { showToast('Erreur de chargement', 'error'); return; }
  if (!data || data.length === 0) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>Aucune séance pour l\'instant.</p></div>';
    return;
  }
  list.innerHTML = data.map(s => {
    const exos = (s.exercices || []).map(e => `${esc(e.exo)} ${e.series}×${e.reps}`).join(', ');
    return `<div class="histo-item">
      <div class="histo-date">${formatDate(s.created_at)}</div>
      <div class="histo-exos">${exos || '—'}</div>
      <div class="histo-pts-row">
        <div class="histo-pts">+${(s.points || 0).toLocaleString('fr-FR')} pts</div>
        ${s.nb_pr > 0 ? `<div class="histo-pr">🏆 ${s.nb_pr} PR</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function loadHistoriqueForUser(userId) {
  const { data } = await sb.from('seances').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
  if (!data || data.length === 0) return '<div class="empty-state"><p>Aucune séance</p></div>';
  return data.map(s => {
    const exos = (s.exercices || []).map(e => `${esc(e.exo)} ${e.series}×${e.reps}`).join(', ');
    return `<div class="histo-item">
      <div class="histo-date">${formatDate(s.created_at)}</div>
      <div class="histo-exos">${exos || '—'}</div>
      <div class="histo-pts-row">
        <div class="histo-pts">+${(s.points || 0).toLocaleString('fr-FR')} pts</div>
        ${s.nb_pr > 0 ? `<div class="histo-pr">🏆 ${s.nb_pr} PR</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════
// STATISTIQUES (nouvel onglet)
// ════════════════════════════════════

let chartStatPR = null;
let chartStatPoids = null;
let timerInterval = null;
let timerRunning = false;
let timerMode = 'chrono'; // 'chrono' ou 'minuteur'
let minuteurTotal = 90;

// ── TIMER STATE (timestamp-based, survit au fond/extinction) ──
// timerStartTs  : Date.now() au moment du start (ou recalculé après pause)
// timerPausedAt : secondes affichées au moment de la pause
// timerSeconds  : valeur courante lue depuis getTimerSeconds()

let timerStartTs  = null; // timestamp ms
let timerPausedAt = 0;    // secondes (offset en pause)

function _saveTimerState() {
  localStorage.setItem('nfTimer', JSON.stringify({
    mode: timerMode,
    running: timerRunning,
    startTs: timerStartTs,
    pausedAt: timerPausedAt,
    minuteurTotal: minuteurTotal
  }));
}

function _loadTimerState() {
  try {
    const raw = localStorage.getItem('nfTimer');
    if (!raw) return;
    const s = JSON.parse(raw);
    timerMode       = s.mode        || 'chrono';
    timerRunning    = s.running     || false;
    timerStartTs    = s.startTs     || null;
    timerPausedAt   = s.pausedAt    || 0;
    minuteurTotal   = s.minuteurTotal || 90;
  } catch (e) {}
}

function getTimerSeconds() {
  if (!timerRunning || timerStartTs === null) return timerPausedAt;
  const elapsed = Math.floor((Date.now() - timerStartTs) / 1000);
  if (timerMode === 'chrono') return timerPausedAt + elapsed;
  const remaining = timerPausedAt - elapsed;
  return remaining < 0 ? 0 : remaining;
}

// Recalcule et affiche, gère la fin du minuteur
function _timerTick() {
  const secs = getTimerSeconds();
  updateTimerDisplay();
  if (timerMode === 'minuteur' && timerRunning && secs <= 0) {
    timerRunning = false;
    timerPausedAt = 0;
    timerStartTs  = null;
    clearInterval(timerInterval);
    timerInterval = null;
    _saveTimerState();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200, 100, 200]);
    playTimerAlert();
    showToast('Temps écoulé ! Go go go !');
    const display = document.getElementById('timer-display');
    if (display) { display.classList.add('timer-alert'); setTimeout(() => display.classList.remove('timer-alert'), 3000); }
    updateTimerDisplay();
  }
}

// Reprendre le bon état quand l'app revient au premier plan
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    _loadTimerState();
    if (timerRunning && !timerInterval) {
      timerInterval = setInterval(_timerTick, 250);
    }
    updateTimerDisplay();
    // Si minuteur déjà fini pendant absence
    if (timerMode === 'minuteur' && getTimerSeconds() <= 0 && timerRunning) {
      _timerTick();
    }
  } else {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    _saveTimerState();
  }
});

_loadTimerState();

function loadChrono() {
  const area = document.getElementById('chrono-content');
  const mins = Math.floor(minuteurTotal / 60);
  const secs = minuteurTotal % 60;
  area.innerHTML = `
    <div class="timer-card" id="timer-card">
      <div class="timer-toggle">
        <button class="toggle-btn ${timerMode === 'chrono' ? 'active' : ''}" onclick="setTimerMode('chrono')">Chrono</button>
        <button class="toggle-btn ${timerMode === 'minuteur' ? 'active' : ''}" onclick="setTimerMode('minuteur')">Minuteur</button>
      </div>
      <div class="timer-display" id="timer-display">${formatTimer(getTimerSeconds())}</div>
      ${timerMode === 'minuteur' ? `
        <div class="timer-custom">
          <div class="timer-custom-row">
            <div class="set-field timer-input-field">
              <label>Min</label>
              <input type="number" id="timer-custom-min" value="${mins}" min="0" max="59" onchange="setCustomMinuteur()">
            </div>
            <span class="timer-custom-sep">:</span>
            <div class="set-field timer-input-field">
              <label>Sec</label>
              <input type="number" id="timer-custom-sec" value="${secs}" min="0" max="59" onchange="setCustomMinuteur()">
            </div>
          </div>
        </div>` : ''}
      <div class="timer-controls">
        <button class="timer-btn start" onclick="toggleTimer()" id="timer-start-btn">${timerRunning ? 'Pause' : 'Start'}</button>
        <button class="timer-btn reset" onclick="resetTimer()">Reset</button>
      </div>
    </div>`;
}

function playTimerAlert() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    function beep(time) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.value = 0.3;
      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + 0.15);
    }
    beep(0);
    beep(0.25);
    beep(0.5);
  } catch (e) {}
}

function setCustomMinuteur() {
  const mins = parseInt(document.getElementById('timer-custom-min').value) || 0;
  const secs = parseInt(document.getElementById('timer-custom-sec').value) || 0;
  const total = mins * 60 + secs;
  if (total <= 0) return;
  minuteurTotal = total;
  timerPausedAt = total;
  timerStartTs  = null;
  timerRunning  = false;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  _saveTimerState();
  updateTimerDisplay();
}

async function loadStatistiques() {
  const area = document.getElementById('stats-content');

  const allExos = getAllExerciseNames().filter(n => {
    const e = getExercise(n);
    return e && e.type !== 'cardio';
  });

  area.innerHTML = `
    <div class="section-title">Évolution de tes PR</div>
    <div class="pr-search-card">
      <select class="admin-select" id="stat-pr-select" onchange="loadStatPRChart()">
        <option value="">-- Choisis un exercice --</option>
        ${allExos.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('')}
      </select>
      <div class="chart-card"><canvas id="chart-stat-pr" height="200"></canvas></div>
    </div>

    <div class="section-title">Progression estimée</div>
    <div class="pr-search-card">
      <select class="admin-select" id="stat-progression-select" onchange="loadProgressionEstimee()">
        <option value="">-- Choisis un exercice --</option>
        ${allExos.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('')}
      </select>
      <div id="progression-result"></div>
    </div>

    <div class="section-title">Objectifs personnels</div>
    <div id="objectifs-section">
      <div id="objectifs-list"></div>
      <button class="btn secondary" onclick="showAddObjectif()" style="margin-top:10px">+ Ajouter un objectif</button>
    </div>

    <div class="section-title">Progression des points</div>
    <div class="chart-card"><canvas id="chart-stat-points" height="180"></canvas></div>

    <div class="section-title">Volume par groupe musculaire</div>
    <div class="chart-card" style="max-width:250px;margin:0 auto"><canvas id="chart-stat-volume" height="250"></canvas></div>

    <div class="section-title">Tes records personnels</div>
    <div class="pr-list" id="stat-pr-list">
      <div class="empty-state"><p>Chargement...</p></div>
    </div>
    <div style="height:20px"></div>`;

  loadStatPointsChart();
  loadStatVolumeChart();
  loadStatPRList();
  loadObjectifs();
}

// ── TIMER ──

function formatTimer(seconds) {
  const s = Math.abs(Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function setTimerMode(mode) {
  timerMode = mode;
  resetTimer();
  loadChrono();
}

function setMinuteur(secs) {
  minuteurTotal = secs;
  timerRunning  = false;
  timerPausedAt = secs;
  timerStartTs  = null;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  _saveTimerState();
  updateTimerDisplay();
  loadChrono();
}

function toggleTimer() {
  if (timerRunning) {
    // Pause : figer la valeur actuelle
    timerPausedAt = getTimerSeconds();
    timerStartTs  = null;
    timerRunning  = false;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  } else {
    // Start : partir du pausedAt
    if (timerMode === 'minuteur' && timerPausedAt <= 0) timerPausedAt = minuteurTotal;
    timerStartTs = Date.now();
    timerRunning = true;
    timerInterval = setInterval(_timerTick, 250);
  }
  _saveTimerState();
  updateTimerDisplay();
}

function resetTimer() {
  timerRunning  = false;
  timerStartTs  = null;
  timerPausedAt = timerMode === 'minuteur' ? minuteurTotal : 0;
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  _saveTimerState();
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  const btn = document.getElementById('timer-start-btn');
  if (display) display.textContent = formatTimer(getTimerSeconds());
  if (btn) btn.textContent = timerRunning ? 'Pause' : 'Start';
}

// ── PROGRESSION ESTIMÉE ──

async function loadProgressionEstimee() {
  const exo = document.getElementById('stat-progression-select').value;
  const result = document.getElementById('progression-result');
  if (!exo || !result) return;

  const { data: seances } = await sb.from('seances').select('exercices, created_at')
    .eq('user_id', currentUser.id).order('created_at', { ascending: true });

  if (!seances || seances.length === 0) {
    result.innerHTML = '<div class="empty-state"><p>Pas assez de données</p></div>';
    return;
  }

  const points = [];
  seances.forEach(s => {
    (s.exercices || []).forEach(e => {
      if (e.exo === exo && e.poids > 0) {
        points.push({ date: new Date(s.created_at), poids: e.poids });
      }
    });
  });

  if (points.length < 3) {
    result.innerHTML = '<div class="empty-state"><p>Pas assez de données (min 3 séances avec cet exo)</p></div>';
    return;
  }

  const n = points.length;
  const yVals = points.map(p => p.poids);
  const current = yVals[n - 1];

  // Régression linéaire sur les indices de séance
  const xVals = points.map((_, i) => i);
  const sumX = xVals.reduce((a, b) => a + b, 0);
  const sumY = yVals.reduce((a, b) => a + b, 0);
  const sumXY = xVals.reduce((a, x, i) => a + x * yVals[i], 0);
  const sumX2 = xVals.reduce((a, x) => a + x * x, 0);
  const denom = n * sumX2 - sumX * sumX;
  const slope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const intercept = (sumY - slope * sumX) / n;

  // Fréquence réelle : séances par semaine basée sur les dates
  const firstDate = points[0].date;
  const lastDate = points[n - 1].date;
  const totalWeeks = Math.max((lastDate - firstDate) / (7 * 86400000), 1);
  const sessionsPerWeek = Math.max(n / totalWeeks, 0.5);
  const sessions1Month  = Math.round(sessionsPerWeek * 4.33);
  const sessions3Months = Math.round(sessionsPerWeek * 13);

  const predicted1Month  = Math.max(0, Math.round((intercept + slope * (n + sessions1Month))  * 10) / 10);
  const predicted3Months = Math.max(0, Math.round((intercept + slope * (n + sessions3Months)) * 10) / 10);

  // Tendance : seuil relatif pour éviter les faux signaux
  const relSlope = current > 0 ? slope / current : 0;
  const trend = relSlope > 0.01 ? 'en hausse' : relSlope < -0.01 ? 'en baisse' : 'stable';
  const trendIcon = relSlope > 0.01 ? '📈' : relSlope < -0.01 ? '📉' : '➡️';
  const avgPerSession = Math.round(slope * 10) / 10;

  // Fiabilité : trop peu de points ou slope extrême → avertissement
  const isUnreliable = n < 5 || Math.abs(slope) > current * 0.15;
  const reliabilityNote = isUnreliable
    ? `<div class="progression-warning">⚠️ Estimation peu fiable — fais plus de séances pour affiner</div>`
    : '';

  result.innerHTML = `
    <div class="progression-card">
      <div class="progression-current">
        <span class="progression-label">Actuel</span>
        <span class="progression-val">${current} kg</span>
      </div>
      <div class="progression-trend">
        <span>${trendIcon} Tendance : ${trend}</span>
        <span class="progression-detail">${avgPerSession >= 0 ? '+' : ''}${avgPerSession} kg/séance · ${Math.round(sessionsPerWeek * 10) / 10}x/sem</span>
      </div>
      ${reliabilityNote}
      <div class="progression-predictions">
        <div class="progression-pred">
          <span class="progression-label">Dans 1 mois</span>
          <span class="progression-val">${isUnreliable ? '~' : ''}${predicted1Month} kg</span>
        </div>
        <div class="progression-pred">
          <span class="progression-label">Dans 3 mois</span>
          <span class="progression-val">${isUnreliable ? '~' : ''}${predicted3Months} kg</span>
        </div>
      </div>
      <div class="progression-note">Basé sur ${n} séances · ~${sessions1Month} séances/mois</div>
    </div>`;
}

// ── OBJECTIFS PERSONNELS ──

function getObjectifs() {
  const stored = localStorage.getItem('objectifs_' + currentUser.id);
  return stored ? JSON.parse(stored) : [];
}

function saveObjectifs(objectifs) {
  localStorage.setItem('objectifs_' + currentUser.id, JSON.stringify(objectifs));
}

async function loadObjectifs() {
  const list = document.getElementById('objectifs-list');
  if (!list) return;
  const objectifs = getObjectifs();
  if (objectifs.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding:12px"><p>Aucun objectif. Fixe-toi un challenge !</p></div>';
    return;
  }

  const { data: prs } = await sb.from('pr').select('exercice, poids').eq('user_id', currentUser.id);
  const prMap = {};
  (prs || []).forEach(p => { prMap[p.exercice] = p.poids; });

  list.innerHTML = objectifs.map((obj, i) => {
    const current = prMap[obj.exo] || 0;
    const pct = obj.target > 0 ? Math.min(100, Math.round(current / obj.target * 100)) : 0;
    const done = current >= obj.target;
    return `
    <div class="objectif-item ${done ? 'done' : ''}">
      <div class="objectif-header">
        <div class="objectif-name">${esc(obj.exo)}</div>
        <div class="objectif-delete" onclick="deleteObjectif(${i})">✕</div>
      </div>
      <div class="objectif-target">${current} / ${obj.target} kg ${done ? '✅' : ''}</div>
      ${obj.deadline ? `<div class="objectif-deadline">Avant le ${new Date(obj.deadline).toLocaleDateString('fr-FR')}</div>` : ''}
      <div class="objectif-bar"><div class="objectif-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');
}

function showAddObjectif() {
  const allExos = getAllExerciseNames().filter(n => {
    const e = getExercise(n);
    return e && e.type !== 'cardio';
  });
  const section = document.getElementById('objectifs-section');
  section.innerHTML = `
    <div class="objectif-form">
      <div class="field"><label>Exercice</label>
        <select class="admin-select" id="obj-exo">
          ${allExos.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>Objectif (kg)</label><input type="number" id="obj-target" placeholder="100" min="1"></div>
      <div class="field"><label>Date limite (optionnel)</label><input type="date" id="obj-deadline"></div>
      <button class="btn" onclick="saveNewObjectif()">Ajouter</button>
      <button class="btn secondary" onclick="loadStatistiques()">Annuler</button>
    </div>`;
}

function saveNewObjectif() {
  const exo = document.getElementById('obj-exo').value;
  const target = parseFloat(document.getElementById('obj-target').value);
  const deadline = document.getElementById('obj-deadline').value;
  if (!exo || !target) { showToast('Remplis l\'exercice et l\'objectif', 'error'); return; }
  const objectifs = getObjectifs();
  objectifs.push({ exo, target, deadline: deadline || null, createdAt: new Date().toISOString() });
  saveObjectifs(objectifs);
  showToast('Objectif ajouté !');
  loadStatistiques();
}

function deleteObjectif(index) {
  const objectifs = getObjectifs();
  objectifs.splice(index, 1);
  saveObjectifs(objectifs);
  loadObjectifs();
}

async function loadStatPRChart() {
  const exo = document.getElementById('stat-pr-select').value;
  const canvas = document.getElementById('chart-stat-pr');
  if (!exo || !canvas) return;

  const { data } = await sb.from('pr_history').select('poids, created_at')
    .eq('user_id', currentUser.id).eq('exercice', exo).order('created_at', { ascending: true });

  if (!data || data.length === 0) {
    if (chartStatPR) { chartStatPR.destroy(); chartStatPR = null; }
    return;
  }

  const labels = data.map(d => new Date(d.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
  const values = data.map(d => d.poids);

  if (chartStatPR) chartStatPR.destroy();
  const ac = getAccentColor(), ar = getAccentRgb();
  chartStatPR = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [{ label: exo, data: values, borderColor: ac, backgroundColor: `rgba(${ar},0.1)`, fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: ac }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#525252', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { ticks: { color: '#525252', font: { size: 10 }, callback: v => v + ' kg' }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
  });
}

async function loadStatPointsChart() {
  const { data } = await sb.from('seances').select('points, created_at')
    .eq('user_id', currentUser.id).order('created_at', { ascending: true }).limit(30);

  const canvas = document.getElementById('chart-stat-points');
  if (!canvas || !data || data.length === 0) return;

  const labels = data.map(s => new Date(s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
  let cumul = 0;
  const points = data.map(s => { cumul += s.points; return cumul; });

  const ac2 = getAccentColor(), ar2 = getAccentRgb();
  new Chart(canvas, {
    type: 'line',
    data: { labels, datasets: [{ data: points, borderColor: ac2, backgroundColor: `rgba(${ar2},0.1)`, fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: ac2 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#525252', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } }, y: { ticks: { color: '#525252', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
  });
}

async function loadStatVolumeChart() {
  const { data } = await sb.from('seances').select('exercices')
    .eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(20);

  const canvas = document.getElementById('chart-stat-volume');
  if (!canvas || !data || data.length === 0) return;

  const volumeByGroupe = {};
  data.forEach(s => {
    (s.exercices || []).forEach(e => {
      const exData = getExercise(e.exo);
      const groupe = exData ? exData.groupe : 'autre';
      volumeByGroupe[groupe] = (volumeByGroupe[groupe] || 0) + (e.series || 1);
    });
  });

  const labels = Object.keys(volumeByGroupe);
  const values = Object.values(volumeByGroupe);
  const colors = ['#4ade80','#f59e0b','#3b82f6','#ef4444','#a855f7','#ec4899','#14b8a6','#f97316'];

  new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }] },
    options: { responsive: true, plugins: { legend: { labels: { color: '#a3a3a3', font: { size: 11 } } } } }
  });
}

async function cleanOrphanPRs() {
  const { data: prs } = await sb.from('pr').select('exercice').eq('user_id', currentUser.id);
  if (!prs || prs.length === 0) return;
  const orphans = prs.map(p => p.exercice).filter(nom => !getExercise(nom));
  if (orphans.length === 0) return;
  await sb.from('pr').delete().eq('user_id', currentUser.id).in('exercice', orphans);
  await sb.from('pr_history').delete().eq('user_id', currentUser.id).in('exercice', orphans);
}

async function loadStatPRList() {
  await cleanOrphanPRs();
  const { data: prs } = await sb.from('pr').select('exercice, poids, created_at').eq('user_id', currentUser.id).order('exercice');
  const { data: history } = await sb.from('pr_history').select('exercice, poids, created_at').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  const list = document.getElementById('stat-pr-list');
  if (!prs || prs.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>Aucun PR pour l\'instant</p></div>';
    return;
  }
  const histoByExo = {};
  (history || []).forEach(h => {
    if (!histoByExo[h.exercice]) histoByExo[h.exercice] = [];
    histoByExo[h.exercice].push(h);
  });

  list.innerHTML = prs.map(pr => {
    const histo = histoByExo[pr.exercice] || [];
    const histoText = histo.length > 1
      ? histo.slice(0, 4).map(h => h.poids + 'kg').join(' → ')
      : 'Depuis le ' + formatDate(pr.created_at);
    return `
    <div class="pr-item">
      <div class="pr-item-icon">🏆</div>
      <div class="pr-item-info">
        <div class="pr-item-name">${esc(pr.exercice)}</div>
        <div class="pr-item-history">${histoText}</div>
      </div>
      <div class="pr-item-val">${pr.poids} kg</div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════
// PROFIL
// ════════════════════════════════════

const ADMIN_EMAIL = 'llblue.pro@protonmail.com';

function isAdmin() {
  return currentUser?.email === ADMIN_EMAIL;
}

async function loadProfil() {
  const { data, error } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  if (error || !data) { showToast('Erreur chargement profil', 'error'); return; }
  const color = getCouleur(currentUser.id);
  const av = document.getElementById('profil-avatar');
  // Priorité : DB (source de vérité) > cache local
  const dbUrl = getAvatarSrc(data.avatar_url);
  const localUrl = getAvatarSrc(localStorage.getItem('pdp_' + currentUser.id));
  const src = dbUrl || localUrl;
  if (src) localStorage.setItem('pdp_' + currentUser.id, src);
  renderAvatarEl(av, src, data.pseudo, color);
  document.getElementById('profil-name').textContent   = data.pseudo;
  document.getElementById('profil-email').textContent  = data.email || currentUser.email;
  document.getElementById('stat-seances').textContent  = data.nb_seances || 0;
  document.getElementById('stat-pts-total').textContent = (data.points_total || 0).toLocaleString('fr-FR');
  document.getElementById('stat-pr').textContent       = data.nb_pr || 0;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { count } = await sb.from('seances').select('*', { count: 'exact', head: true }).eq('user_id', currentUser.id).gte('created_at', monthStart);
  document.getElementById('stat-streak').textContent = count || 0;
  document.getElementById('admin-btn').style.display = isAdmin() ? '' : 'none';
  loadProfilCustomSeances();
}

// ════════════════════════════════════
// PARAMÈTRES
// ════════════════════════════════════

function renderSettings() {
  const area = document.getElementById('settings-content');
  const currentColor = localStorage.getItem('colorTheme') || 'vert';
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';

  area.innerHTML = `
    <div class="section-title">Mode</div>
    <div class="theme-toggle-card">
      <span class="theme-label">Mode sombre</span>
      <div class="theme-switch ${isDark ? 'active' : ''}" id="theme-switch" onclick="toggleTheme(); renderSettings();">
        <div class="theme-switch-knob"></div>
      </div>
    </div>

    <div class="section-title">Couleur du thème</div>
    <div class="color-grid" id="settings-colors">
      ${Object.entries(THEMES).map(([name, t]) => `
        <div class="color-option ${name === currentColor ? 'active' : ''}" onclick="setColorTheme('${name}')" style="--color: ${t.accent}">
          <div class="color-swatch" style="background:${t.accent}"></div>
          <span class="color-name">${name.charAt(0).toUpperCase() + name.slice(1)}</span>
        </div>
      `).join('')}
    </div>

    <div class="section-title">Compte</div>
    <div class="settings-list">
      <div class="settings-item" onclick="promptChangePseudo()">
        <span>Changer de pseudo</span>
        <span class="settings-arrow">›</span>
      </div>
      <div class="settings-item" onclick="promptChangePassword()">
        <span>Changer de mot de passe</span>
        <span class="settings-arrow">›</span>
      </div>
    </div>

    <div class="section-title">Communauté</div>
    <div class="community-list">
      <div class="community-item" onclick="window.open('https://discord.gg/evay3xKrFF','_blank')">
        <span class="community-item-icon">💬</span>
        <div class="community-item-info">
          <div class="community-item-label">Discord officiel</div>
          <div class="community-item-sub">Rejoins le serveur</div>
        </div>
        <span class="community-item-arrow">›</span>
      </div>
      <div class="community-item" onclick="window.open('https://t.me/next_form_project','_blank')">
        <span class="community-item-icon">✈️</span>
        <div class="community-item-info">
          <div class="community-item-label">Telegram officiel</div>
          <div class="community-item-sub">Suis les actualités</div>
        </div>
        <span class="community-item-arrow">›</span>
      </div>
    </div>

    <button class="btn secondary" onclick="handleLogout()" style="margin-top:24px">Se déconnecter</button>
    <button class="btn admin-btn" id="admin-btn-settings" style="display:${isAdmin() ? '' : 'none'};margin-top:12px" onclick="showScreen('admin')">Panel Admin</button>
    <div style="height:20px"></div>`;
}

async function loadProfilCustomSeances() {
  const { data } = await sb.from('custom_seances').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  const container = document.getElementById('profil-custom-seances');
  if (!container) return;
  if (!data || data.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:12px"><p>Aucune séance personnalisée</p></div>';
    return;
  }
  container.innerHTML = data.map(cs => {
    const exos = JSON.parse(cs.exercices || '[]');
    return `<div class="pr-item clickable" onclick="openSeanceSheet(${cs.id})">
      <div class="pr-item-icon">📋</div>
      <div class="pr-item-info">
        <div class="pr-item-name">${esc(cs.nom)}</div>
        <div class="pr-item-history">${exos.length} exercice${exos.length > 1 ? 's' : ''}</div>
      </div>
      <div style="color:var(--muted2);font-size:18px;margin-left:auto">›</div>
    </div>`;
  }).join('');
}

async function openSeanceSheet(id) {
  const { data } = await sb.from('custom_seances').select('*').eq('id', id).single();
  if (!data) return;
  const exos = JSON.parse(data.exercices || '[]');
  document.getElementById('seance-sheet-title').textContent = data.nom;
  document.getElementById('seance-sheet-body').innerHTML = exos.length === 0
    ? '<div class="empty-state"><p>Aucun exercice</p></div>'
    : exos.map((e, i) => {
        const series = e.series ? `${e.series} séries` : (e.seriesMin ? `${e.seriesMin}–${e.seriesMax} séries` : '');
        return `<div class="sheet-exo-item">
          <div class="sheet-exo-num">${i + 1}</div>
          <div>
            <div class="sheet-exo-name">${esc(e.nom)}</div>
            ${series ? `<div class="sheet-exo-detail">${series}</div>` : ''}
          </div>
        </div>`;
      }).join('');
  const sheet = document.getElementById('seance-sheet');
  document.getElementById('seance-sheet-backdrop').classList.add('open');
  sheet.classList.add('open');

  // Swipe-down pour fermer
  let startY = 0;
  sheet.ontouchstart = e => { startY = e.touches[0].clientY; };
  sheet.ontouchmove  = e => { if (e.touches[0].clientY - startY > 60) closeSeanceSheet(); };
}

function closeSeanceSheet() {
  document.getElementById('seance-sheet-backdrop').classList.remove('open');
  document.getElementById('seance-sheet').classList.remove('open');
}

// Retourne l'URL utilisable (Storage http, ou base64 legacy), sinon null
function getAvatarSrc(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== 'string') return null;
  // Rejette tout caractère qui pourrait sortir de l'attribut src et injecter du HTML (XSS stocké)
  if (/["'<>`\s]/.test(avatarUrl)) return null;
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(avatarUrl)) return avatarUrl;
  return null;
}

function renderAvatarEl(el, avatarSrc, pseudo, color) {
  if (avatarSrc) {
    el.innerHTML = `<img src="${esc(avatarSrc)}" alt="pdp">`;
    el.style.background = 'none';
    el.style.color = '';
  } else {
    el.textContent = getInitials(pseudo);
    el.style.background = color + '22';
    el.style.color = color;
  }
}

function avatarHtml(avatarSrc, pseudo, color, extraClass) {
  const cls = 'profil-avatar' + (extraClass ? ' ' + extraClass : '');
  if (avatarSrc) return `<div class="${cls}" style="background:none"><img src="${esc(avatarSrc)}" alt=""></div>`;
  return `<div class="${cls}" style="background:${color}22;color:${color}">${esc(getInitials(pseudo))}</div>`;
}

async function handlePdpChange(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5000000) { showToast('Image trop lourde (max 5Mo)', 'error'); return; }

  showToast('Upload en cours…');

  // Redimensionner en 200×200 avant upload
  const dataUrl = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200; canvas.height = 200;
        const ctx = canvas.getContext('2d');
        const scale = Math.max(200 / img.width, 200 / img.height);
        ctx.drawImage(img, (200 - img.width * scale) / 2, (200 - img.height * scale) / 2, img.width * scale, img.height * scale);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  // Convertir dataUrl → Blob pour Supabase Storage
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const path = `${currentUser.id}.jpg`;

  const { error: uploadError } = await sb.storage.from('avatars').upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
    cacheControl: '3600'
  });

  if (uploadError) {
    // Fallback : sauvegarder le base64 directement (bucket pas créé)
    const { error: dbErr } = await sb.from('profiles').update({ avatar_url: dataUrl }).eq('id', currentUser.id);
    if (dbErr) { showToast('Erreur upload : ' + dbErr.message, 'error'); return; }
    localStorage.setItem('pdp_' + currentUser.id, dataUrl);
    renderAvatarEl(document.getElementById('profil-avatar'), dataUrl, null, null);
    showToast('Photo mise à jour !');
    return;
  }

  // Récupérer l'URL publique avec cache-bust
  const { data: urlData } = sb.storage.from('avatars').getPublicUrl(path);
  const publicUrl = urlData.publicUrl + '?t=' + Date.now();

  const { error: dbErr } = await sb.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUser.id);
  if (dbErr) { showToast('Erreur sauvegarde : ' + dbErr.message, 'error'); return; }

  // Mettre à jour le cache local avec l'URL (pas le base64)
  localStorage.setItem('pdp_' + currentUser.id, publicUrl);
  renderAvatarEl(document.getElementById('profil-avatar'), publicUrl, null, null);
  showToast('Photo de profil mise à jour !');
}

// ════════════════════════════════════
// PROFIL AUTRE JOUEUR
// ════════════════════════════════════

async function showUserProfil(userId) {
  if (userId === currentUser.id) { showScreen('profil'); return; }

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-user-profil').classList.add('active');
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));

  const content = document.getElementById('user-profil-content');
  content.innerHTML = '<div class="empty-state"><p>Chargement...</p></div>';

  const { data: profile } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (!profile) { content.innerHTML = '<div class="empty-state"><p>Joueur introuvable</p></div>'; return; }

  document.getElementById('user-profil-title').textContent = profile.pseudo;

  const color = getCouleur(userId);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { count } = await sb.from('seances').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', monthStart);
  const { data: prs } = await sb.from('pr').select('exercice, poids, created_at').eq('user_id', userId).order('exercice');
  const { data: prHistory } = await sb.from('pr_history').select('exercice, poids, created_at').eq('user_id', userId).order('created_at', { ascending: false });
  const { data: seances } = await sb.from('seances').select('points, created_at').eq('user_id', userId).order('created_at', { ascending: true }).limit(30);
  const { data: customSeances } = await sb.from('custom_seances').select('*').eq('user_id', userId);

  const histoByExo = {};
  (prHistory || []).forEach(h => {
    if (!histoByExo[h.exercice]) histoByExo[h.exercice] = [];
    histoByExo[h.exercice].push(h);
  });

  const userPdpSrc = getAvatarSrc(profile.avatar_url) || getAvatarSrc(localStorage.getItem('pdp_' + userId));
  const userAvatarHtml = avatarHtml(userPdpSrc, profile.pseudo, color);

  const histoHtml = await loadHistoriqueForUser(userId);
  const userStreakData = await calcStreak(userId);

  content.innerHTML = `
    <div class="profil-card">
      ${userAvatarHtml}
      <div class="profil-name">${esc(profile.pseudo)}</div>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-val">${profile.nb_seances || 0}</div><div class="stat-label">Séances total</div></div>
      <div class="stat-card"><div class="stat-val">${(profile.points_total || 0).toLocaleString('fr-FR')}</div><div class="stat-label">Points total</div></div>
      <div class="stat-card"><div class="stat-val">${profile.nb_pr || 0}</div><div class="stat-label">PR battus</div></div>
      <div class="stat-card"><div class="stat-val">${userStreakData.current}🔥</div><div class="stat-label">Streak actuelle</div></div>
      <div class="stat-card"><div class="stat-val">${userStreakData.best}</div><div class="stat-label">Meilleure streak</div></div>
      <div class="stat-card"><div class="stat-val">${count || 0}</div><div class="stat-label">Séances ce mois</div></div>
    </div>

    ${(customSeances && customSeances.length > 0) ? `
    <div class="section-title">Séances personnalisées</div>
    <div class="custom-seances-other">
      ${customSeances.map(cs => {
        const exos = JSON.parse(cs.exercices || '[]');
        const exosHtml = exos.map(e => {
          const exData = getExercise(e.nom);
          const grp = exData ? exData.groupe : '';
          return `<div class="custom-seance-exo-row"><span class="custom-seance-exo-name">${esc(e.nom)}</span><span class="custom-seance-exo-meta">${e.series || 3} séries · ${grp}</span></div>`;
        }).join('');
        return `<div class="custom-seance-expand-card" id="cs-card-${cs.id}">
          <div class="custom-seance-expand-header" onclick="toggleCustomSeanceDetail('${cs.id}')">
            <div class="pr-item-icon">📋</div>
            <div class="pr-item-info"><div class="pr-item-name">${esc(cs.nom)}</div><div class="pr-item-history">${exos.length} exercices</div></div>
            <div class="custom-seance-expand-actions">
              <div class="copy-seance-btn" onclick="event.stopPropagation();copyCustomSeance('${cs.id}')" title="Copier dans mes séances">＋</div>
              <div class="custom-seance-chevron" id="cs-chevron-${cs.id}">▾</div>
            </div>
          </div>
          <div class="custom-seance-exo-list" id="cs-detail-${cs.id}" style="display:none">
            ${exosHtml}
          </div>
        </div>`;
      }).join('')}
    </div>` : ''}

    <div class="section-title">Progression des points</div>
    <div class="chart-card"><canvas id="chart-user-points" height="180"></canvas></div>

    <div class="section-title">Historique des séances</div>
    <div class="histo-list">${histoHtml}</div>

    <div class="section-title">Records personnels</div>
    <div class="pr-list" id="user-pr-list">
      ${(!prs || prs.length === 0) ? '<div class="empty-state"><p>Aucun PR</p></div>' :
        prs.map(pr => {
          const histo = histoByExo[pr.exercice] || [];
          const histoText = histo.length > 1 ? histo.slice(0, 4).map(h => h.poids + 'kg').join(' → ') : 'Depuis le ' + formatDate(pr.created_at);
          return `<div class="pr-item"><div class="pr-item-icon">🏆</div><div class="pr-item-info"><div class="pr-item-name">${esc(pr.exercice)}</div><div class="pr-item-history">${histoText}</div></div><div class="pr-item-val">${pr.poids} kg</div></div>`;
        }).join('')}
    </div>
    <div style="height:80px"></div>`;

  if (seances && seances.length > 0) {
    const labels = seances.map(s => new Date(s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));
    let cumul = 0;
    const points = seances.map(s => { cumul += s.points; return cumul; });
    const canvas = document.getElementById('chart-user-points');
    if (canvas) {
      if (window._chartUserProfil) window._chartUserProfil.destroy();
      const ac3 = getAccentColor(), ar3 = getAccentRgb();
      window._chartUserProfil = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets: [{ data: points, borderColor: ac3, backgroundColor: `rgba(${ar3},0.1)`, fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: ac3 }] },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#525252', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } }, y: { ticks: { color: '#525252', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } } } }
      });
    }
  }
}

// ════════════════════════════════════
// THEME
// ════════════════════════════════════

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeSwitch();
}

function setColorTheme(color) {
  const theme = THEMES[color];
  if (!theme) return;
  document.documentElement.style.setProperty('--accent', theme.accent);
  document.documentElement.style.setProperty('--accent2', theme.accent2);
  document.documentElement.style.setProperty('--accent-rgb', theme.accentRgb);
  localStorage.setItem('colorTheme', color);
  if (document.getElementById('settings-colors')) renderSettings();
}

function updateThemeSwitch() {
  const sw = document.getElementById('theme-switch');
  if (!sw) return;
  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  sw.classList.toggle('active', isDark);
}

function loadTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  const color = localStorage.getItem('colorTheme') || 'vert';
  const theme = THEMES[color];
  if (theme) {
    document.documentElement.style.setProperty('--accent', theme.accent);
    document.documentElement.style.setProperty('--accent2', theme.accent2);
    document.documentElement.style.setProperty('--accent-rgb', theme.accentRgb);
  }
}

loadTheme();

// ════════════════════════════════════
// NUTRITION
// ════════════════════════════════════

const MEALS = ['Petit-dejeuner', 'Dejeuner', 'Gouter', 'Diner'];
const MEALS_DISPLAY = {'Petit-dejeuner': 'Petit-déjeuner', 'Dejeuner': 'Déjeuner', 'Gouter': 'Goûter', 'Diner': 'Dîner'};

let nutriProfile = null;
let nutriMeals = {};
let nutriEditingMeal = null;

function getNutriKey() {
  return new Date().toISOString().slice(0, 10);
}

function calcNutriTargets(profile) {
  if (!profile) return { cal: 2000, prot: 150, gluc: 250, lip: 65 };
  const { poids, taille, age, sexe, objectif, activite } = profile;
  let bmr;
  if (sexe === 'F') {
    bmr = 447.6 + (9.2 * poids) + (3.1 * taille) - (4.3 * age);
  } else {
    bmr = 88.4 + (13.4 * poids) + (4.8 * taille) - (5.7 * age);
  }
  const multAct = activite === 'sedentaire' ? 1.2 : activite === 'modere' ? 1.55 : 1.75;
  let tdee = Math.round(bmr * multAct);
  if (objectif === 'prise') tdee += 300;
  else if (objectif === 'seche') tdee -= 300;
  else if (objectif === 'perte') tdee -= 500;

  const protG = Math.round(poids * (objectif === 'prise' ? 2.2 : objectif === 'seche' ? 2.4 : 1.8));
  const lipG = Math.round(tdee * 0.25 / 9);
  const glucG = Math.round((tdee - (protG * 4) - (lipG * 9)) / 4);

  return { cal: tdee, prot: protG, gluc: Math.max(glucG, 50), lip: lipG };
}

function getMealTargets(targets) {
  return {
    'Petit-dejeuner': { cal: Math.round(targets.cal * 0.25), prot: Math.round(targets.prot * 0.25), gluc: Math.round(targets.gluc * 0.3), lip: Math.round(targets.lip * 0.25) },
    'Dejeuner': { cal: Math.round(targets.cal * 0.35), prot: Math.round(targets.prot * 0.35), gluc: Math.round(targets.gluc * 0.35), lip: Math.round(targets.lip * 0.35) },
    'Gouter': { cal: Math.round(targets.cal * 0.1), prot: Math.round(targets.prot * 0.1), gluc: Math.round(targets.gluc * 0.1), lip: Math.round(targets.lip * 0.1) },
    'Diner': { cal: Math.round(targets.cal * 0.3), prot: Math.round(targets.prot * 0.3), gluc: Math.round(targets.gluc * 0.25), lip: Math.round(targets.lip * 0.3) }
  };
}

async function loadNutrition() {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('nutri-date').textContent = today.charAt(0).toUpperCase() + today.slice(1);

  const { data: profileData } = await sb.from('profiles').select('nutri_profile').eq('id', currentUser.id).single();
  if (profileData?.nutri_profile) {
    nutriProfile = JSON.parse(profileData.nutri_profile);
    localStorage.setItem('nutri_profile_' + currentUser.id, profileData.nutri_profile);
  } else {
    const stored = localStorage.getItem('nutri_profile_' + currentUser.id);
    nutriProfile = stored ? JSON.parse(stored) : null;
  }

  const { data: mealsData } = await sb.from('nutrition_meals').select('meals').eq('user_id', currentUser.id).eq('date', getNutriKey()).single();
  if (mealsData?.meals) {
    nutriMeals = JSON.parse(mealsData.meals);
    localStorage.setItem('nutri_meals_' + currentUser.id + '_' + getNutriKey(), mealsData.meals);
  } else {
    const storedMeals = localStorage.getItem('nutri_meals_' + currentUser.id + '_' + getNutriKey());
    nutriMeals = storedMeals ? JSON.parse(storedMeals) : {};
  }

  if (!nutriProfile) {
    renderNutriSetup();
  } else {
    renderNutriDashboard();
  }
}

async function saveNutriProfile() {
  localStorage.setItem('nutri_profile_' + currentUser.id, JSON.stringify(nutriProfile));
  await sb.from('profiles').update({ nutri_profile: JSON.stringify(nutriProfile) }).eq('id', currentUser.id);
}

async function saveNutriMeals() {
  localStorage.setItem('nutri_meals_' + currentUser.id + '_' + getNutriKey(), JSON.stringify(nutriMeals));
  await sb.from('nutrition_meals').upsert({
    user_id: currentUser.id,
    date: getNutriKey(),
    meals: JSON.stringify(nutriMeals)
  }, { onConflict: 'user_id,date' });
}

function renderNutriSetup() {
  const area = document.getElementById('nutri-content');
  const existing = nutriProfile || {};
  nutriSetupObj = existing.objectif || null;
  nutriSetupAct = existing.activite || null;
  area.innerHTML = `
    <div class="nutri-setup">
      <div class="nutri-setup-title">Configure ta nutrition</div>
      <div class="nutri-setup-sub">On calcule tes besoins en fonction de tes objectifs</div>

      <div class="section-title">Ton objectif</div>
      <div class="nutri-obj-grid" id="nutri-obj-grid">
        <div class="nutri-obj-btn ${existing.objectif === 'prise' ? 'selected' : ''}" onclick="selectNutriObj('prise')">
          <div class="nutri-obj-icon">💪</div>
          <div class="nutri-obj-label">Prise de masse</div>
        </div>
        <div class="nutri-obj-btn ${existing.objectif === 'seche' ? 'selected' : ''}" onclick="selectNutriObj('seche')">
          <div class="nutri-obj-icon">🔥</div>
          <div class="nutri-obj-label">Sèche</div>
        </div>
        <div class="nutri-obj-btn ${existing.objectif === 'perte' ? 'selected' : ''}" onclick="selectNutriObj('perte')">
          <div class="nutri-obj-icon">⚖️</div>
          <div class="nutri-obj-label">Perte de poids</div>
        </div>
      </div>

      <div class="section-title">Niveau d'activité</div>
      <div class="nutri-obj-grid" id="nutri-act-grid">
        <div class="nutri-obj-btn ${existing.activite === 'sedentaire' ? 'selected' : ''}" onclick="selectNutriAct('sedentaire')">
          <div class="nutri-obj-icon">🪑</div>
          <div class="nutri-obj-label">Sédentaire</div>
        </div>
        <div class="nutri-obj-btn ${existing.activite === 'modere' ? 'selected' : ''}" onclick="selectNutriAct('modere')">
          <div class="nutri-obj-icon">🚶</div>
          <div class="nutri-obj-label">Modéré</div>
        </div>
        <div class="nutri-obj-btn ${existing.activite === 'intense' ? 'selected' : ''}" onclick="selectNutriAct('intense')">
          <div class="nutri-obj-icon">🏃</div>
          <div class="nutri-obj-label">Intense</div>
        </div>
      </div>

      <div class="section-title">Tes infos</div>
      <div class="field"><label>Sexe</label>
        <select class="admin-select" id="nutri-sexe">
          <option value="H" ${existing.sexe === 'H' ? 'selected' : ''}>Homme</option>
          <option value="F" ${existing.sexe === 'F' ? 'selected' : ''}>Femme</option>
        </select>
      </div>
      <div class="field"><label>Poids actuel (kg)</label><input type="number" id="nutri-poids" placeholder="75" value="${existing.poids || ''}" min="30" max="250"></div>
      <div class="field"><label>Poids objectif (kg)</label><input type="number" id="nutri-poids-obj" placeholder="80" value="${existing.poidsObj || ''}" min="30" max="250"></div>
      <div class="field"><label>Taille (cm)</label><input type="number" id="nutri-taille" placeholder="178" value="${existing.taille || ''}" min="100" max="250"></div>
      <div class="field"><label>Âge</label><input type="number" id="nutri-age" placeholder="22" value="${existing.age || ''}" min="14" max="80"></div>

      <button class="btn" onclick="saveNutriSetup()" style="margin-top:16px">Calculer mes besoins</button>
    </div>`;
}

let nutriSetupObj = null;
let nutriSetupAct = null;

function selectNutriObj(obj) {
  nutriSetupObj = obj;
  document.querySelectorAll('#nutri-obj-grid .nutri-obj-btn').forEach(b => b.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

function selectNutriAct(act) {
  nutriSetupAct = act;
  document.querySelectorAll('#nutri-act-grid .nutri-obj-btn').forEach(b => b.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
}

function saveNutriSetup() {
  const poids = parseFloat(document.getElementById('nutri-poids').value);
  const poidsObj = parseFloat(document.getElementById('nutri-poids-obj').value);
  const taille = parseFloat(document.getElementById('nutri-taille').value);
  const age = parseInt(document.getElementById('nutri-age').value);
  const sexe = document.getElementById('nutri-sexe').value;

  if (!nutriSetupObj) { showToast('Choisis un objectif', 'error'); return; }
  if (!nutriSetupAct) { showToast('Choisis ton niveau d\'activité', 'error'); return; }
  if (!poids || !taille || !age) { showToast('Remplis toutes tes infos', 'error'); return; }

  nutriProfile = { poids, poidsObj, taille, age, sexe, objectif: nutriSetupObj, activite: nutriSetupAct };
  saveNutriProfile();
  showToast('Profil nutrition sauvegardé !');
  renderNutriDashboard();
}

function renderNutriDashboard() {
  const area = document.getElementById('nutri-content');
  const targets = calcNutriTargets(nutriProfile);
  const mealTargets = getMealTargets(targets);

  let totalCal = 0, totalProt = 0, totalGluc = 0, totalLip = 0;
  MEALS.forEach(m => {
    (nutriMeals[m] || []).forEach(f => {
      totalCal += f.cal; totalProt += f.prot; totalGluc += f.gluc; totalLip += f.lip;
    });
  });

  const pctCal = Math.min(100, Math.round(totalCal / targets.cal * 100));
  const pctProt = Math.min(100, Math.round(totalProt / targets.prot * 100));
  const pctGluc = Math.min(100, Math.round(totalGluc / targets.gluc * 100));
  const pctLip = Math.min(100, Math.round(totalLip / targets.lip * 100));

  area.innerHTML = `
    <div class="nutri-summary">
      <div class="nutri-cals-row">
        <div class="nutri-cals-left">${totalCal} <span>/ ${targets.cal} kcal</span></div>
        <div class="nutri-cals-right">${pctCal}% de ton objectif</div>
      </div>
      <div class="nutri-bars">
        <div class="nutri-bar-row">
          <div class="nutri-bar-label">Protéines</div>
          <div class="nutri-bar-track"><div class="nutri-bar-fill prot" style="width:${pctProt}%"></div></div>
          <div class="nutri-bar-val">${totalProt}g / ${targets.prot}g</div>
        </div>
        <div class="nutri-bar-row">
          <div class="nutri-bar-label">Glucides</div>
          <div class="nutri-bar-track"><div class="nutri-bar-fill gluc" style="width:${pctGluc}%"></div></div>
          <div class="nutri-bar-val">${totalGluc}g / ${targets.gluc}g</div>
        </div>
        <div class="nutri-bar-row">
          <div class="nutri-bar-label">Lipides</div>
          <div class="nutri-bar-track"><div class="nutri-bar-fill lip" style="width:${pctLip}%"></div></div>
          <div class="nutri-bar-val">${totalLip}g / ${targets.lip}g</div>
        </div>
      </div>
    </div>

    <div class="section-title">Tes repas</div>
    <div class="nutri-meals">
      ${MEALS.map(meal => {
        const items = nutriMeals[meal] || [];
        const mCal = items.reduce((a, f) => a + f.cal, 0);
        const mTarget = mealTargets[meal];
        return `
        <div class="nutri-meal-card" onclick="openMeal('${meal}')">
          <div class="nutri-meal-header">
            <div class="nutri-meal-name">${MEALS_DISPLAY[meal]}</div>
            <div class="nutri-meal-cals">${mCal} / ${mTarget.cal} kcal</div>
          </div>
          ${items.length > 0
            ? `<div class="nutri-meal-items">${items.map(f => esc(f.nom) + ' — ' + f.cal + ' kcal').join('<br>')}</div>`
            : `<div class="nutri-meal-empty">Appuie pour ajouter un aliment</div>`}
        </div>`;
      }).join('')}
    </div>

    <div class="nutri-actions">
      <button class="btn secondary" onclick="renderNutriSetup()">Changer objectifs</button>
      <button class="btn secondary" onclick="renderNutriEditBody()">Modifier corps</button>
    </div>
    <div style="height:20px"></div>`;
}

function renderNutriEditBody() {
  const area = document.getElementById('nutri-content');
  area.innerHTML = `
    <div class="nutri-setup">
      <div class="nutri-setup-title">Modifier tes infos</div>
      <div class="nutri-setup-sub">Met à jour ton poids ou ta taille</div>
      <div class="field"><label>Poids actuel (kg)</label><input type="number" id="nutri-edit-poids" value="${nutriProfile.poids}" min="30" max="250"></div>
      <div class="field"><label>Taille (cm)</label><input type="number" id="nutri-edit-taille" value="${nutriProfile.taille}" min="100" max="250"></div>
      <div class="field"><label>Âge</label><input type="number" id="nutri-edit-age" value="${nutriProfile.age}" min="14" max="80"></div>
      <div class="field"><label>Poids objectif (kg)</label><input type="number" id="nutri-edit-poids-obj" value="${nutriProfile.poidsObj || ''}" min="30" max="250"></div>
      <button class="btn" onclick="saveNutriEditBody()">Sauvegarder</button>
      <button class="btn secondary" onclick="renderNutriDashboard()" style="margin-top:8px">Annuler</button>
    </div>`;
}

function saveNutriEditBody() {
  const poids = parseFloat(document.getElementById('nutri-edit-poids').value);
  const taille = parseFloat(document.getElementById('nutri-edit-taille').value);
  const age = parseInt(document.getElementById('nutri-edit-age').value);
  const poidsObj = parseFloat(document.getElementById('nutri-edit-poids-obj').value);
  if (!poids || !taille || !age) { showToast('Remplis tous les champs', 'error'); return; }
  nutriProfile.poids = poids;
  nutriProfile.taille = taille;
  nutriProfile.age = age;
  if (poidsObj) nutriProfile.poidsObj = poidsObj;
  saveNutriProfile();
  showToast('Infos mises à jour !');
  renderNutriDashboard();
}

function openMeal(meal) {
  nutriEditingMeal = meal;
  renderMealEditor();
}

function renderMealEditor() {
  const area = document.getElementById('nutri-content');
  const meal = nutriEditingMeal;
  const items = nutriMeals[meal] || [];
  const targets = calcNutriTargets(nutriProfile);
  const mealTarget = getMealTargets(targets)[meal];

  const mCal = items.reduce((a, f) => a + f.cal, 0);
  const mProt = items.reduce((a, f) => a + f.prot, 0);
  const mGluc = items.reduce((a, f) => a + f.gluc, 0);
  const mLip = items.reduce((a, f) => a + f.lip, 0);

  area.innerHTML = `
    <div class="nutri-summary" style="margin-top:16px">
      <div class="nutri-cals-row">
        <div class="nutri-cals-left">${mCal} <span>/ ${mealTarget.cal} kcal</span></div>
        <div class="nutri-cals-right">${MEALS_DISPLAY[meal]}</div>
      </div>
      <div class="nutri-bars">
        <div class="nutri-bar-row">
          <div class="nutri-bar-label">Prot</div>
          <div class="nutri-bar-track"><div class="nutri-bar-fill prot" style="width:${Math.min(100, Math.round(mProt / mealTarget.prot * 100))}%"></div></div>
          <div class="nutri-bar-val">${mProt}g / ${mealTarget.prot}g</div>
        </div>
        <div class="nutri-bar-row">
          <div class="nutri-bar-label">Gluc</div>
          <div class="nutri-bar-track"><div class="nutri-bar-fill gluc" style="width:${Math.min(100, Math.round(mGluc / mealTarget.gluc * 100))}%"></div></div>
          <div class="nutri-bar-val">${mGluc}g / ${mealTarget.gluc}g</div>
        </div>
        <div class="nutri-bar-row">
          <div class="nutri-bar-label">Lip</div>
          <div class="nutri-bar-track"><div class="nutri-bar-fill lip" style="width:${Math.min(100, Math.round(mLip / mealTarget.lip * 100))}%"></div></div>
          <div class="nutri-bar-val">${mLip}g / ${mealTarget.lip}g</div>
        </div>
      </div>
    </div>

    ${items.length > 0 ? `
      <div class="section-title">Aliments ajoutés</div>
      <div class="nutri-food-list">
        ${items.map((f, i) => `
          <div class="nutri-food-item">
            <div>
              <div class="nutri-food-name">${esc(f.nom)}</div>
              <div class="nutri-food-macros">${f.qty}${f.unit} · P${f.prot}g · G${f.gluc}g · L${f.lip}g</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="nutri-food-cals">${f.cal} kcal</div>
              <div style="cursor:pointer;opacity:0.5;font-size:16px" onclick="removeFoodItem(${i})">✕</div>
            </div>
          </div>`).join('')}
      </div>` : ''}

    <div class="section-title">Ajouter un aliment</div>
    <input class="nutri-search" id="nutri-food-search" type="text" placeholder="Rechercher un aliment..." oninput="filterFoods()">
    <div class="nutri-search-results" id="nutri-food-results">
      ${FOOD_DB.map((f, i) => `
        <div class="nutri-search-item" onclick="selectFood(${i})">
          <div>
            <div style="font-size:13px;font-weight:500">${esc(f.nom)}</div>
            <div style="font-size:11px;color:var(--muted2)">P${f.prot}g · G${f.gluc}g · L${f.lip}g</div>
          </div>
          <div style="font-size:13px;color:var(--accent);font-weight:600">${f.cal} kcal</div>
        </div>`).join('')}
    </div>

    <button class="btn secondary" onclick="renderNutriDashboard()">Retour</button>
    <div style="height:20px"></div>`;
}

function filterFoods() {
  const q = document.getElementById('nutri-food-search').value.toLowerCase();
  const results = document.getElementById('nutri-food-results');
  const filtered = FOOD_DB.filter(f => f.nom.toLowerCase().includes(q));
  results.innerHTML = filtered.map((f, i) => {
    const idx = FOOD_DB.indexOf(f);
    return `
      <div class="nutri-search-item" onclick="selectFood(${idx})">
        <div>
          <div style="font-size:13px;font-weight:500">${esc(f.nom)}</div>
          <div style="font-size:11px;color:var(--muted2)">P${f.prot}g · G${f.gluc}g · L${f.lip}g</div>
        </div>
        <div style="font-size:13px;color:var(--accent);font-weight:600">${f.cal} kcal</div>
      </div>`;
  }).join('');
}

function selectFood(idx) {
  const food = FOOD_DB[idx];
  const area = document.getElementById('nutri-content');
  area.innerHTML = `
    <div class="nutri-setup">
      <div class="nutri-qty-card">
        <div class="nutri-qty-name">${esc(food.nom)}</div>
        <div class="nutri-qty-macros">
          Pour ${food.portion}${food.unit} : ${food.cal} kcal · P${food.prot}g · G${food.gluc}g · L${food.lip}g
        </div>
        <div class="field"><label>Quantité (${food.unit})</label><input type="number" id="nutri-qty-input" value="${food.portion}" min="1" max="2000"></div>
        <div id="nutri-qty-preview" style="font-size:13px;color:var(--muted2);margin-top:8px"></div>
      </div>
      <button class="btn" onclick="confirmAddFood(${idx})">Ajouter au ${MEALS_DISPLAY[nutriEditingMeal]}</button>
      <button class="btn secondary" onclick="renderMealEditor()" style="margin-top:8px">Annuler</button>
    </div>`;

  const input = document.getElementById('nutri-qty-input');
  const updatePreview = () => {
    const qty = parseFloat(input.value) || 0;
    const ratio = qty / food.portion;
    const cal = Math.round(food.cal * ratio);
    const prot = Math.round(food.prot * ratio);
    const gluc = Math.round(food.gluc * ratio);
    const lip = Math.round(food.lip * ratio);
    document.getElementById('nutri-qty-preview').textContent = `= ${cal} kcal · P${prot}g · G${gluc}g · L${lip}g`;
  };
  input.addEventListener('input', updatePreview);
  updatePreview();
}

function confirmAddFood(idx) {
  const food = FOOD_DB[idx];
  const qty = parseFloat(document.getElementById('nutri-qty-input').value) || food.portion;
  const ratio = qty / food.portion;

  const item = {
    nom: food.nom,
    qty: qty,
    unit: food.unit,
    cal: Math.round(food.cal * ratio),
    prot: Math.round(food.prot * ratio),
    gluc: Math.round(food.gluc * ratio),
    lip: Math.round(food.lip * ratio)
  };

  if (!nutriMeals[nutriEditingMeal]) nutriMeals[nutriEditingMeal] = [];
  nutriMeals[nutriEditingMeal].push(item);
  saveNutriMeals();
  showToast('+' + item.cal + ' kcal ajoutées');
  renderMealEditor();
}

function removeFoodItem(idx) {
  nutriMeals[nutriEditingMeal].splice(idx, 1);
  saveNutriMeals();
  renderMealEditor();
}

// ════════════════════════════════════
// ADMIN
// ════════════════════════════════════

function getWeekBonusActual() {
  return customBonus || BONUS_EXOS[getWeekNumber() % BONUS_EXOS.length];
}

async function loadAdmin() {
  if (!isAdmin()) { showScreen('profil'); return; }

  const allExos = getAllExerciseNames();
  const bonusSelect = document.getElementById('admin-bonus-select');
  bonusSelect.innerHTML = '<option value="">-- Choisir l\'exo bonus --</option>' +
    allExos.map(e => `<option value="${esc(e)}" ${e === getWeekBonusActual() ? 'selected' : ''}>${esc(e)}</option>`).join('');

  document.getElementById('admin-bonus-series').value = bonusSeries || 4;
  document.getElementById('admin-bonus-text').value   = bonusText || '';

  const exoListHtml = allExos.map(e => `
    <label class="exo-select-item">
      <input type="checkbox" value="${esc(e)}">
      <span class="exo-select-name">${esc(e)}</span>
      <select class="exo-series-select" onclick="event.stopPropagation()">
        ${[1,2,3,4,5,6].map(n => `<option value="${n}" ${n === 3 ? 'selected' : ''}>${n}s</option>`).join('')}
      </select>
    </label>`).join('');

  document.getElementById('admin-bonus-exo-list').innerHTML = exoListHtml;
  document.getElementById('admin-univ-exo-list').innerHTML = exoListHtml;

  const { data: profiles } = await sb.from('profiles').select('id, pseudo, email');
  const userOptions = (profiles || []).map(p => `<option value="${p.id}">${esc(p.pseudo)} (${esc(p.email || '')})</option>`).join('');

  document.getElementById('admin-points-user-select').innerHTML = '<option value="">-- Choisir un joueur --</option>' + userOptions;
  document.getElementById('admin-user-select').innerHTML = '<option value="">-- Choisir un joueur --</option>' + userOptions;
  document.getElementById('admin-seance-select').innerHTML = '<option value="">-- Choisir un joueur --</option>' + userOptions;
}

async function adminSetBonusSeance() {
  if (!isAdmin()) return;
  const nom = document.getElementById('admin-bonus-seance-nom').value.trim();
  const pts = parseInt(document.getElementById('admin-bonus-seance-pts').value) || 100;
  if (!nom) { showToast('Donne un nom à la séance bonus', 'error'); return; }
  const checkboxes = document.querySelectorAll('#admin-bonus-exo-list input[type="checkbox"]:checked');
  const exos = Array.from(checkboxes).map(cb => {
    const sel = cb.parentElement.querySelector('.exo-series-select');
    return { nom: cb.value, series: sel ? parseInt(sel.value) || 3 : 3 };
  });
  if (exos.length === 0) { showToast('Choisis au moins un exercice', 'error'); return; }
  const bonusSeanceData = JSON.stringify({ nom, exos, pts });
  await sb.from('profiles').update({ bonus_seance_mois: bonusSeanceData }).eq('id', currentUser.id);
  showToast('Séance bonus du mois définie !');
}

async function adminCreateUniversalSeance() {
  if (!isAdmin()) return;
  const nom = document.getElementById('admin-univ-nom').value.trim();
  if (!nom) { showToast('Donne un nom à la séance', 'error'); return; }
  const checkboxes = document.querySelectorAll('#admin-univ-exo-list input[type="checkbox"]:checked');
  const exos = Array.from(checkboxes).map(cb => {
    const sel = cb.parentElement.querySelector('.exo-series-select');
    return { nom: cb.value, series: sel ? parseInt(sel.value) || 3 : 3 };
  });
  if (exos.length === 0) { showToast('Choisis au moins un exercice', 'error'); return; }

  const { data: count, error } = await sb.rpc('admin_create_universal_seance', { p_nom: nom, p_exos: JSON.stringify(exos) });
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast(`Séance "${nom}" créée pour ${count || 0} joueurs !`);
}

async function adminSetBonus() {
  if (!isAdmin()) return;
  const val    = document.getElementById('admin-bonus-select').value;
  const series = parseInt(document.getElementById('admin-bonus-series').value) || 4;
  const text   = document.getElementById('admin-bonus-text').value.trim();
  if (!val) { showToast('Choisis un exo', 'error'); return; }
  customBonus = val;
  bonusSeries = series;
  bonusText   = text;
  const bonusData = JSON.stringify({ exo: val, series: series, text: text });
  const { error } = await sb.from('profiles').update({ bonus_exo: bonusData }).eq('id', currentUser.id);
  if (error) { showToast('Erreur sauvegarde : ' + error.message, 'error'); return; }
  showToast('Exo bonus changé : ' + val);
}

async function adminResetPoints() {
  if (!isAdmin()) return;
  const userId = document.getElementById('admin-user-select').value;
  if (!userId) { showToast('Choisis un joueur', 'error'); return; }
  const { error: e1 } = await sb.rpc('admin_reset_points', { p_target: userId });
  if (e1) { showToast('Erreur : ' + e1.message, 'error'); return; }
  if (userId === currentUser.id) {
    todayDone = false;
    activeSeance = null;
  }
  showToast('Points remis à zéro !');
}

async function adminRemovePoints() {
  if (!isAdmin()) return;
  const userId = document.getElementById('admin-points-user-select').value;
  const amount = parseInt(document.getElementById('admin-points-amount').value);
  if (!userId) { showToast('Choisis un joueur', 'error'); return; }
  if (!amount || amount <= 0) { showToast('Entre un nombre de points valide', 'error'); return; }
  const { data: p } = await sb.from('profiles').select('points_total, pseudo').eq('id', userId).single();
  if (!p) { showToast('Joueur introuvable', 'error'); return; }
  if (!confirm(`Enlever ${amount} points à ${p.pseudo} ? (actuellement ${p.points_total || 0} pts)`)) return;
  const newTotal = Math.max(0, (p.points_total || 0) - amount);
  const { error } = await sb.rpc('admin_remove_points', { p_target: userId, p_amount: amount });
  if (error) { showToast('Erreur : ' + error.message, 'error'); return; }
  showToast(`${amount} points enlevés à ${p.pseudo} (${newTotal} pts restants)`);
}

async function adminLoadSeancesForUser() {
  if (!isAdmin()) return;
  const userId = document.getElementById('admin-seance-select').value;
  if (!userId) { showToast('Choisis un joueur', 'error'); return; }
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const { data: seances } = await sb.from('seances').select('id, seance_nom, points, nb_pr, created_at').eq('user_id', userId).gte('created_at', todayStart.toISOString()).order('created_at', { ascending: false });
  const container = document.getElementById('admin-seance-list');
  if (!seances || seances.length === 0) {
    container.innerHTML = '<p style="color:var(--muted);font-size:14px">Aucune séance aujourd\'hui</p>';
    return;
  }
  container.innerHTML = seances.map((s, i) => {
    const heure = new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    return `<div class="admin-seance-item" style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--card);border-radius:10px;margin-bottom:8px">
      <div>
        <strong>${esc(s.seance_nom || 'Séance ' + (i + 1))}</strong>
        <span style="color:var(--muted);font-size:13px;margin-left:8px">${heure} — ${s.points || 0} pts</span>
      </div>
      <button class="btn danger" style="padding:6px 12px;font-size:13px" onclick="adminDeleteSeance('${s.id}','${userId}',${s.points || 0},${s.nb_pr || 0})">Supprimer</button>
    </div>`;
  }).join('');
}

async function adminDeleteSeance(seanceId, userId, pts, prs) {
  if (!isAdmin()) return;
  if (!confirm('Supprimer cette séance ? Les points seront aussi enlevés du profil.')) return;
  const { error: delErr } = await sb.rpc('admin_delete_seance', { p_seance_id: seanceId });
  if (delErr) { showToast('Erreur suppression : ' + delErr.message, 'error'); return; }
  if (userId === currentUser.id) {
    todayDone = false;
    activeSeance = null;
  }
  showToast('Séance supprimée !');
  adminLoadSeancesForUser();
}

async function loadBonusSetting() {
  const { data } = await sb.from('profiles').select('bonus_exo').eq('email', ADMIN_EMAIL).single();
  if (data?.bonus_exo) {
    try {
      const parsed = JSON.parse(data.bonus_exo);
      customBonus = parsed.exo;
      bonusSeries = parsed.series || 4;
      bonusText   = parsed.text || '';
    } catch (e) {
      customBonus = data.bonus_exo;
    }
  }
}

// ════════════════════════════════════
// INIT
// ════════════════════════════════════

async function init() {
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('seance-date').textContent = today.charAt(0).toUpperCase() + today.slice(1);

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      const newPass = prompt('Entre ton nouveau mot de passe (min 6 caractères) :');
      if (newPass && newPass.length >= 6) {
        const { error } = await sb.auth.updateUser({ password: newPass });
        if (error) showToast('Erreur : ' + error.message, 'error');
        else showToast('Mot de passe changé avec succès !');
      }
    }
    if (session?.user) {
      currentUser = session.user;
      document.getElementById('loading').style.display = 'none';
      document.getElementById('tabbar').style.display  = 'flex';
      showScreen('classement');
      loadBonusSetting();
    } else {
      currentUser = null;
      document.getElementById('loading').style.display = 'none';
      document.getElementById('tabbar').style.display  = 'none';
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('screen-auth').classList.add('active');
    }
  });

  const { data: { session } } = await sb.auth.getSession();
  if (!session) document.getElementById('loading').style.display = 'none';
}

init();
