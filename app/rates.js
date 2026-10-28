// Barème micro-entrepreneur — à mettre à jour chaque 1er janvier.
// Taux 2026 : décret n° 2025-943 du 8 septembre 2025.
// Plafonds 2026-2028 et seuils de TVA : service-public.fr.
// ACRE : réduction de 50 % pour un début d'activité avant le 1er juillet 2026, 25 % ensuite.
window.COTIZ_RATES = {
  annee: 2026,
  maj: "2026-10-28",
  // Cotisations sociales, en % du chiffre d'affaires encaissé
  social: { vente: 12.3, bic: 21.2, bnc: 25.6, cipav: 23.2 },
  // Versement libératoire de l'impôt sur le revenu (option)
  vl: { vente: 1, bic: 1.7, bnc: 2.2, cipav: 2.2 },
  // Contribution à la formation professionnelle
  cfp: { commercant: 0.1, artisan: 0.3, liberal: 0.2 },
  acre: { bascule: "2026-07-01", avant: 50, apres: 25 },
  plafonds: { vente: 203100, service: 83600 },
  tva: {
    vente: { base: 85000, majore: 93500 },
    service: { base: 37500, majore: 41250 },
  },
};
