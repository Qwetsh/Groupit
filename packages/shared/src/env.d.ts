// Variables d'environnement injectées par Vite au build.
// Déclarées ici pour que le paquet se compile seul comme depuis une application
// (où `vite/client` déclare déjà `import.meta.env` : les interfaces fusionnent).
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
