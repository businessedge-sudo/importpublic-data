// data.importpublic.com : rapport d'analyse (équipe uniquement)
(function () {
  const { sb, esc, lib, nomPays, msgErreur } = window.IA;
  const vue = document.getElementById('vue');
  const etat = { session: null, profil: null, niveau: null, page: 'ensemble', rapport: null, graphiques: [], rapportOuvert: null, rapportCourant: null };

  // Palette catégorielle validée (ordre fixe, jamais recyclée)
  const C = ['#1A73E8', '#E8710A', '#12A4AF', '#9334E6', '#D01884', '#188038'];
  const nf = new Intl.NumberFormat('fr-FR');
  const nombre = (n) => nf.format(Math.round(Number(n) || 0)).replace(/ | /g, ' ');
  const fcfa = (n) => nombre(n) + ' F';
  const compact = (n) => {
    n = Number(n) || 0;
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' M';
    if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + ' k';
    return nombre(n);
  };
  const jourCourt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const iso = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };

  // ------------------------------------------------------------------
  // Réglages globaux des graphiques (style Looker Studio)
  // ------------------------------------------------------------------
  if (window.Chart) {
    Chart.defaults.font.family = '"Roboto", "Segoe UI", Arial, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#5f6368';
    Chart.defaults.borderColor = '#e8eaed';
    Chart.defaults.maintainAspectRatio = false;
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Object.assign(Chart.defaults.plugins.tooltip, {
      backgroundColor: '#ffffff', titleColor: '#202124', bodyColor: '#3c4043', borderColor: '#dadce0', borderWidth: 1,
      padding: 10, cornerRadius: 6, titleFont: { weight: '500' }, boxPadding: 4, usePointStyle: true
    });
  }

  // ------------------------------------------------------------------
  // Démarrage et connexion
  // ------------------------------------------------------------------
  async function demarrer() {
    const { data } = await sb.auth.getSession();
    etat.session = data.session;
    await chargerProfil();
    sb.auth.onAuthStateChange(async (evt, session) => {
      if (evt === 'SIGNED_IN' || evt === 'SIGNED_OUT') { etat.session = session; await chargerProfil(); afficher(); }
    });
    brancherControles();
    brancherPartage();
    brancherEditeur();
    afficher();
  }

  async function chargerProfil() {
    etat.profil = null; etat.niveau = null;
    if (!etat.session) return;
    const { data } = await sb.from('profils').select('*').eq('id', etat.session.user.id).maybeSingle();
    etat.profil = data;
    const n = await sb.rpc('niveau_data');
    etat.niveau = n.data || null;
  }
  // Accès : l'admin, ou une personne invitée (lecteur / éditeur)
  const aAcces = () => !!etat.niveau;

  function afficher() {
    const barre = document.getElementById('barre-compte');
    barre.innerHTML = etat.session ? `<span class="utilisateur"><span class="avatar">${esc(((etat.profil && etat.profil.nom_complet) || '?').trim()[0].toUpperCase())}</span>
        <span class="nom">${esc((etat.profil && etat.profil.nom_complet) || etat.session.user.email)}</span></span>
        ${etat.niveau === 'admin' ? `<button class="bouton-partage" id="partager"><svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>Partager</button>` : ''}
        <button class="lien-texte" id="sortir">Se déconnecter</button>` : '';
    const bp = document.getElementById('partager');
    if (bp) bp.addEventListener('click', ouvrirPartage);
    const s = document.getElementById('sortir');
    if (s) s.addEventListener('click', () => sb.auth.signOut());
    document.getElementById('controles').hidden = !aAcces();
    if (!aAcces()) return vueConnexion();
    charger();
  }

  function vueConnexion() {
    detruireGraphiques();
    if (etat.session) {
      vue.innerHTML = `<div class="connexion"><h1>Accès réservé</h1><p>Le compte <b>${esc(etat.session.user.email)}</b> n'a pas accès aux analyses.
        Demandez à l'administrateur de partager les analyses avec cet email.</p></div>`;
      return;
    }
    vue.innerHTML = `<form class="connexion" id="f">
      <h1>Analyses Import Public</h1>
      <p>Connectez-vous avec le compte auquel les analyses ont été partagées.</p>
      ${window.IA.boutonGoogle('Se connecter avec Google')}
      <label for="e">Email</label><input id="e" type="email" autocomplete="email" required>
      <label for="p">Mot de passe</label><input id="p" type="password" autocomplete="current-password" required>
      <button class="bouton-bleu">Se connecter</button>
      <div id="msg"></div></form>`;
    window.IA.brancherGoogle(vue);
    document.getElementById('f').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const b = ev.target.querySelector('button:not([type=button])'); b.disabled = true;
      const { error } = await sb.auth.signInWithPassword({ email: document.getElementById('e').value.trim(), password: document.getElementById('p').value });
      b.disabled = false;
      if (error) document.getElementById('msg').innerHTML = `<p class="erreur" style="margin-top:12px">${esc(msgErreur(error))}</p>`;
    });
  }

  // ------------------------------------------------------------------
  // Filtres : période, pays, pages
  // ------------------------------------------------------------------
  function bornes() {
    const v = document.getElementById('periode').value;
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    let d0, d1 = new Date(auj);
    if (/^\d+$/.test(v)) { d0 = new Date(auj); d0.setDate(d0.getDate() - (Number(v) - 1)); }
    else if (v === 'mois') d0 = new Date(auj.getFullYear(), auj.getMonth(), 1);
    else if (v === 'mois-1') { d0 = new Date(auj.getFullYear(), auj.getMonth() - 1, 1); d1 = new Date(auj.getFullYear(), auj.getMonth(), 0); }
    else if (v === 'annee') d0 = new Date(auj.getFullYear(), 0, 1);
    else {
      const a = document.getElementById('date-debut').value, b = document.getElementById('date-fin').value;
      d0 = a ? new Date(a + 'T00:00:00') : new Date(auj.getTime() - 29 * 864e5);
      d1 = b ? new Date(b + 'T00:00:00') : auj;
    }
    return [iso(d0), iso(d1)];
  }

  function brancherControles() {
    const periode = document.getElementById('periode');
    periode.addEventListener('change', () => {
      const perso = periode.value === 'perso';
      document.getElementById('dates-perso').hidden = !perso;
      if (perso) {
        const [a, b] = bornes();
        document.getElementById('date-debut').value = a; document.getElementById('date-fin').value = b;
      }
      charger();
    });
    ['date-debut', 'date-fin', 'pays'].forEach((id) => document.getElementById(id).addEventListener('change', charger));
    document.getElementById('actualiser').addEventListener('click', charger);
    document.querySelectorAll('#pages button').forEach((b) => b.addEventListener('click', () => {
      etat.page = b.dataset.page;
      if (etat.page !== 'rapports') etat.rapportOuvert = null;
      document.querySelectorAll('#pages button').forEach((x) => x.classList.toggle('actif', x === b));
      dessiner();
    }));
  }

  async function charger() {
    const bouton = document.getElementById('actualiser');
    bouton.classList.add('tourne');
    const [d0, d1] = bornes();
    const pays = document.getElementById('pays').value || null;
    if (!etat.rapport) vue.innerHTML = '<div class="chargement">Chargement des données…</div>';
    const { data, error } = await sb.rpc('tableau_de_bord', { p_debut: d0, p_fin: d1, p_pays: pays });
    bouton.classList.remove('tourne');
    if (error) { detruireGraphiques(); vue.innerHTML = `<div class="page-rapport"><p class="erreur">${esc(msgErreur(error))}</p></div>`; return; }
    etat.rapport = data;
    // Liste des pays disponibles
    const sel = document.getElementById('pays');
    const courant = sel.value;
    sel.innerHTML = '<option value="">Tous les pays</option>' + (data.pays_disponibles || []).map((c) =>
      `<option value="${esc(c)}"${c === courant ? ' selected' : ''}>${esc(nomPays(c))}</option>`).join('');
    document.getElementById('sous-titre').textContent = `Du ${jourCourt(d0)} au ${jourCourt(d1)} · mis à jour à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    dessiner();
  }

  // ------------------------------------------------------------------
  // Rendu des pages
  // ------------------------------------------------------------------
  function detruireGraphiques() { etat.graphiques.forEach((g) => g.destroy()); etat.graphiques = []; }

  function dessiner() {
    detruireGraphiques();
    const r = etat.rapport;
    if (!r) return;
    const pages = { ensemble: pageEnsemble, produits: pageProduits, clients: pageClients, surmesure: pageSurMesure, rapports: pageRapports };
    (pages[etat.page] || pageEnsemble)(r);
  }

  function ecart(a, b) {
    a = Number(a) || 0; b = Number(b) || 0;
    if (!b) return a ? '<span class="ecart neutre">Nouveau</span>' : '<span class="ecart neutre">—</span>';
    const p = ((a - b) / b) * 100;
    const cls = p > 0.5 ? 'hausse' : p < -0.5 ? 'baisse' : 'neutre';
    const fl = p > 0.5 ? '▲' : p < -0.5 ? '▼' : '';
    return `<span class="ecart ${cls}">${fl} ${Math.abs(p).toFixed(1).replace('.', ',')} %</span>`;
  }
  const score = (libelle, valeur, a, b, extra) => `<div class="composant score g3${extra || ''}">
      <span class="libelle">${esc(libelle)}</span><span class="valeur">${valeur}</span>
      ${b === undefined ? '' : `${ecart(a, b)}<span class="compare">vs période précédente</span>`}</div>`;

  function entete(titre, sousTitre) {
    const p = etat.rapport.periode;
    return `<div class="entete-page"><h1>${esc(titre)}</h1><p>${esc(sousTitre || '')} Du ${jourCourt(p.debut)} au ${jourCourt(p.fin)}${document.getElementById('pays').value ? ' · ' + esc(nomPays(document.getElementById('pays').value)) : ''}</p></div>`;
  }

  function pageEnsemble(r) {
    const a = r.actuel, b = r.precedent, w = r.en_attente;
    vue.innerHTML = `<section class="page-rapport">
      ${entete('Vue d\'ensemble', 'Ventes, commandes et clients.')}
      <div class="grille">
        ${score('Chiffre d\'affaires encaissé', fcfa(a.ca), a.ca, b.ca)}
        ${score('Commandes passées', nombre(a.nb_commandes), a.nb_commandes, b.nb_commandes)}
        ${score('Panier moyen', fcfa(a.panier_moyen), a.panier_moyen, b.panier_moyen)}
        ${score('Nouveaux clients inscrits', nombre(a.inscrits), a.inscrits, b.inscrits)}
        <div class="composant g8"><h2>Chiffre d'affaires encaissé par jour</h2><p class="aide">Paiements validés par l'équipe, en F CFA.</p>
          <div class="zone-graphique haute"><canvas id="g-ca" aria-label="Chiffre d'affaires par jour"></canvas></div></div>
        <div class="composant g4"><h2>À traiter maintenant</h2><p class="aide">État actuel, indépendant de la période.</p>
          <div class="grille" style="gap:10px">
            ${score('Paiements à vérifier', nombre(w.paiements), 0, undefined, ' alerte" style="grid-column:span 6')}
            ${score('Montant en attente', compact(w.montant) + ' F', 0, undefined, '" style="grid-column:span 6')}
            ${score('Devis à envoyer', nombre(w.devis), 0, undefined, '" style="grid-column:span 6')}
            ${score('Remboursements', nombre(w.remboursements), 0, undefined, '" style="grid-column:span 6')}
          </div></div>
        <div class="composant g12"><h2>Commandes et inscriptions par jour</h2><p class="aide">Nombre par jour.</p>
          <div class="zone-graphique"><canvas id="g-activite" aria-label="Commandes et inscriptions par jour"></canvas></div></div>
      </div></section>`;

    const jours = r.serie.map((x) => jourCourt(x.jour));
    graphique('g-ca', {
      type: 'line',
      data: { labels: jours, datasets: [{ label: 'Chiffre d\'affaires', data: r.serie.map((x) => x.ca), borderColor: C[0],
        backgroundColor: 'rgba(26, 115, 232, .10)', fill: true, tension: .25, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5 }] },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false },
        tooltip: { callbacks: { label: (c) => ' ' + fcfa(c.parsed.y) } } },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true, ticks: { callback: (v) => compact(v) } } } }
    });
    graphique('g-activite', {
      type: 'bar',
      data: { labels: jours, datasets: [
        { label: 'Commandes', data: r.serie.map((x) => x.commandes), backgroundColor: C[0], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 },
        { label: 'Inscriptions', data: r.serie.map((x) => x.inscrits), backgroundColor: C[1], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 18 }] },
      options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'top', align: 'end' } },
        scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  function pageProduits(r) {
    const prods = r.produits || [];
    const max = Math.max(1, ...prods.map((p) => Number(p.ca)));
    const total = prods.reduce((s, p) => s + Number(p.ca), 0) || 1;
    const top = prods.slice(0, 10);
    vue.innerHTML = `<section class="page-rapport">
      ${entete('Produits', 'Chiffre d\'affaires et remplissage par campagne.')}
      <div class="grille">
        ${score('Campagnes publiées', nombre(prods.length))}
        ${score('Remplissage moyen', (prods.length ? Math.round(prods.reduce((s, p) => s + Number(p.remplissage || 0), 0) / prods.length) : 0) + ' %')}
        ${score('Unités vendues', nombre(prods.reduce((s, p) => s + Number(p.quantite || 0), 0)))}
        ${score('Chiffre d\'affaires des campagnes', fcfa(total === 1 && !prods.length ? 0 : total))}
        <div class="composant g6"><h2>Top 10 des produits par chiffre d'affaires</h2><p class="aide">Commandes payées ou livrées, en F CFA.</p>
          <div class="zone-graphique haute"><canvas id="g-top" aria-label="Top produits"></canvas></div></div>
        <div class="composant g6"><h2>Remplissage des campagnes</h2><p class="aide">Part du quota déjà payée.</p>
          <div class="zone-graphique haute"><canvas id="g-remp" aria-label="Remplissage des campagnes"></canvas></div></div>
        <div class="composant g12"><h2>Détail par produit</h2>
          <div class="tableau-conteneur"><table>
            <thead><tr><th></th><th>Produit</th><th>Statut</th><th class="num">Clients</th><th class="num">Unités / quota</th><th class="num">Remplissage</th><th class="num">Chiffre d'affaires</th><th class="num">Part du CA</th></tr></thead>
            <tbody>${prods.length ? prods.map((p, i) => `<tr><td class="rang">${i + 1}.</td><td>${esc(p.titre)}</td><td><span class="pastille">${esc(lib(p.statut))}</span></td>
              <td class="num">${nombre(p.clients)}</td><td class="num">${nombre(p.quantite)} / ${nombre(p.quota)}</td>
              <td class="num"><span class="barre-cellule orange"><i style="width:${Math.min(100, p.remplissage || 0) * 0.6}px"></i>${nombre(p.remplissage || 0)} %</span></td>
              <td class="num"><span class="barre-cellule"><i style="width:${(Number(p.ca) / max) * 80}px"></i>${fcfa(p.ca)}</span></td>
              <td class="num">${(100 * Number(p.ca) / total).toFixed(1).replace('.', ',')} %</td></tr>`).join('')
              : '<tr><td colspan="8" class="vide">Aucune campagne publiée.</td></tr>'}</tbody></table></div></div>
      </div></section>`;
    graphique('g-top', {
      type: 'bar',
      data: { labels: top.map((p) => p.titre), datasets: [{ label: 'Chiffre d\'affaires', data: top.map((p) => p.ca), backgroundColor: C[0], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + fcfa(c.parsed.x) } } },
        scales: { x: { beginAtZero: true, ticks: { callback: (v) => compact(v) } }, y: { grid: { display: false }, ticks: { autoSkip: false, callback(v) { const t = this.getLabelForValue(v); return t.length > 22 ? t.slice(0, 21) + '…' : t; } } } } }
    });
    graphique('g-remp', {
      type: 'bar',
      data: { labels: top.map((p) => p.titre), datasets: [{ label: 'Remplissage', data: top.map((p) => Math.min(100, p.remplissage || 0)), backgroundColor: C[1], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 22 }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + c.parsed.x + ' % du quota' } } },
        scales: { x: { min: 0, max: 100, ticks: { callback: (v) => v + ' %' } }, y: { grid: { display: false }, ticks: { autoSkip: false, callback(v) { const t = this.getLabelForValue(v); return t.length > 22 ? t.slice(0, 21) + '…' : t; } } } } }
    });
  }

  function pageClients(r) {
    const geo = r.geo || [];
    const totalClients = geo.reduce((s, g) => s + Number(g.clients), 0);
    const totalAcheteurs = geo.reduce((s, g) => s + Number(g.acheteurs), 0);
    const parPays = {};
    geo.forEach((g) => { parPays[g.pays] = (parPays[g.pays] || 0) + Number(g.clients); });
    const pays = Object.entries(parPays).sort((x, y) => y[1] - x[1]);
    const regions = geo.slice(0, 12);
    const maxC = Math.max(1, ...geo.map((g) => Number(g.clients)));
    vue.innerHTML = `<section class="page-rapport">
      ${entete('Clients', 'Où sont vos clients, et combien achètent.')}
      <div class="grille">
        ${score('Clients inscrits (total)', nombre(totalClients))}
        ${score('Clients ayant acheté', nombre(totalAcheteurs))}
        ${score('Taux d\'achat', totalClients ? Math.round(100 * totalAcheteurs / totalClients) + ' %' : '—')}
        ${score('Clients actifs sur la période', nombre(r.actuel.clients_actifs), r.actuel.clients_actifs, r.precedent.clients_actifs)}
        <div class="composant g4"><h2>Clients par pays</h2><p class="aide">Pays déclaré à l'inscription.</p>
          <div class="zone-graphique"><canvas id="g-pays" aria-label="Clients par pays"></canvas></div></div>
        <div class="composant g8"><h2>Clients par région</h2><p class="aide">Les 12 premières régions.</p>
          <div class="zone-graphique"><canvas id="g-regions" aria-label="Clients par région"></canvas></div></div>
        <div class="composant g12"><h2>Détail par pays et région</h2>
          <div class="tableau-conteneur"><table>
            <thead><tr><th></th><th>Pays</th><th>Région</th><th class="num">Clients</th><th class="num">Ont acheté</th><th class="num">Taux d'achat</th></tr></thead>
            <tbody>${geo.length ? geo.map((g, i) => `<tr><td class="rang">${i + 1}.</td><td>${esc(nomPays(g.pays))}</td><td>${esc(g.region)}</td>
              <td class="num"><span class="barre-cellule"><i style="width:${(Number(g.clients) / maxC) * 80}px"></i>${nombre(g.clients)}</span></td>
              <td class="num">${nombre(g.acheteurs)}</td><td class="num">${g.clients ? Math.round(100 * g.acheteurs / g.clients) : 0} %</td></tr>`).join('')
              : '<tr><td colspan="6" class="vide">Aucun client inscrit.</td></tr>'}</tbody></table></div></div>
      </div></section>`;
    graphique('g-pays', {
      type: 'doughnut',
      data: { labels: pays.map(([c]) => nomPays(c)), datasets: [{ data: pays.map(([, n]) => n), backgroundColor: pays.map((_, i) => C[i % C.length]), borderColor: '#fff', borderWidth: 2 }] },
      options: { cutout: '62%', plugins: { legend: { position: 'bottom' } } }
    });
    graphique('g-regions', {
      type: 'bar',
      data: { labels: regions.map((g) => g.region + (pays.length > 1 ? ' (' + g.pays + ')' : '')), datasets: [
        { label: 'Clients', data: regions.map((g) => g.clients), backgroundColor: C[0], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 26 },
        { label: 'Ont acheté', data: regions.map((g) => g.acheteurs), backgroundColor: C[1], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 26 }] },
      options: { plugins: { legend: { position: 'top', align: 'end' } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  function pageSurMesure(r) {
    const e = r.entonnoir || {};
    const etapes = [['Demandes reçues', e.recues], ['Chiffrées', e.chiffrees], ['Devis acceptés', e.acceptees], ['Payées', e.payees]];
    const max = Math.max(1, Number(e.recues) || 0);
    const ops = r.operateurs || [];
    const st = r.commandes_statut || [];
    vue.innerHTML = `<section class="page-rapport">
      ${entete('Sur mesure et paiements', 'Conversion des demandes, moyens de paiement, état des commandes.')}
      <div class="grille">
        ${score('Demandes sur mesure', nombre(r.actuel.demandes), r.actuel.demandes, r.precedent.demandes)}
        ${score('Taux de conversion', e.recues ? Math.round(100 * e.payees / e.recues) + ' %' : '—')}
        ${score('Paiements validés', nombre(r.actuel.nb_paiements), r.actuel.nb_paiements, r.precedent.nb_paiements)}
        ${score('Paiements à vérifier', nombre(r.en_attente.paiements), 0, undefined, ' alerte')}
        <div class="composant g6"><h2>Entonnoir des demandes sur mesure</h2><p class="aide">De la demande au paiement.</p>
          <div class="entonnoir">${etapes.map(([l, n]) => `<div class="etape-entonnoir"><span>${l}</span>
            <div class="piste"><i style="width:${(100 * (Number(n) || 0)) / max}%"></i></div><b>${nombre(n)}</b></div>`).join('')}</div></div>
        <div class="composant g6"><h2>Encaissements par opérateur</h2><p class="aide">Paiements validés sur la période, en F CFA.</p>
          <div class="zone-graphique"><canvas id="g-ops" aria-label="Encaissements par opérateur"></canvas></div></div>
        <div class="composant g12"><h2>Commandes par statut</h2><p class="aide">Commandes passées sur la période.</p>
          <div class="zone-graphique"><canvas id="g-statuts" aria-label="Commandes par statut"></canvas></div></div>
      </div></section>`;
    graphique('g-ops', {
      type: 'doughnut',
      data: { labels: ops.map((o) => lib(o.operateur)), datasets: [{ data: ops.map((o) => o.montant), backgroundColor: ops.map((_, i) => C[i % C.length]), borderColor: '#fff', borderWidth: 2 }] },
      options: { cutout: '62%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => ' ' + c.label + ' : ' + fcfa(c.parsed) } } } }
    });
    graphique('g-statuts', {
      type: 'bar',
      data: { labels: st.map((s) => lib(s.statut)), datasets: [{ label: 'Commandes', data: st.map((s) => s.nb), backgroundColor: C[0], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 48 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }

  function graphique(id, config) {
    const el = document.getElementById(id);
    if (!el || !window.Chart) return;
    etat.graphiques.push(new Chart(el, config));
  }

  // ------------------------------------------------------------------
  // Partage des analyses (admin uniquement)
  // ------------------------------------------------------------------
  async function ouvrirPartage() {
    const dlg = document.getElementById('dlg-partage');
    await listerPartages();
    dlg.showModal();
  }
  async function listerPartages() {
    const zone = document.getElementById('liste-partages');
    const { data, error } = await sb.from('acces_data').select('*').order('created_at');
    if (error) { zone.innerHTML = `<p class="erreur">${esc(msgErreur(error))}</p>`; return; }
    zone.innerHTML = `<div class="partage"><span><b>${esc(etat.session.user.email)}</b> <small>(vous)</small></span><span class="pastille">Propriétaire</span></div>`
      + (data || []).map((a) => `<div class="partage"><b>${esc(a.email)}</b>
          <span><select data-email="${esc(a.email)}" aria-label="Niveau de ${esc(a.email)}">
            <option value="lecteur"${a.niveau === 'lecteur' ? ' selected' : ''}>Lecteur</option>
            <option value="editeur"${a.niveau === 'editeur' ? ' selected' : ''}>Éditeur</option></select>
          <button class="lien-texte bouton-danger" data-retirer="${esc(a.email)}">Retirer</button></span></div>`).join('');
    zone.querySelectorAll('select[data-email]').forEach((s) => s.addEventListener('change', async () => {
      const { error: e } = await sb.from('acces_data').update({ niveau: s.value }).eq('email', s.dataset.email);
      if (e) alerteFlottante(msgErreur(e));
    }));
    zone.querySelectorAll('[data-retirer]').forEach((b) => b.addEventListener('click', async () => {
      const { error: e } = await sb.from('acces_data').delete().eq('email', b.dataset.retirer);
      if (e) alerteFlottante(msgErreur(e)); else listerPartages();
    }));
  }
  function brancherPartage() {
    document.getElementById('form-partage').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const email = document.getElementById('partage-email').value.trim().toLowerCase();
      const { error } = await sb.from('acces_data').upsert({ email, niveau: document.getElementById('partage-niveau').value });
      if (error) { alerteFlottante(msgErreur(error)); return; }
      document.getElementById('partage-email').value = '';
      listerPartages();
    });
  }
  function alerteFlottante(t) {
    const z = document.getElementById('liste-partages');
    z.insertAdjacentHTML('afterbegin', `<p class="erreur">${esc(t)}</p>`);
  }

  // ------------------------------------------------------------------
  // Mes rapports : tableaux de bord personnalisés
  // ------------------------------------------------------------------
  const SOURCES = [['commandes', 'Commandes'], ['paiements', 'Paiements'], ['demandes', 'Demandes sur mesure'], ['clients', 'Clients inscrits'], ['campagnes', 'Campagnes']];
  const MESURES = [['nombre', 'Nombre'], ['somme', 'Montant total (F)'], ['moyenne', 'Montant moyen (F)'], ['clients', 'Clients distincts'], ['quantite', 'Quantité']];
  const DIMENSIONS = [['aucune', 'Aucune (total)'], ['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['statut', 'Statut'], ['pays', 'Pays'],
    ['region', 'Région'], ['produit', 'Produit'], ['operateur', 'Opérateur Mobile Money']];
  const TYPES = [['score', 'Carte de score'], ['courbe', 'Courbe'], ['barres', 'Barres verticales'], ['barres_h', 'Barres horizontales'], ['anneau', 'Anneau'], ['tableau', 'Tableau']];
  const libDe = (liste, v) => (liste.find((x) => x[0] === v) || [v, v])[1];
  const peutEditer = () => ['admin', 'editeur'].includes(etat.niveau);

  async function pageRapports() {
    if (etat.rapportOuvert) return afficherRapport(etat.rapportOuvert);
    const { data, error } = await sb.from('rapports').select('id,titre,description,config,updated_at').order('updated_at', { ascending: false });
    if (error) { vue.innerHTML = `<section class="page-rapport"><p class="erreur">${esc(msgErreur(error))}</p></section>`; return; }
    vue.innerHTML = `<section class="page-rapport">
      <div class="entete-page"><h1>Mes rapports</h1><p>Vos tableaux de bord personnalisés, sur la période et le pays choisis en haut.</p></div>
      <div class="liste-rapports">
        ${peutEditer() ? '<button class="carte-rapport nouveau" id="nouveau-rapport">+ Nouveau rapport</button>' : ''}
        ${(data || []).map((r) => `<button class="carte-rapport" data-id="${r.id}"><b>${esc(r.titre)}</b>
          <span>${(r.config.graphiques || []).length} graphique(s) · modifié le ${new Date(r.updated_at).toLocaleDateString('fr-FR')}</span>
          ${r.description ? `<span>${esc(r.description)}</span>` : ''}</button>`).join('')}
      </div>
      ${!(data || []).length && !peutEditer() ? '<p class="vide">Aucun rapport pour le moment.</p>' : ''}
    </section>`;
    vue.querySelectorAll('.carte-rapport[data-id]').forEach((b) => b.addEventListener('click', () => { etat.rapportOuvert = b.dataset.id; dessiner(); }));
    const n = document.getElementById('nouveau-rapport');
    if (n) n.addEventListener('click', async () => {
      const { data: r, error: e } = await sb.from('rapports').insert({ titre: 'Nouveau rapport', config: { graphiques: [] } }).select('id').single();
      if (e) { alert(msgErreur(e)); return; }
      etat.rapportOuvert = r.id; dessiner();
    });
  }

  async function afficherRapport(id) {
    const { data: r, error } = await sb.from('rapports').select('*').eq('id', id).maybeSingle();
    if (error || !r) { etat.rapportOuvert = null; return pageRapports(); }
    etat.rapportCourant = r;
    const gs = r.config.graphiques || [];
    vue.innerHTML = `<section class="page-rapport">
      <div class="entete-page">
        <div style="flex:1;min-width:0">
          ${peutEditer() ? `<input class="titre-editable" id="titre-rapport" value="${esc(r.titre)}" aria-label="Titre du rapport">` : `<h1>${esc(r.titre)}</h1>`}
        </div>
        <div class="outils-rapport">
          <button class="bouton-secondaire" id="retour-rapports">← Tous les rapports</button>
          ${peutEditer() ? `<button class="bouton-partage" id="ajouter-graphique">+ Ajouter un graphique</button>
            <button class="bouton-secondaire bouton-danger" id="supprimer-rapport">Supprimer</button>` : ''}
        </div>
      </div>
      <div class="grille" id="grille-rapport">
        ${gs.length ? gs.map((g, i) => `<div class="composant g${g.largeur || 6}" id="w-${i}">
            ${peutEditer() ? `<span class="outils-graphique"><button data-modifier="${i}">Modifier</button><button data-supprimer="${i}">Supprimer</button></span>` : ''}
            <h2>${esc(g.titre)}</h2><p class="aide">${esc(libDe(MESURES, g.mesure))} · ${esc(libDe(SOURCES, g.source))}${g.dimension !== 'aucune' ? ' par ' + esc(libDe(DIMENSIONS, g.dimension).toLowerCase()) : ''}</p>
            <div class="corps-graphique"><div class="chargement" style="padding:24px">Chargement…</div></div></div>`).join('')
          : `<div class="composant g12 vide">${peutEditer() ? 'Ce rapport est vide. Cliquez sur « Ajouter un graphique ».' : 'Ce rapport est vide.'}</div>`}
      </div></section>`;

    document.getElementById('retour-rapports').addEventListener('click', () => { etat.rapportOuvert = null; dessiner(); });
    if (peutEditer()) {
      const t = document.getElementById('titre-rapport');
      t.addEventListener('change', () => enregistrerRapport({ titre: t.value.trim() || 'Sans titre' }));
      document.getElementById('ajouter-graphique').addEventListener('click', () => ouvrirEditeur(null));
      document.getElementById('supprimer-rapport').addEventListener('click', async (ev) => {
        const b = ev.currentTarget;
        if (b.dataset.confirme !== '1') { b.dataset.confirme = '1'; b.textContent = 'Confirmer la suppression'; return; }
        await sb.from('rapports').delete().eq('id', r.id);
        etat.rapportOuvert = null; dessiner();
      });
      vue.querySelectorAll('[data-modifier]').forEach((b) => b.addEventListener('click', () => ouvrirEditeur(Number(b.dataset.modifier))));
      vue.querySelectorAll('[data-supprimer]').forEach((b) => b.addEventListener('click', async () => {
        const liste = gs.slice(); liste.splice(Number(b.dataset.supprimer), 1);
        await enregistrerRapport({ config: { ...r.config, graphiques: liste } }); dessiner();
      }));
    }
    // Données de chaque graphique
    gs.forEach((g, i) => rendreGraphique(document.querySelector(`#w-${i} .corps-graphique`), g, 'rp-' + i));
  }

  async function enregistrerRapport(champs) {
    const { error } = await sb.from('rapports').update(champs).eq('id', etat.rapportCourant.id);
    if (error) alert(msgErreur(error));
    else Object.assign(etat.rapportCourant, champs);
  }

  async function donnees(g) {
    const [d0, d1] = bornes();
    const { data, error } = await sb.rpc('explorer', {
      p_source: g.source, p_dimension: g.type === 'score' ? 'aucune' : g.dimension, p_mesure: g.mesure,
      p_debut: d0, p_fin: d1, p_pays: document.getElementById('pays').value || null, p_limite: 100
    });
    if (error) throw error;
    return data || [];
  }

  const libelleLisible = (dim, v) => {
    if (dim === 'statut') return lib(v);
    if (dim === 'pays') return nomPays(v);
    if (dim === 'operateur') return lib(v);
    if (dim === 'jour' || dim === 'semaine') return jourCourt(v);
    if (dim === 'mois') return new Date(v + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
    return v;
  };
  const valeurLisible = (mesure, v) => (['somme', 'moyenne'].includes(mesure) ? fcfa(v) : nombre(v));

  async function rendreGraphique(zone, g, idCanvas) {
    if (!zone) return;
    let lignes;
    try { lignes = await donnees(g); }
    catch (e) { zone.innerHTML = `<p class="erreur">${esc(msgErreur(e))}</p>`; return; }
    const dim = g.type === 'score' ? 'aucune' : g.dimension;
    if (g.type === 'score') {
      const v = lignes.length ? lignes[0].valeur : 0;
      zone.innerHTML = `<div class="score"><span class="valeur">${valeurLisible(g.mesure, v)}</span></div>`;
      return;
    }
    if (!lignes.length) { zone.innerHTML = '<p class="vide" style="padding:24px">Aucune donnée sur cette période.</p>'; return; }
    const libelles = lignes.map((l) => libelleLisible(dim, l.libelle));
    const valeurs = lignes.map((l) => Number(l.valeur));
    if (g.type === 'tableau') {
      const max = Math.max(1, ...valeurs);
      zone.innerHTML = `<div class="tableau-conteneur"><table><thead><tr><th></th><th>${esc(libDe(DIMENSIONS, dim))}</th><th class="num">${esc(libDe(MESURES, g.mesure))}</th></tr></thead>
        <tbody>${lignes.map((l, i) => `<tr><td class="rang">${i + 1}.</td><td>${esc(libelles[i])}</td>
          <td class="num"><span class="barre-cellule"><i style="width:${(valeurs[i] / max) * 80}px"></i>${valeurLisible(g.mesure, l.valeur)}</span></td></tr>`).join('')}</tbody></table></div>`;
      return;
    }
    zone.innerHTML = `<div class="zone-graphique"><canvas id="${idCanvas}" aria-label="${esc(g.titre)}"></canvas></div>`;
    const fmt = (v) => valeurLisible(g.mesure, v);
    const axe = { beginAtZero: true, ticks: { callback: (v) => (['somme', 'moyenne'].includes(g.mesure) ? compact(v) : nombre(v)) } };
    let config;
    if (g.type === 'anneau') {
      config = { type: 'doughnut', data: { labels: libelles, datasets: [{ data: valeurs, backgroundColor: libelles.map((_, i) => C[i % C.length]), borderColor: '#fff', borderWidth: 2 }] },
        options: { cutout: '62%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => ' ' + c.label + ' : ' + fmt(c.parsed) } } } } };
    } else if (g.type === 'courbe') {
      config = { type: 'line', data: { labels: libelles, datasets: [{ label: g.titre, data: valeurs, borderColor: C[0], backgroundColor: 'rgba(26, 115, 232, .10)', fill: true, tension: .25, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5 }] },
        options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + fmt(c.parsed.y) } } },
          scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 8 } }, y: axe } } };
    } else {
      const horiz = g.type === 'barres_h';
      config = { type: 'bar', data: { labels: libelles, datasets: [{ label: g.titre, data: valeurs, backgroundColor: C[0], borderRadius: 4, borderSkipped: 'start', maxBarThickness: 36 }] },
        options: { indexAxis: horiz ? 'y' : 'x', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ' ' + fmt(horiz ? c.parsed.x : c.parsed.y) } } },
          scales: horiz ? { x: axe, y: { grid: { display: false } } } : { x: { grid: { display: false } }, y: axe } } };
    }
    graphique(idCanvas, config);
  }

  // Éditeur de graphique (ajout ou modification)
  let indexEdite = null;
  let apercuGraphique = null;
  function remplirSelect(id, liste) {
    document.getElementById(id).innerHTML = liste.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  }
  function lireEditeur() {
    const v = (id) => document.getElementById(id).value;
    return { titre: v('gx-titre').trim() || 'Sans titre', source: v('gx-source'), mesure: v('gx-mesure'), dimension: v('gx-dimension'),
             type: v('gx-type'), largeur: Number(v('gx-largeur')) };
  }
  function ouvrirEditeur(i) {
    indexEdite = i;
    const g = i === null ? { titre: '', source: 'paiements', mesure: 'somme', dimension: 'mois', type: 'barres', largeur: 6 }
      : etat.rapportCourant.config.graphiques[i];
    ['titre', 'source', 'mesure', 'dimension', 'type', 'largeur'].forEach((k) => { document.getElementById('gx-' + k).value = g[k]; });
    document.getElementById('titre-graphique').textContent = i === null ? 'Ajouter un graphique' : 'Modifier le graphique';
    document.getElementById('gx-valider').textContent = i === null ? 'Ajouter au rapport' : 'Enregistrer';
    document.getElementById('dlg-graphique').showModal();
    majApercu();
  }
  async function majApercu() {
    const g = lireEditeur();
    document.getElementById('gx-dimension').disabled = g.type === 'score';
    if (apercuGraphique) { apercuGraphique.destroy(); apercuGraphique = null; }
    const zone = document.getElementById('gx-apercu');
    zone.innerHTML = `<h2>${esc(g.titre)}</h2><div class="corps-graphique"></div>`;
    const avant = etat.graphiques.length;
    await rendreGraphique(zone.querySelector('.corps-graphique'), g, 'gx-canvas');
    if (etat.graphiques.length > avant) apercuGraphique = etat.graphiques.pop();
  }
  function brancherEditeur() {
    remplirSelect('gx-source', SOURCES); remplirSelect('gx-mesure', MESURES);
    remplirSelect('gx-dimension', DIMENSIONS); remplirSelect('gx-type', TYPES);
    ['gx-source', 'gx-mesure', 'gx-dimension', 'gx-type'].forEach((id) => document.getElementById(id).addEventListener('change', majApercu));
    document.getElementById('gx-titre').addEventListener('change', majApercu);
    document.getElementById('gx-annuler').addEventListener('click', () => document.getElementById('dlg-graphique').close());
    document.getElementById('dlg-graphique').addEventListener('close', () => { if (apercuGraphique) { apercuGraphique.destroy(); apercuGraphique = null; } });
    document.getElementById('form-graphique').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const g = lireEditeur();
      const liste = (etat.rapportCourant.config.graphiques || []).slice();
      if (indexEdite === null) liste.push(g); else liste[indexEdite] = g;
      await enregistrerRapport({ config: { ...etat.rapportCourant.config, graphiques: liste } });
      document.getElementById('dlg-graphique').close();
      dessiner();
    });
  }

  demarrer();
})();
