// Configuration partagée par le site public et l'espace équipe.
// La clé "publishable" est faite pour être publique : la sécurité est assurée
// par les règles RLS de la base, pas par le secret de cette clé.
window.IMPORT_PUBLIC_CONFIG = {
  supabaseUrl: 'https://bfmrdzxqrghioucmfyiq.supabase.co',
  supabaseKey: 'sb_publishable_uvIWQOX-EjHfOdgTIj4ugA_teO-08JS',
  nom: 'Import Public',
  // Adresses des deux sites (à changer quand le domaine sera acheté)
  urlSite: 'https://importpublic.com',
  urlEquipe: 'https://equipe.importpublic.com',
  urlData: 'https://data.importpublic.com'
};
