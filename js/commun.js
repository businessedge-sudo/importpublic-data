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
    partenaire: 'Point de retrait',
    // Commandes assistées
    a_confirmer: 'À confirmer', en_attente_client: 'À confirmer par le client', confirmee: 'Confirmée',
    // Colis
    attendu: 'En route vers le point', recu: 'Prêt au retrait', remis: 'Remis', non_recupere: 'Non récupéré', litige: 'Litige',
    // Commissions et ambassadeurs
    en_attente: 'En attente', validee: 'Validée', acquisition: 'Nouveau client', assistance: 'Assistance',
    actif: 'Actif', suspendu: 'Suspendu', due: 'À payer', especes: 'Espèces', virement: 'Virement'
  };
  const lib = (k) => LIB[k] || k;
  const TON = {
    ouverte: 'info', quota_atteint: 'ok', echec_quota: 'ko', terminee: 'neutre', brouillon: 'neutre',
    en_attente_paiement: 'alerte', payee: 'ok', a_rembourser: 'ko', remboursee: 'neutre', annulee: 'neutre', livree: 'ok',
    nouvelle: 'alerte', devis_envoye: 'info', acceptee: 'alerte', refusee: 'neutre',
    initie: 'alerte', confirme: 'ok', echoue: 'ko',
    a_confirmer: 'alerte', en_attente_client: 'alerte', confirmee: 'ok',
    attendu: 'info', recu: 'alerte', remis: 'ok', non_recupere: 'ko', litige: 'ko',
    en_attente: 'alerte', validee: 'info', actif: 'ok', suspendu: 'ko', due: 'alerte'
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

  // Connexion avec Google (affichée seulement si cfg.google est activé)
  const LOGO_G = '<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  const boutonGoogle = (texte) => cfg.google
    ? `<button type="button" class="btn btn-google btn-large" data-google>${LOGO_G}<span>${texte || 'Continuer avec Google'}</span></button>
       <div class="separateur"><span>ou avec votre email</span></div>` : '';
  const brancherGoogle = (zone, retour) => {
    (zone || document).querySelectorAll('[data-google]').forEach((b) => b.addEventListener('click', async () => {
      b.disabled = true;
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: retour || (location.origin + location.pathname) } });
      if (error) { b.disabled = false; toast(msgErreur(error), 'ko'); }
    }));
  };

  window.IA = {
    boutonGoogle, brancherGoogle,
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
