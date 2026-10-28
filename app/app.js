/* Cotiz — copilote du micro-entrepreneur.
   Toutes les données restent dans le navigateur (localStorage). Le seul appel réseau
   sert à vérifier la clé de licence Pro auprès de Lemon Squeezy. */
(() => {
  'use strict';

  const CFG = window.COTIZ_CONFIG || {};
  const R = window.COTIZ_RATES;
  const VERSION = '1.0.0';
  const STORE_KEY = 'cotiz:v1';
  const FREE_LIMIT = 20;
  const DAY = 864e5;
  const GRACE_MS = 14 * DAY;
  const LS_API = 'https://api.lemonsqueezy.com/v1/licenses/';
  const URSSAF_URL = 'https://www.autoentrepreneur.urssaf.fr/';
  const DEMO = new URLSearchParams(location.search).has('demo');
  // ?demo=1&clean=1 : démo sans bandeau, pour les captures d'écran des stores
  const CLEAN = DEMO && new URLSearchParams(location.search).has('clean');

  // ---------- Utilitaires
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  const EUR = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  const EUR0 = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const money = (n) => EUR.format(n || 0);
  const money0 = (n) => EUR0.format(Math.round(n || 0));
  const pct = (n) => `${(Math.round(n * 100) / 100).toLocaleString('fr-FR')} %`;
  const num = (v) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const round2 = (n) => Math.round(n * 100) / 100;
  const decimal = (n) => String(round2(n)).replace('.', ',');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const daysUntil = (s) => Math.round((parse(s) - parse(today())) / DAY);
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MONTHS_SHORT = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const dateFr = (s) => (s ? parse(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const dateLong = (s) => (s ? parse(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
  const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

  const ICON_PATHS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    calc: '<rect x="5" y="2.5" width="14" height="19" rx="2"/><path d="M8.5 6.5h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5h.01M8.5 18h.01M12 18h3.5"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    printer: '<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2"/><rect x="6" y="14" width="12" height="7"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    arrow: '<path d="M15 18l-6-6 6-6"/>',
  };
  const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;

  // ---------- Activités et paramètres
  const ACTIVITES = {
    vente: { label: 'Vente de marchandises', hint: 'E-commerce, revente, vente à emporter…', nature: 'vente', cfp: 'commercant', mixable: true },
    bic_com: { label: 'Prestations commerciales (BIC)', hint: 'VTC, livraison, conciergerie, location…', nature: 'service', cfp: 'commercant', mixable: true },
    bic_art: { label: 'Artisanat (BIC)', hint: 'Bâtiment, coiffure, réparation, esthétique…', nature: 'service', cfp: 'artisan', mixable: true },
    bnc: { label: 'Profession libérale (BNC)', hint: 'Développeur, graphiste, coach, consultant…', nature: 'service', cfp: 'liberal', mixable: false },
    cipav: { label: 'Libéral réglementé (CIPAV)', hint: 'Architecte, psychologue, ostéopathe…', nature: 'service', cfp: 'liberal', mixable: false },
  };
  const PAIEMENTS = ['Virement', 'Carte bancaire', 'Espèces', 'Chèque', 'PayPal / Stripe', 'Autre'];
  const STATUTS = {
    facture: { brouillon: 'Brouillon', envoyee: 'Envoyée', payee: 'Payée' },
    devis: { brouillon: 'Brouillon', envoyee: 'Envoyé', acceptee: 'Accepté', refusee: 'Refusé' },
  };
  const STATUT_BADGE = { brouillon: '', envoyee: 'brand', payee: 'ok', acceptee: 'ok', refusee: 'danger' };
  const PRO_FEATURES = [
    `Recettes illimitées (version gratuite : ${FREE_LIMIT})`,
    'Factures et devis conformes en PDF, numérotés automatiquement',
    'Livre des recettes exportable (CSV et PDF), obligatoire en cas de contrôle',
    'Simulateur : combien facturer pour atteindre ton objectif',
    'Barème URSSAF mis à jour chaque année',
  ];

  // ---------- État
  function defaultProfile() {
    return {
      activite: '', mixte: false, debut: '', periodicite: 'trimestre', vl: false, acre: false,
      nom: '', enseigne: '', adresse: '', siret: '', email: '', tel: '', iban: '', mentions: '',
    };
  }
  function defaultState() {
    return { v: 1, profile: defaultProfile(), recettes: [], factures: [], declarees: {}, license: null, createdAt: today() };
  }
  function normalize(s) {
    const out = Object.assign(defaultState(), s || {});
    out.profile = Object.assign(defaultProfile(), (s && s.profile) || {});
    for (const k of ['recettes', 'factures']) if (!Array.isArray(out[k])) out[k] = [];
    if (!out.declarees || typeof out.declarees !== 'object') out.declarees = {};
    return out;
  }
  function load() {
    if (DEMO) return demoState();
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* stockage indisponible : on démarre vide */ }
    return defaultState();
  }

  let persistAsked = false;
  function save() {
    if (DEMO) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('Impossible d’enregistrer : le stockage du navigateur est indisponible.');
      return;
    }
    if (!persistAsked && navigator.storage && navigator.storage.persist) {
      persistAsked = true;
      navigator.storage.persist().catch(() => {});
    }
  }

  function demoState() {
    const s = defaultState();
    Object.assign(s.profile, {
      activite: 'bnc', debut: '2025-03-03', periodicite: 'trimestre',
      nom: 'Léa Martin', enseigne: 'Studio Léa Martin', adresse: '12 rue des Lilas\n69003 Lyon',
      siret: '123 456 789 00012', email: 'contact@lea-martin.fr', tel: '06 12 34 56 78',
    });
    let seed = 11;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const pick = (arr) => arr[Math.floor(rand() * arr.length)];
    const clients = ['Studio Nova', 'Boulangerie Lemoine', 'Agence Pixel & Co', 'Mairie de Rives', 'Café Le Comptoir', 'Atelier Brune'];
    const libelles = ['Identité visuelle', 'Maquettes site web', 'Affiches événement', 'Logo + charte graphique', 'Retouches photos', 'Flyers & menus', 'Visuels réseaux sociaux'];
    const now = parse(today());
    for (let d = new Date(2025, 2, 1); d <= now; d.setMonth(d.getMonth() + 1)) {
      const n = 2 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        const date = iso(new Date(d.getFullYear(), d.getMonth(), 1 + Math.floor(rand() * 27)));
        const montant = Math.round((400 + rand() * 1400) / 10) * 10;
        const r = { id: uid(), date, client: pick(clients), libelle: pick(libelles), montant, nature: 'service', mode: pick(['Virement', 'Virement', 'Carte bancaire', 'PayPal / Stripe']), ref: '' };
        if (date <= today()) s.recettes.push(r);
      }
    }
    const y = now.getFullYear();
    const mk = (type, seq, daysAgo, client, lignes, statut) => ({
      id: uid(), type, numero: `${type === 'devis' ? 'D' : 'F'}-${y}-${pad3(seq)}`,
      date: addDays(today(), -daysAgo), echeance: addDays(today(), 30 - daysAgo),
      client, lignes, nature: 'service', statut, notes: '',
    });
    s.factures.push(
      mk('facture', 25, 0, { nom: 'Café Le Comptoir', adresse: '3 place Sathonay\n69001 Lyon', email: 'bonjour@lecomptoir.fr', siret: '' },
        [{ desc: 'Refonte de la carte (format A4, recto-verso)', qte: 1, pu: 350 }, { desc: 'Déclinaison ardoise', qte: 2, pu: 60 }], 'brouillon'),
      mk('facture', 24, 4, { nom: 'Agence Pixel & Co', adresse: '8 quai Saint-Antoine\n69002 Lyon', email: 'compta@pixel-co.fr', siret: '987 654 321 00034' },
        [{ desc: 'Maquettes site vitrine (5 pages)', qte: 1, pu: 1200 }, { desc: 'Déclinaisons mobile', qte: 5, pu: 80 }], 'envoyee'),
      mk('facture', 23, 15, { nom: 'Studio Nova', adresse: '41 cours Gambetta\n69007 Lyon', email: 'hello@studionova.fr', siret: '456 789 123 00021' },
        [{ desc: 'Identité visuelle complète', qte: 1, pu: 1800 }], 'payee'),
      mk('devis', 9, 6, { nom: 'Mairie de Rives', adresse: 'Place de la Libération\n38140 Rives', email: 'culture@mairie-rives.fr', siret: '' },
        [{ desc: 'Affiches « Marché de Noël » (3 formats)', qte: 3, pu: 220 }, { desc: 'Kit visuels réseaux sociaux', qte: 1, pu: 300 }], 'envoyee'),
    );
    // Toutes les périodes passées sont déclarées, sauf la dernière : la démo montre une échéance à venir.
    let p = prevPeriod(prevPeriod(periodOf(today(), 'trimestre')));
    while (p.end >= s.profile.debut) { s.declarees[p.key] = true; p = prevPeriod(p); }
    return s;
  }
  const pad3 = (n) => String(n).padStart(3, '0');

  let state = load();
  const P = () => state.profile;
  const act = () => ACTIVITES[P().activite] || ACTIVITES.bnc;

  // ---------- Calculs URSSAF
  function rateKey(nature) {
    if (nature === 'vente') return 'vente';
    const a = P().activite;
    return a === 'bnc' || a === 'cipav' ? a : 'bic';
  }
  const cfpRate = () => R.cfp[act().cfp];
  function naturesPossibles() {
    if (P().mixte && act().mixable) return ['vente', 'service'];
    return [act().nature];
  }
  function natureLabel(nature) {
    return {
      vente: 'Ventes de marchandises (BIC)',
      bic: 'Prestations de services (BIC)',
      bnc: 'Prestations de services (BNC)',
      cipav: 'Prestations libérales (BNC, CIPAV)',
    }[rateKey(nature)];
  }
  const natureShort = (nature) => (nature === 'vente' ? 'Vente' : 'Service');

  // ACRE : jusqu'à la fin du 3e trimestre civil qui suit celui du début d'activité.
  function acreInfo() {
    const p = P();
    if (!p.acre || !p.debut) return null;
    const d = parse(p.debut);
    const q = d.getFullYear() * 4 + Math.floor(d.getMonth() / 3) + 3;
    const fin = iso(new Date(Math.floor(q / 4), (q % 4) * 3 + 3, 0));
    const reduction = p.debut < R.acre.bascule ? R.acre.avant : R.acre.apres;
    return { debut: p.debut, fin, reduction };
  }
  const acreFactor = (date, info) => (info && date >= info.debut && date <= info.fin ? 1 - info.reduction / 100 : 1);

  function compute(recs) {
    const info = acreInfo();
    const cfp = cfpRate();
    const out = { ca: 0, parNature: { vente: 0, service: 0 }, social: 0, cfp: 0, vl: 0, total: 0, net: 0, count: recs.length, acre: false };
    for (const r of recs) {
      const m = num(r.montant);
      const k = rateKey(r.nature);
      const f = acreFactor(r.date, info);
      if (f < 1) out.acre = true;
      out.ca += m;
      out.parNature[r.nature === 'vente' ? 'vente' : 'service'] += m;
      out.social += (m * R.social[k] / 100) * f;
      out.cfp += m * cfp / 100;
      if (P().vl) out.vl += m * R.vl[k] / 100;
    }
    out.total = out.social + out.cfp + out.vl;
    out.net = out.ca - out.total;
    return out;
  }
  const effectiveRate = (nature) => {
    const k = rateKey(nature);
    return R.social[k] + cfpRate() + (P().vl ? R.vl[k] : 0);
  };
  const between = (start, end) => state.recettes.filter((r) => r.date >= start && r.date <= end);
  const yearRecs = (y) => between(`${y}-01-01`, `${y}-12-31`);

  // ---------- Périodes de déclaration
  function periodOf(dateStr, per = P().periodicite) {
    const d = parse(dateStr);
    const y = d.getFullYear();
    const m = d.getMonth();
    if (per === 'mois') {
      return {
        per, key: `${y}-${pad(m + 1)}`, label: `${cap(MONTHS[m])} ${y}`,
        start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)), deadline: iso(new Date(y, m + 2, 0)),
      };
    }
    const q = Math.floor(m / 3);
    const deadlines = [new Date(y, 3, 30), new Date(y, 6, 31), new Date(y, 9, 31), new Date(y + 1, 0, 31)];
    return {
      per, key: `${y}-T${q + 1}`, label: `${q + 1}${q ? 'e' : 'er'} trimestre ${y}`,
      start: iso(new Date(y, q * 3, 1)), end: iso(new Date(y, q * 3 + 3, 0)), deadline: iso(deadlines[q]),
    };
  }
  function prevPeriod(p) { return periodOf(addDays(p.start, -1), p.per); }
  const started = (p) => !P().debut || p.end >= P().debut;

  // Prochaine déclaration : la période précédente si elle n'est pas encore déclarée, sinon la période en cours.
  function nextDeclaration() {
    const cur = periodOf(today());
    const prev = prevPeriod(cur);
    if (started(prev) && !state.declarees[prev.key]) return prev;
    return cur;
  }
  function periodsBack(n) {
    const list = [];
    let p = periodOf(today());
    for (let i = 0; i < n && started(p); i++) { list.push(p); p = prevPeriod(p); }
    return list;
  }

  // ---------- Seuils (plafonds micro et franchise de TVA)
  function thresholds(y) {
    const c = compute(yearRecs(y));
    const p = P();
    let prorata = 1;
    if (p.debut && parse(p.debut).getFullYear() === y) {
      const daysInYear = Math.round((new Date(y + 1, 0, 1) - new Date(y, 0, 1)) / DAY);
      const days = Math.round((new Date(y + 1, 0, 1) - parse(p.debut)) / DAY);
      prorata = days / daysInYear;
    }
    const natures = naturesPossibles();
    const both = natures.length > 1;
    const items = [];
    if (natures.includes('vente')) items.push({ label: both ? 'Plafond micro (total)' : 'Plafond micro-entreprise', value: c.ca, max: R.plafonds.vente * prorata, prorata: prorata < 1 });
    if (natures.includes('service')) items.push({ label: both ? 'Plafond micro (services)' : 'Plafond micro-entreprise', value: c.parNature.service, max: R.plafonds.service * prorata, prorata: prorata < 1 });
    if (natures.includes('vente')) items.push({ label: both ? 'Franchise de TVA (total)' : 'Franchise de TVA', value: c.ca, max: R.tva.vente.base, majore: R.tva.vente.majore, tva: true });
    if (natures.includes('service')) items.push({ label: both ? 'Franchise de TVA (services)' : 'Franchise de TVA', value: c.parNature.service, max: R.tva.service.base, majore: R.tva.service.majore, tva: true });
    return items;
  }
  function meterHtml(t) {
    const ratio = t.max ? t.value / t.max : 0;
    const cls = ratio >= 1 ? 'danger' : ratio >= 0.8 ? 'warn' : '';
    let note;
    if (t.tva && t.value > t.majore) note = 'Seuil majoré dépassé : tu dois facturer la TVA dès maintenant. Contacte ton service des impôts.';
    else if (t.tva && t.value > t.max) note = `Seuil dépassé : TVA à facturer à partir du 1er janvier prochain, ou dès ${money0(t.majore)} de CA.`;
    else if (!t.tva && t.value > t.max) note = 'Plafond dépassé : deux années de suite et tu sors du régime micro.';
    else note = `Encore ${money0(t.max - t.value)} avant le seuil${t.prorata ? ' (calculé au prorata de ta 1re année)' : ''}.`;
    return `<div class="meter">
      <div class="meter-top"><strong>${esc(t.label)}</strong><span class="num">${money0(t.value)} / ${money0(t.max)}</span></div>
      <div class="bar"><i class="${cls}" style="width:${Math.min(100, ratio * 100).toFixed(1)}%"></i></div>
      <div class="muted small" style="margin-top:4px">${note}</div>
    </div>`;
  }

  // ---------- Licence Pro (Lemon Squeezy)
  function isPro() {
    if (DEMO) return true;
    const L = state.license;
    return !!(L && L.valid && Date.now() - L.checkedAt < GRACE_MS);
  }
  async function lsPost(action, params) {
    const res = await fetch(LS_API + action, { method: 'POST', headers: { Accept: 'application/json' }, body: new URLSearchParams(params) });
    let data = {};
    try { data = await res.json(); } catch (e) { /* réponse vide */ }
    return data;
  }
  function metaOk(meta) {
    if (!meta) return false;
    if (CFG.storeId && Number(meta.store_id) !== Number(CFG.storeId)) return false;
    if (CFG.productIds && CFG.productIds.length && !CFG.productIds.map(Number).includes(Number(meta.product_id))) return false;
    return true;
  }
  const deviceName = () => `Cotiz · ${navigator.userAgentData?.platform || navigator.platform || 'appareil'} · ${new Date().toLocaleDateString('fr-FR')}`;

  async function activateLicense(key) {
    const data = await lsPost('activate', { license_key: key, instance_name: deviceName() });
    if (!data.activated) throw new Error(data.error === 'license_key not found.' ? 'Clé introuvable. Vérifie qu’elle est complète.' : (data.error || 'Activation refusée.'));
    if (!metaOk(data.meta)) throw new Error('Cette clé ne correspond pas à Cotiz Pro.');
    const status = data.license_key && data.license_key.status;
    state.license = { key, instanceId: data.instance && data.instance.id, status, valid: status === 'active', checkedAt: Date.now() };
    save();
    if (status !== 'active') throw new Error('Cette clé n’est plus active (abonnement terminé ?).');
  }
  async function refreshLicense(force) {
    const L = state.license;
    if (DEMO || !L || !navigator.onLine) return;
    if (!force && Date.now() - L.checkedAt < DAY) return;
    try {
      const data = await lsPost('validate', { license_key: L.key, instance_id: L.instanceId || '' });
      if (!data.license_key && !data.error) return;
      L.status = data.license_key ? data.license_key.status : 'invalide';
      L.valid = !!data.valid && L.status === 'active' && metaOk(data.meta);
      L.checkedAt = Date.now();
      save();
      render();
      if (force) toast(L.valid ? 'Abonnement vérifié ✓' : 'Abonnement inactif.');
    } catch (e) {
      if (force) toast('Pas de connexion : nouvel essai plus tard.');
    }
  }
  async function deactivateLicense() {
    const L = state.license;
    if (!L) return;
    try { await lsPost('deactivate', { license_key: L.key, instance_id: L.instanceId || '' }); } catch (e) { /* hors ligne : on libère localement */ }
    state.license = null;
    save();
    render();
    toast('Licence retirée de cet appareil.');
  }
  function openCheckout() {
    if (!CFG.checkoutUrl) {
      toast('Le paiement n’est pas encore configuré.');
      return;
    }
    window.open(CFG.checkoutUrl, '_blank', 'noopener');
  }

  // ---------- Interface : outils
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 3000);
  }
  function openModal(html) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-back" data-act="modal-close-back"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const first = root.querySelector('input:not([type=hidden]), select, textarea');
    if (first) first.focus();
  }
  const closeModal = () => { $('#modal-root').innerHTML = ''; };
  const modalHead = (title) => `<div class="modal-head"><h2>${esc(title)}</h2><button class="btn icon ghost" data-act="modal-close" aria-label="Fermer">${icon('x')}</button></div>`;

  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`Copié : ${text}`);
    } catch (e) {
      toast('Copie impossible : sélectionne le montant à la main.');
    }
  }
  function printHtml(html, title) {
    $('#print-area').innerHTML = html;
    const previous = document.title;
    document.title = title;
    window.print();
    setTimeout(() => { document.title = previous; }, 800);
  }
  const csv = (rows) => '﻿' + rows.map((r) => r.map((v) => {
    const s = String(v ?? '');
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(';')).join('\r\n');

  // ---------- Gabarits communs
  const page = (inner) => `<div class="page">${DEMO && !CLEAN ? demoBanner() : ''}${inner}</div>`;
  const demoBanner = () => `<div class="demo-banner"><span><strong>Mode démo</strong> · données fictives, rien n’est enregistré.</span><a class="btn sm" href="./">Commencer avec mes données</a></div>`;
  const pageHead = (title, sub, actions = '') => `<div class="page-head"><div><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ''}</div>${actions ? `<div class="btn-row">${actions}</div>` : ''}</div>`;

  function upsellHtml(title = 'Passe à Cotiz Pro') {
    return `<div class="upsell">
      <div class="ico">${icon('star')}</div>
      <h2>${esc(title)}</h2>
      <ul>${PRO_FEATURES.map((f) => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul>
      <div class="price">2,99 € <small>/ mois</small></div>
      <p class="muted small">Sans engagement, résiliable en un clic.</p>
      <div class="btn-row" style="justify-content:center;margin-top:14px">
        <button class="btn" data-act="buy">${icon('sparkle')} Passer Pro</button>
        <a class="btn ghost" href="#/reglages/abonnement" data-act="modal-close-link">J’ai déjà une clé</a>
      </div>
    </div>`;
  }
  function proGate(inner, title) {
    if (isPro()) return inner;
    return `<div class="locked"><div class="blur" inert aria-hidden="true">${inner}</div>
      <div class="lock-over"><div class="card">${upsellHtml(title)}</div></div></div>`;
  }

  // ---------- Navigation
  const NAV = [
    { id: 'dashboard', label: 'Accueil', icon: 'home' },
    { id: 'recettes', label: 'Recettes', icon: 'list' },
    { id: 'factures', label: 'Factures', icon: 'file', pro: true },
    { id: 'declaration', label: 'Déclarer', icon: 'calendar' },
    { id: 'simulateur', label: 'Simulateur', icon: 'calc', pro: true },
    { id: 'reglages', label: 'Réglages', icon: 'sliders' },
  ];
  function renderNav(current) {
    const active = current === 'facture' ? 'factures' : current;
    const pro = isPro();
    $('#nav-side').innerHTML = NAV.map((n) => `<a class="navlink ${n.id === active ? 'active' : ''}" href="#/${n.id}">${icon(n.icon)}<span>${n.label}</span>${n.pro && !pro ? '<span class="pro-tag">PRO</span>' : ''}</a>`).join('');
    $('#nav-bottom').innerHTML = NAV.map((n) => `<a class="${n.id === active ? 'active' : ''}" href="#/${n.id}">${icon(n.icon)}<span>${n.label}</span></a>`).join('');
    $('#side-plan').innerHTML = pro
      ? `<div class="plan-card"><strong>${DEMO && !CLEAN ? 'Mode démo' : 'Cotiz Pro ✓'}</strong><span class="muted">${DEMO && !CLEAN ? 'Toutes les fonctions sont débloquées.' : 'Merci pour ton soutien !'}</span></div>`
      : `<div class="plan-card"><strong>Version gratuite</strong><span class="muted">${state.recettes.length}/${FREE_LIMIT} recettes utilisées</span><button class="btn sm block" data-act="upsell">${icon('star')} Passer Pro</button></div>`;
  }

  // ---------- Vue : bienvenue
  function viewOnboarding() {
    const p = P();
    return `<div class="onboard page">
      <div class="logo"><img src="../icons/icon.svg" width="36" height="36" alt=""> Cotiz</div>
      <div class="card">
        <h1>Bienvenue 👋</h1>
        <p class="muted" style="margin-top:6px">Trois questions, et Cotiz calcule tes cotisations, tes échéances et ce qu’il te reste vraiment. Tes données restent sur cet appareil : aucun compte à créer.</p>
        <form data-form="onboarding" style="margin-top:22px;display:flex;flex-direction:column;gap:22px">
          <div>
            <h3 style="margin-bottom:10px">1. Ton activité principale</h3>
            <div class="choices">${Object.entries(ACTIVITES).map(([k, a]) => `
              <label class="choice"><input type="radio" name="activite" value="${k}" ${(p.activite || 'bnc') === k ? 'checked' : ''}>
              <div><strong>${a.label}</strong><small>${a.hint}</small></div></label>`).join('')}
            </div>
            <label class="check" style="margin-top:12px"><input type="checkbox" name="mixte">
              <span>Activité mixte (ventes + prestations BIC)<small>Coche si tu vends des produits ET des services commerciaux ou artisanaux.</small></span></label>
          </div>
          <div class="form-grid">
            <label class="field">2. Date de début d’activité<input type="date" name="debut" value="${esc(p.debut)}" max="${today()}" required></label>
            <label class="field">3. Tu déclares ton chiffre d’affaires…
              <select name="periodicite"><option value="trimestre">chaque trimestre</option><option value="mois">chaque mois</option></select></label>
          </div>
          <div style="display:flex;flex-direction:column;gap:12px">
            <label class="check"><input type="checkbox" name="acre"><span>J’ai obtenu l’ACRE<small>Cotisations réduites pendant ta première année.</small></span></label>
            <label class="check"><input type="checkbox" name="vl"><span>J’ai choisi le versement libératoire<small>Ton impôt sur le revenu est payé en même temps que tes cotisations.</small></span></label>
          </div>
          <button class="btn" type="submit">C’est parti</button>
        </form>
      </div>
      <p class="muted small" style="text-align:center">Tu veux d’abord voir à quoi ça ressemble ? <a href="?demo=1#/dashboard">Ouvrir la démo</a></p>
    </div>`;
  }

  // ---------- Vue : tableau de bord
  function viewDashboard() {
    const y = new Date().getFullYear();
    const cur = periodOf(today());
    const due = nextDeclaration();
    const dueC = compute(between(due.start, due.end));
    const curC = compute(between(cur.start, cur.end));
    const yC = compute(yearRecs(y));
    const d = daysUntil(due.deadline);
    const isCurrent = due.key === cur.key;
    const countdown = d < 0 ? `En retard de ${plural(-d, 'jour')}` : d === 0 ? 'C’est aujourd’hui' : `Plus que ${plural(d, 'jour')}`;
    const first = P().nom ? ` ${esc(P().nom.split(' ')[0])}` : '';

    const months = Array.from({ length: 12 }, (_, m) => compute(between(iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0)))).ca);
    const maxM = Math.max(1, ...months);
    const curMonth = new Date().getMonth();
    const chart = months.map((v, m) => `<div class="col">
      <div class="colbar ${m > curMonth ? 'future' : m === curMonth ? 'current' : ''}" style="height:${m > curMonth ? 3 : Math.max(2, (v / maxM) * 100)}%" data-v="${m > curMonth ? '' : money0(v)}"></div>
      <span class="m">${MONTHS_SHORT[m]}</span></div>`).join('');

    const last = [...state.recettes].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const pro = isPro();

    return page(`
      ${pageHead(`Bonjour${first} 👋`, `Voici où tu en es au ${dateLong(today())}.`, `<a class="btn" href="#/recettes/new">${icon('plus')} Ajouter une recette</a>`)}
      <div class="card hero-card">
        <div class="muted">${isCurrent ? 'Période en cours' : 'Prochaine déclaration'} · ${esc(due.label)}</div>
        <div class="big num">${money(dueC.total)}</div>
        <div class="muted">${isCurrent ? 'à mettre de côté pour l’URSSAF (estimation, période pas terminée)' : 'à déclarer et payer à l’URSSAF'}</div>
        <div class="row">
          <div><span class="muted small">Échéance</span><strong>${dateLong(due.deadline)}</strong></div>
          <div><span class="muted small">Chiffre d’affaires</span><strong class="num">${money(dueC.ca)}</strong></div>
          <div><span class="muted small">Net en poche</span><strong class="num">${money(dueC.net)}</strong></div>
        </div>
        <div class="hero-actions">
          <span class="countdown ${d <= 7 ? 'urgent' : ''}">${countdown}</span>
          <a class="btn" href="#/declaration">Préparer ma déclaration</a>
        </div>
      </div>

      <div class="grid grid-4">
        <div class="card kpi"><div class="label">CA ${y}</div><div class="value num">${money0(yC.ca)}</div><div class="sub">${plural(yC.count, 'recette')}</div></div>
        <div class="card kpi"><div class="label">Cotisations ${y}</div><div class="value num">${money0(yC.total)}</div><div class="sub">${yC.ca ? pct((yC.total / yC.ca) * 100) + ' du CA' : '—'}</div></div>
        <div class="card kpi"><div class="label">Net en poche ${y}</div><div class="value num">${money0(yC.net)}</div><div class="sub">≈ ${money0(yC.net / (new Date().getMonth() + 1))} / mois</div></div>
        <div class="card kpi"><div class="label">${isCurrent ? 'Mois en cours' : 'À provisionner'}</div><div class="value num">${money0(isCurrent ? months[curMonth] : curC.total)}</div><div class="sub">${isCurrent ? 'encaissés ce mois-ci' : esc(cur.label)}</div></div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><h2>Chiffre d’affaires ${y}</h2><span class="badge">par mois</span></div>
          <div class="chart" role="img" aria-label="Chiffre d’affaires par mois">${chart}</div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Tes seuils ${y}</h2>${P().acre && acreInfo() && today() <= acreInfo().fin ? `<span class="badge ok">ACRE jusqu’au ${dateFr(acreInfo().fin)}</span>` : ''}</div>
          ${thresholds(y).map(meterHtml).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h2>Dernières recettes</h2><a class="btn sm ghost" href="#/recettes">Tout voir</a></div>
        ${last.length ? `<div class="list">${last.map(recRow).join('')}</div>` : emptyRecettes()}
      </div>

      ${pro ? '' : `<div class="card" style="display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap">
        <div><h2>Factures, devis et livre des recettes en 1 clic</h2><p class="muted" style="margin-top:4px">Cotiz Pro : 2,99 €/mois, sans engagement.</p></div>
        <button class="btn" data-act="upsell">${icon('star')} Découvrir Pro</button></div>`}
    `);
  }

  // ---------- Vue : recettes
  const recFilter = { year: String(new Date().getFullYear()), q: '' };
  function emptyRecettes() {
    return `<div class="empty">${icon('list')}<p><strong>Aucune recette pour l’instant.</strong><br>Ajoute chaque paiement encaissé : Cotiz calcule le reste.</p>
      <button class="btn" data-act="rec-add">${icon('plus')} Ajouter une recette</button></div>`;
  }
  function recRow(r) {
    const sub = [r.libelle, r.mode, r.ref].filter(Boolean).join(' · ');
    return `<div class="row-item">
      <span class="row-date">${dateFr(r.date)}</span>
      <div class="who"><strong>${esc(r.client || 'Client')}</strong><span>${esc(sub)}${naturesPossibles().length > 1 ? ` · ${natureShort(r.nature)}` : ''}</span></div>
      <span class="amount num">${money(num(r.montant))}</span>
      <div class="acts">
        <button class="btn icon ghost" data-act="rec-edit" data-id="${r.id}" aria-label="Modifier">${icon('edit')}</button>
        <button class="btn icon ghost" data-act="rec-del" data-id="${r.id}" aria-label="Supprimer">${icon('trash')}</button>
      </div>
    </div>`;
  }
  function filteredRecettes() {
    const q = recFilter.q.trim().toLowerCase();
    return state.recettes
      .filter((r) => recFilter.year === 'all' || r.date.startsWith(recFilter.year))
      .filter((r) => !q || [r.client, r.libelle, r.ref, r.mode].join(' ').toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }
  function recListHtml() {
    const list = filteredRecettes();
    if (!state.recettes.length) return emptyRecettes();
    if (!list.length) return '<div class="empty"><p>Aucune recette ne correspond.</p></div>';
    const c = compute(list);
    return `<div class="list">${list.map(recRow).join('')}</div>
      <div class="decl-total" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
        <span class="muted">${plural(list.length, 'recette')} · cotisations estimées ${money(c.total)}</span><strong class="num">Total ${money(c.ca)}</strong></div>`;
  }
  function viewRecettes() {
    const years = [...new Set(state.recettes.map((r) => r.date.slice(0, 4)).concat(String(new Date().getFullYear())))].sort().reverse();
    const pro = isPro();
    const used = state.recettes.length;
    return page(`
      ${pageHead('Recettes', 'Chaque paiement encaissé. C’est ton livre des recettes, obligatoire en micro-entreprise.', `<button class="btn" data-act="rec-add">${icon('plus')} Ajouter</button>`)}
      ${pro ? '' : `<div class="alert ${used >= FREE_LIMIT ? 'danger' : 'info'}">${icon('info')}<div style="flex:1">
        <strong>${used}/${FREE_LIMIT} recettes</strong> dans la version gratuite.
        ${used >= FREE_LIMIT ? 'Limite atteinte : passe à Pro pour continuer à en ajouter.' : 'Pro débloque les recettes illimitées et les exports.'}
        <div class="bar" style="margin-top:8px"><i class="${used >= FREE_LIMIT ? 'danger' : used >= FREE_LIMIT * 0.8 ? 'warn' : ''}" style="width:${Math.min(100, (used / FREE_LIMIT) * 100)}%"></i></div></div>
        <button class="btn sm" data-act="upsell">Passer Pro</button></div>`}
      <div class="card">
        <div class="card-head">
          <div class="toolbar">
            <select id="rec-year" aria-label="Année">${years.map((y) => `<option value="${y}" ${recFilter.year === y ? 'selected' : ''}>${y}</option>`).join('')}<option value="all" ${recFilter.year === 'all' ? 'selected' : ''}>Toutes</option></select>
            <input type="search" id="rec-q" placeholder="Rechercher un client…" value="${esc(recFilter.q)}" aria-label="Rechercher">
          </div>
          <div class="btn-row">
            <button class="btn sm ghost" data-act="rec-csv">${icon('download')} CSV ${pro ? '' : '<span class="pro-tag">PRO</span>'}</button>
            <button class="btn sm ghost" data-act="rec-print">${icon('printer')} Livre PDF ${pro ? '' : '<span class="pro-tag">PRO</span>'}</button>
          </div>
        </div>
        <div id="rec-list">${recListHtml()}</div>
      </div>`);
  }
  function mountRecettes(arg) {
    const q = $('#rec-q');
    const y = $('#rec-year');
    if (q) q.addEventListener('input', () => { recFilter.q = q.value; $('#rec-list').innerHTML = recListHtml(); });
    if (y) y.addEventListener('change', () => { recFilter.year = y.value; $('#rec-list').innerHTML = recListHtml(); });
    if (arg === 'new') {
      history.replaceState(null, '', '#/recettes');
      recetteModal();
    }
  }

  function knownClients() {
    const m = new Map();
    for (const f of [...state.factures].sort((a, b) => a.date.localeCompare(b.date))) if (f.client && f.client.nom) m.set(f.client.nom, f.client);
    for (const r of state.recettes) if (r.client && !m.has(r.client)) m.set(r.client, { nom: r.client });
    return m;
  }
  function recetteModal(id) {
    if (!id && !isPro() && state.recettes.length >= FREE_LIMIT) {
      openModal(modalHead('Limite gratuite atteinte') + upsellHtml(`Tu as atteint ${FREE_LIMIT} recettes`));
      return;
    }
    const r = state.recettes.find((x) => x.id === id) || { date: today(), montant: '', client: '', libelle: '', nature: act().nature, mode: 'Virement', ref: '' };
    const natures = naturesPossibles();
    openModal(`${modalHead(id ? 'Modifier la recette' : 'Nouvelle recette')}
      <form data-form="recette" data-id="${id || ''}" class="form-grid">
        <label class="field">Montant encaissé (€)<input name="montant" inputmode="decimal" required value="${r.montant === '' ? '' : decimal(num(r.montant))}" placeholder="0,00"></label>
        <label class="field">Date d’encaissement<input type="date" name="date" required value="${esc(r.date)}"></label>
        <label class="field full">Client<input name="client" list="dl-clients" value="${esc(r.client)}" placeholder="Nom du client" autocomplete="off"></label>
        <datalist id="dl-clients">${[...knownClients().keys()].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
        <label class="field full">Prestation ou produit<input name="libelle" value="${esc(r.libelle)}" placeholder="Ex. : création de logo"></label>
        ${natures.length > 1 ? `<label class="field">Nature<select name="nature">${natures.map((n) => `<option value="${n}" ${r.nature === n ? 'selected' : ''}>${natureLabel(n)}</option>`).join('')}</select></label>` : `<input type="hidden" name="nature" value="${natures[0]}">`}
        <label class="field">Mode de paiement<select name="mode">${PAIEMENTS.map((m) => `<option ${r.mode === m ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
        <label class="field ${natures.length > 1 ? 'full' : ''}">Référence (n° de facture)<input name="ref" value="${esc(r.ref)}" placeholder="Facultatif"></label>
        <div class="modal-foot full" style="margin-top:4px">
          <button type="button" class="btn ghost" data-act="modal-close">Annuler</button>
          <button class="btn" type="submit">${icon('check')} Enregistrer</button>
        </div>
      </form>`);
  }

  function livreHtml(year) {
    const p = P();
    const list = state.recettes.filter((r) => year === 'all' || r.date.startsWith(year)).sort((a, b) => a.date.localeCompare(b.date));
    const c = compute(list);
    return `<div class="doc">
      <div class="doc-top"><div><h1>Livre des recettes</h1><div style="margin-top:6px">${year === 'all' ? 'Toutes années' : `Année ${year}`}</div></div>
      <div class="meta"><b>${esc(p.nom || '')} EI</b><br>${p.siret ? `SIRET : ${esc(p.siret)}<br>` : ''}Édité le ${dateLong(today())}</div></div>
      <table><thead><tr><th>Date</th><th>Réf.</th><th>Client</th><th>Nature</th><th>Mode</th><th class="r">Montant</th></tr></thead>
      <tbody>${list.map((r) => `<tr><td>${dateFr(r.date)}</td><td>${esc(r.ref)}</td><td>${esc(r.client)}${r.libelle ? `<br><small>${esc(r.libelle)}</small>` : ''}</td><td>${natureShort(r.nature)}</td><td>${esc(r.mode)}</td><td class="r">${money(num(r.montant))}</td></tr>`).join('')}</tbody></table>
      <div class="tot"><table>
        ${c.parNature.vente ? `<tr><td>Ventes</td><td class="r">${money(c.parNature.vente)}</td></tr>` : ''}
        ${c.parNature.service ? `<tr><td>Prestations</td><td class="r">${money(c.parNature.service)}</td></tr>` : ''}
        <tr class="grand"><td>Total encaissé</td><td class="r">${money(c.ca)}</td></tr></table></div>
    </div>`;
  }

  // ---------- Vue : factures et devis
  let facTab = 'facture';
  let editing = null;
  const invTotal = (f) => round2(f.lignes.reduce((s, l) => s + num(l.qte) * num(l.pu), 0));
  function nextNumber(type, date) {
    const prefix = `${type === 'devis' ? 'D' : 'F'}-${date.slice(0, 4)}-`;
    const max = state.factures.filter((f) => f.numero.startsWith(prefix)).reduce((m, f) => Math.max(m, parseInt(f.numero.slice(prefix.length), 10) || 0), 0);
    return prefix + pad3(max + 1);
  }
  function newInvoice(type) {
    const date = today();
    return {
      id: uid(), type, numero: nextNumber(type, date), date, echeance: addDays(date, 30),
      client: { nom: '', adresse: '', email: '', siret: '' }, lignes: [{ desc: '', qte: 1, pu: '' }],
      nature: act().nature, statut: 'brouillon', notes: '', isNew: true,
    };
  }
  function facRow(f) {
    const st = STATUTS[f.type][f.statut] || f.statut;
    const late = f.type === 'facture' && f.statut === 'envoyee' && f.echeance < today();
    return `<div class="row-item">
      <span class="row-date">${esc(f.numero)}</span>
      <div class="who"><strong>${esc(f.client.nom || 'Sans client')}</strong><span>${dateFr(f.date)} · ${esc(f.lignes[0] ? f.lignes[0].desc : '')}</span></div>
      <span class="amount num">${money(invTotal(f))}</span>
      <div class="acts"><span class="badge ${late ? 'danger' : STATUT_BADGE[f.statut]}">${late ? 'En retard' : st}</span>
        <a class="btn icon ghost" href="#/facture/${f.id}" aria-label="Ouvrir">${icon('edit')}</a></div>
    </div>`;
  }
  function viewFactures() {
    const list = state.factures.filter((f) => f.type === facTab).sort((a, b) => b.numero.localeCompare(a.numero));
    const unpaid = state.factures.filter((f) => f.type === 'facture' && f.statut === 'envoyee');
    const sample = [
      { numero: 'F-2026-012', client: { nom: 'Client exemple' }, date: today(), lignes: [{ desc: 'Prestation', qte: 1, pu: 850 }], type: 'facture', statut: 'payee', echeance: today() },
      { numero: 'F-2026-013', client: { nom: 'Autre client' }, date: today(), lignes: [{ desc: 'Mission', qte: 2, pu: 400 }], type: 'facture', statut: 'envoyee', echeance: today() },
    ];
    const inner = `<div class="card">
        <div class="card-head">
          <div class="seg" role="tablist">
            <button class="${facTab === 'facture' ? 'on' : ''}" data-act="fac-tab" data-tab="facture">Factures</button>
            <button class="${facTab === 'devis' ? 'on' : ''}" data-act="fac-tab" data-tab="devis">Devis</button>
          </div>
          ${unpaid.length ? `<span class="badge warn">${plural(unpaid.length, 'facture')} en attente · ${money(unpaid.reduce((s, f) => s + invTotal(f), 0))}</span>` : ''}
        </div>
        ${isPro() ? (list.length ? `<div class="list">${list.map(facRow).join('')}</div>` : `<div class="empty">${icon('file')}<p><strong>Aucun ${facTab === 'devis' ? 'devis' : 'facture'} pour l’instant.</strong><br>Les mentions obligatoires sont ajoutées automatiquement.</p><a class="btn" href="#/facture/new-${facTab}">${icon('plus')} Créer ${facTab === 'devis' ? 'un devis' : 'une facture'}</a></div>`)
          : `<div class="list">${sample.map(facRow).join('')}</div>`}
      </div>`;
    return page(`
      ${pageHead('Factures & devis', 'Numérotation automatique, mentions légales incluses, PDF prêt à envoyer.',
        isPro() ? `<a class="btn ghost" href="#/facture/new-devis">${icon('plus')} Devis</a><a class="btn" href="#/facture/new-facture">${icon('plus')} Facture</a>` : '')}
      ${proGate(inner, 'Factures et devis avec Cotiz Pro')}`);
  }

  function lineHtml(l, i) {
    return `<div class="line" data-i="${i}">
      <input class="desc" name="desc" value="${esc(l.desc)}" placeholder="Désignation" aria-label="Désignation">
      <input name="qte" inputmode="decimal" value="${esc(l.qte)}" aria-label="Quantité">
      <input name="pu" inputmode="decimal" value="${l.pu === '' ? '' : esc(decimal(num(l.pu)))}" placeholder="Prix unitaire" aria-label="Prix unitaire">
      <span class="tot num">${money(num(l.qte) * num(l.pu))}</span>
      <button type="button" class="btn icon ghost" data-act="fac-line-del" data-i="${i}" aria-label="Retirer la ligne">${icon('x')}</button>
    </div>`;
  }
  function viewFacture(arg) {
    if (!isPro()) return viewFactures();
    if (!editing || editing.route !== arg) {
      if (arg === 'new-facture' || arg === 'new-devis') editing = newInvoice(arg.slice(4));
      else {
        const f = state.factures.find((x) => x.id === arg);
        if (!f) return page(`<div class="card empty"><p>Document introuvable.</p><a class="btn" href="#/factures">Retour</a></div>`);
        editing = JSON.parse(JSON.stringify(f));
      }
      editing.route = arg;
    }
    const f = editing;
    const isDevis = f.type === 'devis';
    const natures = naturesPossibles();
    const statutOptions = Object.entries(STATUTS[f.type]).filter(([k]) => k !== 'payee' || f.statut === 'payee');
    return page(`
      <div class="page-head">
        <div><a href="#/factures" class="muted small" style="text-decoration:none">← Factures & devis</a>
          <h1 style="margin-top:6px">${isDevis ? 'Devis' : 'Facture'} ${esc(f.numero)}</h1></div>
        <div class="btn-row">
          <button class="btn ghost" data-act="fac-print">${icon('printer')} PDF</button>
          ${!isDevis && f.statut !== 'payee' && !f.isNew ? `<button class="btn soft" data-act="fac-paid">${icon('check')} Marquer payée</button>` : ''}
          ${isDevis && !f.isNew ? `<button class="btn soft" data-act="fac-convert">${icon('file')} Transformer en facture</button>` : ''}
          <button class="btn" data-act="fac-save">${icon('check')} Enregistrer</button>
        </div>
      </div>
      <form id="fac-form" data-form="facture" class="grid" style="gap:16px">
        <div class="grid grid-2">
          <div class="card">
            <h2 style="margin-bottom:14px">Client</h2>
            <div class="form-grid">
              <label class="field full">Nom ou raison sociale<input name="c_nom" list="dl-fclients" value="${esc(f.client.nom)}" required autocomplete="off"></label>
              <datalist id="dl-fclients">${[...knownClients().keys()].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>
              <label class="field full">Adresse<textarea name="c_adresse" rows="2">${esc(f.client.adresse)}</textarea></label>
              <label class="field">E-mail<input type="email" name="c_email" value="${esc(f.client.email)}"></label>
              <label class="field">SIRET (client pro)<input name="c_siret" value="${esc(f.client.siret)}"></label>
            </div>
          </div>
          <div class="card">
            <h2 style="margin-bottom:14px">Informations</h2>
            <div class="form-grid">
              <label class="field">Date<input type="date" name="date" value="${esc(f.date)}" required></label>
              <label class="field">${isDevis ? 'Valable jusqu’au' : 'Échéance'}<input type="date" name="echeance" value="${esc(f.echeance)}" required></label>
              <label class="field">Statut<select name="statut" ${f.statut === 'payee' ? 'disabled' : ''}>${statutOptions.map(([k, v]) => `<option value="${k}" ${f.statut === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
              ${natures.length > 1 ? `<label class="field">Nature<select name="nature">${natures.map((n) => `<option value="${n}" ${f.nature === n ? 'selected' : ''}>${natureShort(n)}</option>`).join('')}</select></label>` : ''}
            </div>
            ${P().siret ? '' : `<div class="alert" style="margin-top:14px">${icon('alert')}<div>Ajoute ton nom, ton adresse et ton SIRET dans <a href="#/reglages">Réglages</a> : ils doivent figurer sur la facture.</div></div>`}
          </div>
        </div>
        <div class="card">
          <h2 style="margin-bottom:14px">Prestations</h2>
          <div class="line line-head"><span>Désignation</span><span>Qté</span><span>Prix unit. (€)</span><span style="text-align:right">Total</span><span></span></div>
          <div class="lines" id="fac-lines">${f.lignes.map(lineHtml).join('')}</div>
          <div class="btn-row" style="margin:12px 0 16px"><button type="button" class="btn sm ghost" data-act="fac-line-add">${icon('plus')} Ajouter une ligne</button></div>
          <div class="totals"><div><span>Total ${isDevis ? '' : 'à payer'}</span><span class="num" id="fac-total">${money(invTotal(f))}</span></div></div>
          <p class="muted small" style="text-align:right;margin-top:6px">TVA non applicable, art. 293 B du CGI</p>
        </div>
        <div class="card">
          <label class="field">Notes (conditions, remerciements…)<textarea name="notes" rows="3" placeholder="Ex. : Merci pour votre confiance !">${esc(f.notes)}</textarea></label>
        </div>
        ${f.isNew ? '' : `<div class="btn-row"><button type="button" class="btn danger" data-act="fac-delete">${icon('trash')} Supprimer</button></div>`}
      </form>`);
  }
  function readInvoiceForm() {
    const form = $('#fac-form');
    if (!form || !editing) return editing;
    const v = (n) => (form.elements[n] ? form.elements[n].value : undefined);
    editing.client = { nom: v('c_nom').trim(), adresse: v('c_adresse').trim(), email: v('c_email').trim(), siret: v('c_siret').trim() };
    editing.date = v('date') || editing.date;
    editing.echeance = v('echeance') || editing.echeance;
    if (form.elements.statut && !form.elements.statut.disabled) editing.statut = v('statut');
    if (form.elements.nature) editing.nature = v('nature');
    editing.notes = v('notes');
    editing.lignes = $$('#fac-lines .line').map((row) => ({
      desc: row.querySelector('[name=desc]').value.trim(),
      qte: num(row.querySelector('[name=qte]').value) || 0,
      pu: row.querySelector('[name=pu]').value === '' ? '' : num(row.querySelector('[name=pu]').value),
    }));
    return editing;
  }
  function saveInvoice() {
    const f = readInvoiceForm();
    if (!f.client.nom) { toast('Indique le nom du client.'); return false; }
    if (!f.lignes.some((l) => l.desc && num(l.pu))) { toast('Ajoute au moins une prestation avec un prix.'); return false; }
    f.lignes = f.lignes.filter((l) => l.desc || num(l.pu));
    const { route, isNew, ...clean } = f;
    const i = state.factures.findIndex((x) => x.id === f.id);
    if (i >= 0) state.factures[i] = clean; else state.factures.push(clean);
    save();
    if (isNew) {
      delete editing.isNew;
      editing.route = f.id;
      history.replaceState(null, '', `#/facture/${f.id}`);
    }
    return true;
  }
  function mountFacture() {
    const form = $('#fac-form');
    if (!form) return;
    form.addEventListener('input', (e) => {
      if (!e.target.closest('.line')) return;
      let total = 0;
      for (const row of $$('#fac-lines .line')) {
        const t = num(row.querySelector('[name=qte]').value) * num(row.querySelector('[name=pu]').value);
        total += t;
        row.querySelector('.tot').textContent = money(t);
      }
      $('#fac-total').textContent = money(total);
    });
    form.elements.c_nom.addEventListener('change', (e) => {
      const c = knownClients().get(e.target.value);
      if (!c) return;
      for (const k of ['adresse', 'email', 'siret']) if (c[k] && !form.elements[`c_${k}`].value) form.elements[`c_${k}`].value = c[k];
    });
  }
  function invoiceDoc(f) {
    const p = P();
    const isDevis = f.type === 'devis';
    const total = invTotal(f);
    const emetteur = [p.enseigne && p.enseigne !== p.nom ? p.enseigne : '', p.adresse, p.siret ? `SIRET : ${p.siret}` : '', p.email, p.tel].filter(Boolean).join('\n');
    const client = [f.client.adresse, f.client.siret ? `SIRET : ${f.client.siret}` : '', f.client.email].filter(Boolean).join('\n');
    const mentions = [
      'TVA non applicable, art. 293 B du CGI.',
      isDevis ? `Devis valable jusqu’au ${dateLong(f.echeance)}.` : `Date d’échéance : ${dateLong(f.echeance)}. Pas d’escompte pour paiement anticipé.`,
      isDevis ? '' : 'En cas de retard de paiement : pénalités au taux de 3 fois le taux d’intérêt légal et, pour les clients professionnels, indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 du Code de commerce).',
      p.iban && !isDevis ? `Règlement par virement : IBAN ${p.iban}` : '',
      p.mentions,
      f.notes,
    ].filter(Boolean).join('\n');
    const rows = f.lignes.map((l) => `<tr><td>${esc(l.desc)}</td><td class="r">${esc(String(l.qte).replace('.', ','))}</td><td class="r">${money(num(l.pu))}</td><td class="r">${money(num(l.qte) * num(l.pu))}</td></tr>`).join('');
    return `<div class="doc">
      <div class="doc-top">
        <div><h1>${isDevis ? 'Devis' : 'Facture'}</h1><div style="margin-top:6px;font-weight:700">N° ${esc(f.numero)}</div></div>
        <div class="meta">Date : ${dateLong(f.date)}<br>${isDevis ? 'Valable jusqu’au' : 'Échéance'} : ${dateLong(f.echeance)}</div>
      </div>
      <div class="parties">
        <div class="party"><b>${esc(p.nom || 'Ton nom')} EI</b>${esc(emetteur)}</div>
        <div class="party client"><b>${esc(f.client.nom)}</b>${esc(client)}</div>
      </div>
      <table><thead><tr><th>Désignation</th><th class="r">Qté</th><th class="r">Prix unitaire</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="tot"><table>
        <tr><td>Total HT</td><td class="r">${money(total)}</td></tr>
        <tr><td>TVA</td><td class="r">${money(0)}</td></tr>
        <tr class="grand"><td>${isDevis ? 'Total' : 'Net à payer'}</td><td class="r">${money(total)}</td></tr>
      </table></div>
      <div class="mentions">${esc(mentions)}</div>
      ${isDevis ? '<div class="sign"><div>Bon pour accord<br>Date et signature du client</div></div>' : ''}
    </div>`;
  }
  function paidModal() {
    openModal(`${modalHead('Facture payée')}
      <p class="muted">Cotiz ajoute automatiquement ${money(invTotal(editing))} à tes recettes.</p>
      <form data-form="fac-paid" class="form-grid" style="margin-top:16px">
        <label class="field">Date d’encaissement<input type="date" name="date" value="${today()}" required></label>
        <label class="field">Mode de paiement<select name="mode">${PAIEMENTS.map((m) => `<option>${m}</option>`).join('')}</select></label>
        <div class="modal-foot full"><button type="button" class="btn ghost" data-act="modal-close">Annuler</button><button class="btn" type="submit">${icon('check')} Confirmer</button></div>
      </form>`);
  }

  // ---------- Vue : déclaration
  function declCard(p, isNext) {
    const c = compute(between(p.start, p.end));
    const done = !!state.declarees[p.key];
    const ongoing = p.end >= today();
    const d = daysUntil(p.deadline);
    let badge;
    if (done) badge = `<span class="badge ok">${icon('check')} Déclarée</span>`;
    else if (ongoing) badge = '<span class="badge">En cours</span>';
    else if (d < 0) badge = '<span class="badge danger">En retard</span>';
    else badge = `<span class="badge ${d <= 7 ? 'warn' : 'brand'}">À déclarer · J-${d}</span>`;
    const lines = naturesPossibles().map((n) => {
      const v = Math.round(c.parNature[n]);
      return `<div class="decl-line"><span class="lbl">${natureLabel(n)}</span><span class="val num">${money0(v)}
        <button class="btn icon ghost" data-act="copy" data-v="${v}" aria-label="Copier le montant">${icon('copy')}</button></span></div>`;
    }).join('');
    return `<div class="decl ${isNext ? 'due' : ''}">
      <div class="decl-head"><div><h3>${esc(p.label)}</h3><span class="muted small">À déclarer avant le ${dateLong(p.deadline)} · ${plural(c.count, 'recette')}</span></div>${badge}</div>
      ${lines}
      <div class="decl-total"><span class="muted">Cotisations${P().vl ? ' + impôt' : ''} à payer${c.acre ? ' (ACRE incluse)' : ''}</span><strong class="num">${money(c.total)}</strong></div>
      <div class="btn-row">${ongoing ? '<span class="muted small">Période pas terminée : montants provisoires.</span>'
        : `<button class="btn sm ${done ? 'ghost' : ''}" data-act="decl-toggle" data-key="${p.key}">${done ? 'Annuler « déclarée »' : `${icon('check')} J’ai déclaré`}</button>`}</div>
    </div>`;
  }
  function viewDeclaration() {
    const per = P().periodicite;
    const next = nextDeclaration();
    const periods = periodsBack(per === 'mois' ? 12 : 6);
    return page(`
      ${pageHead('Déclarer à l’URSSAF', `Déclaration ${per === 'mois' ? 'mensuelle' : 'trimestrielle'}. Montants arrondis à l’euro, comme sur le formulaire.`,
        `<a class="btn ghost" href="${URSSAF_URL}" target="_blank" rel="noopener">${icon('external')} Site de l’URSSAF</a>`)}
      <div class="alert info">${icon('info')}<div><strong>Comment faire :</strong> connecte-toi sur autoentrepreneur.urssaf.fr, ouvre « Déclarer et payer », puis recopie les montants ci-dessous. Sans chiffre d’affaires, la déclaration reste obligatoire : déclare 0 €.</div></div>
      <div class="grid grid-2">${periods.map((p) => declCard(p, p.key === next.key)).join('')}</div>`);
  }

  // ---------- Vue : simulateur
  function viewSimulateur() {
    const natures = naturesPossibles();
    const inner = `<div class="grid grid-2">
        <div class="card">
          <h2>Combien facturer ?</h2>
          <p class="muted small" style="margin:4px 0 16px">Pour toucher un revenu net donné, après cotisations${P().vl ? ' et impôt' : ''}.</p>
          <div class="form-grid">
            <label class="field">Revenu net visé / mois (€)<input data-sim id="sim-net" inputmode="decimal" value="2000"></label>
            <label class="field">Jours facturés / mois<input data-sim id="sim-jours" inputmode="decimal" value="15"></label>
            ${natures.length > 1 ? `<label class="field full">Nature<select data-sim id="sim-nature">${natures.map((n) => `<option value="${n}">${natureLabel(n)}</option>`).join('')}</select></label>` : ''}
          </div>
          <div id="sim-out" style="margin-top:18px"></div>
        </div>
        <div class="card">
          <h2>Si j’encaisse…</h2>
          <p class="muted small" style="margin:4px 0 16px">Ce qui part à l’URSSAF et ce qui te reste.</p>
          <label class="field">Montant encaissé (€)<input data-sim id="sim-ca" inputmode="decimal" value="1000"></label>
          <div id="sim-out2" style="margin-top:18px"></div>
        </div>
      </div>`;
    return page(`${pageHead('Simulateur', `Barème ${R.annee}, hors ACRE.`)}${proGate(inner, 'Le simulateur est inclus dans Cotiz Pro')}`);
  }
  function mountSimulateur() {
    const out = $('#sim-out');
    if (!out) return;
    const kv = (k, v, strong) => `<div class="decl-line"><span class="lbl">${k}</span><span class="val num" style="${strong ? '' : 'font-weight:600'}">${v}</span></div>`;
    const update = () => {
      const nature = $('#sim-nature') ? $('#sim-nature').value : naturesPossibles()[0];
      const rate = effectiveRate(nature) / 100;
      const net = num($('#sim-net').value);
      const jours = num($('#sim-jours').value);
      const caM = net / (1 - rate);
      const plafond = nature === 'vente' ? R.plafonds.vente : R.plafonds.service;
      out.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
        ${kv('Chiffre d’affaires / mois', money0(caM), true)}
        ${kv('Chiffre d’affaires / an', money0(caM * 12))}
        ${jours ? kv('Tarif journalier minimum', money0(caM / jours), true) : ''}
        ${kv(`Cotisations / mois (${pct(rate * 100)})`, money0(caM * rate))}
        ${caM * 12 > plafond ? `<div class="alert">${icon('alert')}<div>Au-delà de ${money0(plafond)} par an, tu dépasses le plafond de la micro-entreprise.</div></div>` : ''}
      </div>`;
      const ca = num($('#sim-ca').value);
      const k = rateKey(nature);
      const social = ca * R.social[k] / 100;
      const cfp = ca * cfpRate() / 100;
      const vl = P().vl ? ca * R.vl[k] / 100 : 0;
      $('#sim-out2').innerHTML = `<div style="display:flex;flex-direction:column;gap:8px">
        ${kv(`Cotisations sociales (${pct(R.social[k])})`, money(social))}
        ${kv(`Formation pro (${pct(cfpRate())})`, money(cfp))}
        ${P().vl ? kv(`Impôt, versement libératoire (${pct(R.vl[k])})`, money(vl)) : ''}
        ${kv('Il te reste', money(ca - social - cfp - vl), true)}
      </div>`;
    };
    $$('[data-sim]').forEach((el) => el.addEventListener('input', update));
    update();
  }

  // ---------- Vue : réglages
  function viewReglages() {
    const p = P();
    const L = state.license;
    const pro = isPro();
    let sub;
    if (DEMO) sub = '<p class="muted">Mode démo : toutes les fonctions Pro sont débloquées pour que tu puisses les essayer.</p>';
    else if (pro) {
      sub = `<div class="alert info">${icon('check')}<div><strong>Cotiz Pro est actif.</strong> Clé ${esc(L.key.slice(0, 8))}…, vérifiée le ${new Date(L.checkedAt).toLocaleDateString('fr-FR')}.</div></div>
        <div class="btn-row" style="margin-top:14px">
          <a class="btn ghost" href="${esc(CFG.manageUrl || '#')}" target="_blank" rel="noopener">${icon('external')} Gérer mon abonnement</a>
          <button class="btn ghost" data-act="lic-refresh">Vérifier maintenant</button>
          <button class="btn danger" data-act="lic-deactivate">Retirer de cet appareil</button>
        </div>`;
    } else {
      sub = `${L ? `<div class="alert danger" style="margin-bottom:14px">${icon('alert')}<div>Ton abonnement n’est plus actif (${esc(L.status || 'inconnu')}). Tes données sont conservées. <button class="btn sm ghost" data-act="lic-refresh">Revérifier</button></div></div>` : ''}
        <div class="grid grid-2" style="align-items:start">
          <div>${upsellHtml()}</div>
          <form data-form="licence" class="card" style="box-shadow:none">
            <h3>Tu as déjà une clé ?</h3>
            <p class="muted small" style="margin:4px 0 12px">Elle t’a été envoyée par e-mail après ton paiement.</p>
            <label class="field">Clé de licence<input name="key" required autocomplete="off" placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"></label>
            <button class="btn block" type="submit" style="margin-top:12px">Activer Pro</button>
          </form>
        </div>`;
    }
    const rateRows = [
      ['Vente de marchandises (BIC)', R.social.vente, R.vl.vente],
      ['Prestations de services (BIC)', R.social.bic, R.vl.bic],
      ['Prestations de services (BNC)', R.social.bnc, R.vl.bnc],
      ['Libéral réglementé (CIPAV)', R.social.cipav, R.vl.cipav],
    ];
    return page(`
      ${pageHead('Réglages', 'Ton profil, ton abonnement et tes données.')}
      <div class="card">
        <h2 style="margin-bottom:16px">Mon activité</h2>
        <form data-form="profil" class="form-grid">
          <label class="field">Activité principale<select name="activite">${Object.entries(ACTIVITES).map(([k, a]) => `<option value="${k}" ${p.activite === k ? 'selected' : ''}>${a.label}</option>`).join('')}</select></label>
          <label class="field">Début d’activité<input type="date" name="debut" value="${esc(p.debut)}" required></label>
          <label class="field">Déclaration<select name="periodicite"><option value="trimestre" ${p.periodicite === 'trimestre' ? 'selected' : ''}>Trimestrielle</option><option value="mois" ${p.periodicite === 'mois' ? 'selected' : ''}>Mensuelle</option></select></label>
          <div class="field" style="justify-content:flex-end;gap:10px">
            <label class="check"><input type="checkbox" name="mixte" ${p.mixte ? 'checked' : ''}><span>Activité mixte (ventes + services BIC)</span></label>
            <label class="check"><input type="checkbox" name="acre" ${p.acre ? 'checked' : ''}><span>Bénéficiaire de l’ACRE</span></label>
            <label class="check"><input type="checkbox" name="vl" ${p.vl ? 'checked' : ''}><span>Versement libératoire de l’impôt</span></label>
          </div>
          <h2 class="full" style="margin-top:10px">Sur mes factures</h2>
          <label class="field">Nom et prénom<input name="nom" value="${esc(p.nom)}" placeholder="Léa Martin"></label>
          <label class="field">Nom commercial<span class="hint">Facultatif</span><input name="enseigne" value="${esc(p.enseigne)}"></label>
          <label class="field full">Adresse<textarea name="adresse" rows="2">${esc(p.adresse)}</textarea></label>
          <label class="field">SIRET<input name="siret" value="${esc(p.siret)}" inputmode="numeric"></label>
          <label class="field">IBAN<span class="hint">Affiché sur les factures</span><input name="iban" value="${esc(p.iban)}"></label>
          <label class="field">E-mail<input type="email" name="email" value="${esc(p.email)}"></label>
          <label class="field">Téléphone<input name="tel" value="${esc(p.tel)}"></label>
          <label class="field full">Mentions complémentaires<span class="hint">Ex. : assurance professionnelle, dispense d’immatriculation…</span><textarea name="mentions" rows="2">${esc(p.mentions)}</textarea></label>
          <div class="full"><button class="btn" type="submit">${icon('check')} Enregistrer</button></div>
        </form>
      </div>

      <div class="card" id="abonnement">
        <div class="card-head"><h2>Abonnement</h2>${pro ? '<span class="pro-tag">PRO</span>' : '<span class="badge">Gratuit</span>'}</div>
        ${sub}
      </div>

      <div class="card">
        <h2 style="margin-bottom:6px">Mes données</h2>
        <p class="muted small" style="margin-bottom:14px">Tout est stocké sur cet appareil, rien n’est envoyé sur un serveur. Fais une sauvegarde de temps en temps, ou pour passer sur un autre appareil.</p>
        <div class="btn-row">
          <button class="btn ghost" data-act="data-export">${icon('download')} Sauvegarder</button>
          <button class="btn ghost" data-act="data-import">${icon('upload')} Restaurer</button>
          <button class="btn danger" data-act="data-reset">${icon('trash')} Tout effacer</button>
          <input type="file" id="import-file" accept="application/json,.json" class="hidden">
        </div>
      </div>

      <div class="card">
        <h2 style="margin-bottom:12px">Barème ${R.annee}</h2>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Activité</th><th class="r">Cotisations</th><th class="r">Versement libératoire</th></tr></thead>
          <tbody>${rateRows.map(([l, s, v]) => `<tr><td>${l}</td><td class="r num">${pct(s)}</td><td class="r num">${pct(v)}</td></tr>`).join('')}</tbody>
        </table></div>
        <p class="muted small" style="margin-top:12px">Formation professionnelle : ${pct(R.cfp.commercant)} (commerçants), ${pct(R.cfp.artisan)} (artisans), ${pct(R.cfp.liberal)} (libéraux). Plafonds : ${money0(R.plafonds.vente)} (ventes) et ${money0(R.plafonds.service)} (services). ACRE : −${R.acre.avant} % pour un début avant le 1er juillet 2026, −${R.acre.apres} % ensuite.</p>
        <p class="muted small" style="margin-top:8px">Cotiz est un outil d’aide qui ne remplace pas un expert-comptable. En cas de doute, vérifie sur autoentrepreneur.urssaf.fr. Version ${VERSION}${CFG.supportEmail ? ` · Support : <a href="mailto:${esc(CFG.supportEmail)}">${esc(CFG.supportEmail)}</a>` : ''}.</p>
      </div>`);
  }

  // ---------- Actions
  const ACTIONS = {
    'modal-close': closeModal,
    'modal-close-back': closeModal,
    'modal-close-link': (el) => { closeModal(); location.hash = el.getAttribute('href'); },
    buy: openCheckout,
    upsell: () => openModal(modalHead('Cotiz Pro') + upsellHtml('Va plus vite avec Pro')),
    copy: (el) => copyText(el.dataset.v),

    'rec-add': () => recetteModal(),
    'rec-edit': (el) => recetteModal(el.dataset.id),
    'rec-del': (el) => {
      const r = state.recettes.find((x) => x.id === el.dataset.id);
      if (!r || !confirm(`Supprimer la recette de ${money(num(r.montant))} du ${dateFr(r.date)} ?`)) return;
      state.recettes = state.recettes.filter((x) => x.id !== r.id);
      save();
      render();
      toast('Recette supprimée.');
    },
    'rec-csv': () => {
      if (!isPro()) return ACTIONS.upsell();
      const rows = [['Date d’encaissement', 'Référence', 'Client', 'Prestation', 'Nature', 'Mode de paiement', 'Montant (€)']];
      for (const r of filteredRecettes().reverse()) rows.push([r.date, r.ref, r.client, r.libelle, natureLabel(r.nature), r.mode, decimal(num(r.montant))]);
      download(`livre-des-recettes-${recFilter.year}.csv`, csv(rows), 'text/csv;charset=utf-8');
    },
    'rec-print': () => {
      if (!isPro()) return ACTIONS.upsell();
      printHtml(livreHtml(recFilter.year), `Livre des recettes ${recFilter.year}`);
    },

    'fac-tab': (el) => { facTab = el.dataset.tab; render(); },
    'fac-save': () => { if (saveInvoice()) { render(); toast('Enregistré ✓'); } },
    'fac-line-add': () => { readInvoiceForm(); editing.lignes.push({ desc: '', qte: 1, pu: '' }); render(); const rows = $$('#fac-lines .desc'); rows[rows.length - 1].focus(); },
    'fac-line-del': (el) => {
      readInvoiceForm();
      editing.lignes.splice(Number(el.dataset.i), 1);
      if (!editing.lignes.length) editing.lignes.push({ desc: '', qte: 1, pu: '' });
      render();
    },
    'fac-print': () => {
      if (!saveInvoice()) return;
      if (editing.statut === 'brouillon') {
        editing.statut = 'envoyee';
        const saved = state.factures.find((x) => x.id === editing.id);
        if (saved) saved.statut = 'envoyee';
        save();
      }
      render();
      printHtml(invoiceDoc(editing), `${editing.type === 'devis' ? 'Devis' : 'Facture'} ${editing.numero} - ${editing.client.nom}`);
    },
    'fac-paid': () => { if (saveInvoice()) paidModal(); },
    'fac-convert': () => {
      if (!saveInvoice()) return;
      const devis = state.factures.find((x) => x.id === editing.id);
      devis.statut = 'acceptee';
      const f = newInvoice('facture');
      Object.assign(f, { client: { ...devis.client }, lignes: devis.lignes.map((l) => ({ ...l })), nature: devis.nature, notes: devis.notes, devis: devis.numero });
      delete f.isNew;
      state.factures.push(f);
      save();
      editing = null;
      location.hash = `#/facture/${f.id}`;
      toast(`Facture ${f.numero} créée depuis le devis.`);
    },
    'fac-delete': () => {
      const f = state.factures.find((x) => x.id === editing.id);
      if (!f) return;
      if (f.type === 'facture') {
        const prefix = f.numero.slice(0, 7);
        const last = state.factures.filter((x) => x.type === 'facture' && x.numero.startsWith(prefix)).sort((a, b) => b.numero.localeCompare(a.numero))[0];
        if (last && last.id !== f.id) {
          alert('Pour garder une numérotation continue (obligatoire), seule la dernière facture peut être supprimée. Pour annuler une facture déjà envoyée, établis une facture d’avoir.');
          return;
        }
      }
      if (!confirm(`Supprimer ${f.type === 'devis' ? 'le devis' : 'la facture'} ${f.numero} ?${f.recetteId ? ' La recette associée sera aussi supprimée.' : ''}`)) return;
      state.factures = state.factures.filter((x) => x.id !== f.id);
      if (f.recetteId) state.recettes = state.recettes.filter((r) => r.id !== f.recetteId);
      save();
      editing = null;
      location.hash = '#/factures';
      toast('Supprimé.');
    },

    'decl-toggle': (el) => {
      const k = el.dataset.key;
      if (state.declarees[k]) delete state.declarees[k]; else state.declarees[k] = true;
      save();
      render();
      if (state.declarees[k]) toast('Bien joué, une de moins ✓');
    },

    'lic-refresh': () => refreshLicense(true),
    'lic-deactivate': () => { if (confirm('Retirer la licence Pro de cet appareil ? Tu pourras la réactiver avec ta clé.')) deactivateLicense(); },

    'data-export': () => {
      const { license, ...data } = state;
      download(`cotiz-sauvegarde-${today()}.json`, JSON.stringify({ app: 'cotiz', exportedAt: new Date().toISOString(), data }, null, 2), 'application/json');
      toast('Sauvegarde téléchargée.');
    },
    'data-import': () => {
      if (DEMO) return toast('Indisponible en mode démo.');
      const input = $('#import-file');
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const json = JSON.parse(await file.text());
          const data = json.data || json;
          if (!Array.isArray(data.recettes)) throw new Error();
          if (!confirm(`Remplacer tes données actuelles par cette sauvegarde (${plural(data.recettes.length, 'recette')}) ?`)) return;
          state = normalize({ ...data, license: state.license });
          save();
          render();
          toast('Sauvegarde restaurée ✓');
        } catch (e) {
          toast('Ce fichier n’est pas une sauvegarde Cotiz valide.');
        } finally {
          input.value = '';
        }
      };
      input.click();
    },
    'data-reset': () => {
      if (DEMO) return toast('Indisponible en mode démo.');
      if (!confirm('Effacer toutes tes recettes, factures et réglages de cet appareil ?')) return;
      if (!confirm('Vraiment ? Sans sauvegarde, c’est définitif.')) return;
      state = normalize({ license: state.license });
      save();
      location.hash = '#/dashboard';
      render();
    },
  };

  // ---------- Formulaires
  const FORMS = {
    onboarding(form) {
      const fd = new FormData(form);
      const activite = fd.get('activite');
      Object.assign(state.profile, {
        activite, debut: fd.get('debut'), periodicite: fd.get('periodicite'),
        mixte: !!fd.get('mixte') && ACTIVITES[activite].mixable, acre: !!fd.get('acre'), vl: !!fd.get('vl'),
      });
      save();
      location.hash = '#/dashboard';
      render();
      toast('Tout est prêt. Ajoute ta première recette !');
    },
    recette(form) {
      const fd = new FormData(form);
      const montant = round2(num(fd.get('montant')));
      if (montant <= 0) { toast('Indique un montant supérieur à 0.'); return; }
      const data = {
        date: fd.get('date'), montant, client: String(fd.get('client')).trim(), libelle: String(fd.get('libelle')).trim(),
        nature: fd.get('nature') || act().nature, mode: fd.get('mode'), ref: String(fd.get('ref')).trim(),
      };
      const id = form.dataset.id;
      if (id) Object.assign(state.recettes.find((r) => r.id === id), data);
      else state.recettes.push({ id: uid(), ...data });
      save();
      closeModal();
      render();
      toast(id ? 'Recette modifiée ✓' : `+${money(montant)} ajoutés ✓`);
    },
    profil(form) {
      const fd = new FormData(form);
      const p = state.profile;
      for (const k of ['activite', 'debut', 'periodicite', 'nom', 'enseigne', 'adresse', 'siret', 'iban', 'email', 'tel', 'mentions']) p[k] = String(fd.get(k) ?? '').trim();
      p.mixte = !!fd.get('mixte') && ACTIVITES[p.activite].mixable;
      p.acre = !!fd.get('acre');
      p.vl = !!fd.get('vl');
      // Les recettes déjà saisies suivent la nouvelle activité si elle n'est plus mixte.
      if (!p.mixte) for (const r of state.recettes) r.nature = act().nature;
      save();
      render();
      toast('Réglages enregistrés ✓');
    },
    async licence(form) {
      const key = String(new FormData(form).get('key')).trim();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Vérification…';
      try {
        await activateLicense(key);
        render();
        toast('Cotiz Pro est activé. Merci ! 🎉');
      } catch (e) {
        toast(e instanceof TypeError ? 'Connexion impossible. Vérifie ton accès à Internet.' : e.message);
        if (state.license) render();
        else { btn.disabled = false; btn.textContent = 'Activer Pro'; }
      }
    },
    'fac-paid'(form) {
      const fd = new FormData(form);
      const f = state.factures.find((x) => x.id === editing.id);
      const recette = {
        id: uid(), date: fd.get('date'), montant: invTotal(f), client: f.client.nom,
        libelle: f.lignes.map((l) => l.desc).filter(Boolean).join(', ').slice(0, 80), nature: f.nature || act().nature, mode: fd.get('mode'), ref: f.numero,
      };
      state.recettes.push(recette);
      Object.assign(f, { statut: 'payee', recetteId: recette.id, payeLe: recette.date });
      save();
      editing = null;
      closeModal();
      render();
      toast(`+${money(recette.montant)} ajoutés à tes recettes ✓`);
    },
  };

  // ---------- Routeur
  const MOUNT = { recettes: mountRecettes, facture: mountFacture, simulateur: mountSimulateur };
  let lastRoute = '';
  function render() {
    const hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [name, arg] = hash.split('/');
    const onboarding = !DEMO && !P().activite;
    document.body.classList.toggle('onboarding', onboarding);
    renderNav(name);
    const view = $('#view');
    if (onboarding) {
      view.innerHTML = viewOnboarding();
      return;
    }
    if (name !== 'facture') editing = null;
    const views = {
      dashboard: viewDashboard, recettes: viewRecettes, factures: viewFactures, facture: () => viewFacture(arg),
      declaration: viewDeclaration, simulateur: viewSimulateur, reglages: viewReglages,
    };
    view.innerHTML = (views[name] || viewDashboard)();
    if (MOUNT[name]) MOUNT[name](arg);
    if (hash !== lastRoute) {
      window.scrollTo(0, 0);
      if (name === 'reglages' && arg === 'abonnement') $('#abonnement').scrollIntoView({ block: 'start' });
    }
    lastRoute = hash;
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'modal-close-back' && e.target !== el) return;
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]');
    if (!form) return;
    e.preventDefault();
    if (form.dataset.form === 'facture') return ACTIONS['fac-save']();
    if (FORMS[form.dataset.form]) FORMS[form.dataset.form](form);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  window.addEventListener('hashchange', () => { closeModal(); render(); });
  window.addEventListener('online', () => refreshLicense(false));
  window.addEventListener('afterprint', () => { $('#print-area').innerHTML = ''; });

  render();
  refreshLicense(false);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
  }
})();
