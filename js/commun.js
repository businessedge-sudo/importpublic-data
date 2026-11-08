// Outils partagés : client Supabase, formatage, libellés, petites aides d'interface.
(function () {
  const cfg = window.IMPORT_PUBLIC_CONFIG;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const fcfa = (n) =>
    n == null ? '—' : new Intl.NumberFormat('fr-FR').format(Number(n)).replace(/ | /g, ' ') + ' F';

  const date = (d, avecHeure) => {
    if (!d) return '—';
    const o = { day: 'numeric', month: 'short' };
    if (avecHeure) { o.hour = '2-digit'; o.minute = '2-digit'; }
    return new Date(d).toLocaleDateString('fr-FR', o);
  };

  const joursRestants = (d) => {
    const ms = new Date(d) - Date.now();
    if (ms <= 0) return 'Clôturée';
    const j = Math.floor(ms / 86400000);
    if (j >= 1) return j === 1 ? 'Plus que 1 jour' : `Plus que ${j} jours`;
    const h = Math.max(1, Math.floor(ms / 3600000));
    return `Plus que ${h} h`;
  };

  // Échappe le texte saisi par les utilisateurs avant de l'insérer dans le HTML
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Numéro togolais saisi librement -> +228XXXXXXXX
  // Pays desservis (code ISO, nom, indicatif) et régions proposées (saisie libre possible)
  const PAYS = [
    ['TG', 'Togo', '228'], ['BJ', 'Bénin', '229'], ['GH', 'Ghana', '233'],
    ['BF', 'Burkina Faso', '226'], ['CI', "Côte d'Ivoire", '225'], ['NE', 'Niger', '227']
  ];
  const REGIONS = {
    TG: ['Grand Lomé', 'Maritime (hors Lomé)', 'Plateaux', 'Centrale', 'Kara', 'Savanes'],
    BJ: ['Littoral (Cotonou)', 'Atlantique', 'Ouémé', 'Plateau', 'Mono', 'Couffo', 'Zou', 'Collines', 'Borgou', 'Alibori', 'Atacora', 'Donga'],
    GH: ['Greater Accra', 'Ashanti', 'Volta', 'Oti', 'Eastern', 'Central', 'Western', 'Western North', 'Bono', 'Bono East', 'Ahafo',
         'Northern', 'Savannah', 'North East', 'Upper East', 'Upper West']
  };
  const nomPays = (c) => (PAYS.find((p) => p[0] === c) || [c, c || '—'])[1];
  const optionsPays = (sel) => PAYS.map(([c, n]) => `<option value="${c}"${c === (sel || 'TG') ? ' selected' : ''}>${n}</option>`).join('');
  const listeRegions = (pays) => (REGIONS[pays] || []).map((r) => `<option value="${r}">`).join('');

  // Numéro saisi librement -> format international (+indicatif), selon le pays choisi
  const normTel = (t, pays) => {
    const brut = String(t || '').trim();
    let d = brut.replace(/\D/g, '');
    if (!d) return '';
    if (brut.startsWith('+')) return '+' + d;
    if (d.startsWith('00')) return '+' + d.slice(2);
    const ind = (PAYS.find((p) => p[0] === (pays || 'TG')) || PAYS[0])[2];
    if (d.startsWith(ind) && d.length > 9) return '+' + d;
    if (pays === 'GH' && d.startsWith('0')) d = d.slice(1);
    return '+' + ind + d;
  };
  const waLien = (tel, texte) =>
    'https://wa.me/' + String(tel || '').replace(/\D/g, '') + (texte ? '?text=' + encodeURIComponent(texte) : '');

  const ETAPES_CAMPAGNE = [
    ['ouverte', 'Commandes ouvertes'],
    ['quota_atteint', 'Quota atteint'],
    ['commandee', 'Commandé au fournisseur'],
    ['entrepot_chine', 'Reçu à l\'entrepôt en Chine'],
    ['en_transit', 'En route vers Lomé'],
    ['arrivee', 'Arrivé à Lomé, prêt au retrait'],
    ['terminee', 'Terminé']
  ];
  const ETAPES_DEMANDE = [
    ['nouvelle', 'Demande reçue'],
    ['devis_envoye', 'Devis envoyé'],
    ['acceptee', 'Devis accepté'],
    ['payee', 'Paiement validé'],
    ['commandee', 'Commandé au fournisseur'],
    ['entrepot_chine', 'Reçu à l\'entrepôt en Chine'],
    ['en_transit', 'En route vers Lomé'],
    ['arrivee', 'Arrivé à Lomé, prêt au retrait'],
    ['livree', 'Livré']
  ];
  const LIB = {
    brouillon: 'Brouillon', ouverte: 'Ouverte', quota_atteint: 'Quota atteint', echec_quota: 'Quota non atteint',
    commandee: 'Commandée', entrepot_chine: 'Entrepôt Chine', en_transit: 'En transit', arrivee: 'Arrivée à Lomé',
    terminee: 'Terminée',
    en_attente_paiement: 'En attente de paiement', payee: 'Payée', a_rembourser: 'À rembourser',
    remboursee: 'Remboursée', annulee: 'Annulée', livree: 'Livrée',
    nouvelle: 'Nouvelle', devis_envoye: 'Devis envoyé', acceptee: 'Acceptée', refusee: 'Refusée',
    initie: 'En vérification', confirme: 'Validé', echoue: 'Rejeté', rembourse: 'Remboursé',
    tmoney: 'T-Money', flooz: 'Flooz', aerien: 'Aérien', maritime: 'Maritime',
    client: 'Client', groupeur: 'Assistant', admin: 'Admin', assistant: 'Assistant', representant: 'Représentant',
    partenaire: 'Représentant',
    // Commandes assistées
    a_confirmer: 'À confirmer', en_attente_client: 'À confirmer par le client', confirmee: 'Confirmée',
    // Colis
    attendu: 'En route vers le point', recu: 'Prêt au retrait', remis: 'Remis', non_recupere: 'Non récupéré', litige: 'Litige',
    // Commissions et ambassadeurs
    en_attente: 'En attente', validee: 'Validée', acquisition: 'Nouveau client', assistance: 'Assistance',
    actif: 'Actif', suspendu: 'Suspendu', due: 'À payer', especes: 'Espèces', virement: 'Virement',
    // Produits à l'étude
    idee: 'Idée', recherche: 'Recherche', analyse: 'Analyse', estimation: 'Estimation des coûts', lancee: 'Lancée', abandonnee: 'Abandonnée',
    fournisseur: 'Fournisseur', transport: 'Transport', douane: 'Douane', local: 'Frais locaux', autre: 'Autre'
  };
  const lib = (k) => LIB[k] || k;
  const TON = {
    ouverte: 'info', quota_atteint: 'ok', echec_quota: 'ko', terminee: 'neutre', brouillon: 'neutre',
    en_attente_paiement: 'alerte', payee: 'ok', a_rembourser: 'ko', remboursee: 'neutre', annulee: 'neutre', livree: 'ok',
    nouvelle: 'alerte', devis_envoye: 'info', acceptee: 'alerte', refusee: 'neutre',
    initie: 'alerte', confirme: 'ok', echoue: 'ko',
    a_confirmer: 'alerte', en_attente_client: 'alerte', confirmee: 'ok',
    attendu: 'info', recu: 'alerte', remis: 'ok', non_recupere: 'ko', litige: 'ko',
    en_attente: 'alerte', validee: 'info', actif: 'ok', suspendu: 'ko', due: 'alerte',
    idee: 'neutre', recherche: 'info', analyse: 'info', estimation: 'alerte', lancee: 'ok', abandonnee: 'neutre'
  };
  // { Taille: '42', Couleur: 'Noir' } -> « Taille : 42 · Couleur : Noir »
  const txtVariante = (v) => Object.entries(v || {}).map(([k, x]) => `${k} : ${x}`).join(' · ');
  const badge = (statut) => `<span class="badge badge-${TON[statut] || 'info'}">${esc(lib(statut))}</span>`;

  // Frise de suivi : étapes passées (datées), étape courante, étapes à venir
  const frise = (etapes, statutCourant, historique) => {
    const idx = etapes.findIndex(([k]) => k === statutCourant);
    const dates = {};
    (historique || []).forEach((h) => { if (!dates[h.statut]) dates[h.statut] = h.created_at; });
    return `<ol class="frise">${etapes
      .map(([k, l], i) => {
        const etat = idx < 0 ? 'avenir' : i < idx ? 'fait' : i === idx ? 'courant' : 'avenir';
        return `<li class="${etat}"><span class="pastille"></span><div><b>${esc(l)}</b>${
          dates[k] ? `<small>${date(dates[k], true)}</small>` : ''}</div></li>`;
      })
      .join('')}</ol>`;
  };

  const jauge = (payee, quota) => {
    const p = Math.min(100, Math.round((100 * (payee || 0)) / (quota || 1)));
    return `<div class="jauge" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100">
      <div class="jauge-barre" style="width:${p}%"></div></div>
      <div class="jauge-texte"><b>${payee || 0}</b> / ${quota} réservés · ${p}%</div>`;
  };

  // Messages d'erreur lisibles
  const msgErreur = (e) => {
    const m = (e && (e.message || e.error_description || e.msg)) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.';
    if (/Email not confirmed/i.test(m)) return 'Confirme d\'abord ton email (regarde ta boîte de réception).';
    if (/User already registered/i.test(m)) return 'Un compte existe déjà avec cet email. Connecte-toi.';
    if (/Database error saving new user/i.test(m)) return 'Ce numéro WhatsApp est peut-être déjà utilisé par un autre compte.';
    if (/Password should be/i.test(m)) return 'Le mot de passe doit faire au moins 6 caractères.';
    if (/rate limit/i.test(m)) return 'Trop de tentatives. Réessaie dans quelques minutes.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Connexion internet instable. Réessaie.';
    return m;
  };

  const toast = (texte, ton) => {
    const t = document.createElement('div');
    t.className = 'toast ' + (ton || '');
    t.textContent = texte;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('visible'), 10);
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 3500);
  };

  // Réduit une photo avant envoi (connexions lentes) : 1280 px max, JPEG
  const compresserImage = (fichier, max = 1280, qualite = 0.8) =>
    new Promise((ok, ko) => {
      const img = new Image();
      img.onload = () => {
        const r = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * r);
        c.height = Math.round(img.height * r);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob((b) => (b ? ok(b) : ko(new Error('Image illisible'))), 'image/jpeg', qualite);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => ko(new Error('Ce fichier n\'est pas une image lisible'));
      img.src = URL.createObjectURL(fichier);
    });

  const urlImageCampagne = (chemin) =>
    chemin && /^https?:/.test(chemin) ? chemin
      : chemin ? sb.storage.from('campagnes').getPublicUrl(chemin).data.publicUrl : '';

  // Désactive un bouton pendant une action asynchrone
  const occupe = async (bouton, action) => {
    const texte = bouton.textContent;
    bouton.disabled = true;
    bouton.textContent = 'Patiente…';
    try { return await action(); }
    finally { bouton.disabled = false; bouton.textContent = texte; }
  };

  window.IA = {
    sb, cfg, fcfa, date, joursRestants, esc, normTel, waLien, ETAPES_CAMPAGNE, ETAPES_DEMANDE, PAYS, nomPays, optionsPays, listeRegions,
    lib, badge, frise, jauge, msgErreur, toast, compresserImage, urlImageCampagne, occupe, txtVariante
  };
})();

// Remplit les emplacements d'icônes déclarés dans le HTML (data-ico="nom")
(function () {
  if (!window.ICO) return;
  document.querySelectorAll('[data-ico]').forEach((el) => {
    const svg = window.ICO[el.dataset.ico];
    if (svg) el.insertAdjacentHTML('afterbegin', svg);
  });
})();
