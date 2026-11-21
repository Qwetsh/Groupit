// Test des règles d'accès du schéma groupit, avec des utilisateurs anonymes fictifs.
//
// Usage, depuis la racine du projet :  node supabase/tests/acces.test.mjs .
//
// Le test parle à la vraie base (il n'y en a qu'une) avec des données fictives.
// Il laisse derrière lui deux sessions (codes affichés en fin de test) et six
// utilisateurs anonymes (identifiants affichés) : personne ne peut les supprimer
// depuis une application, c'est voulu. Les retirer depuis l'éditeur SQL de
// Supabase, ou laisser le nettoyage automatique s'en charger à l'expiration.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const projectDir = resolve(process.argv[2] ?? '.');
const require = createRequire(join(projectDir, 'package.json'));
const { createClient } = require('@supabase/supabase-js');

const env = Object.fromEntries(
  readFileSync(join(projectDir, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter(l => l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const URL = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;

const client = () => createClient(URL, KEY, {
  db: { schema: 'groupit' },
  auth: { persistSession: false, autoRefreshToken: false },
});

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  ÉCHEC ${label} ${detail}`); }
};
const denied = r => !!r.error;
const rows = r => (r.data ?? []).length;

async function user(name) {
  const c = client();
  const { data, error } = await c.auth.signInAnonymously();
  if (error) throw new Error(`connexion ${name}: ${error.message}`);
  return { c, id: data.user.id, name };
}

const code = 'ZT' + Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'X');
const uids = [];

try {
  console.log('Visiteur non connecté');
  const visitor = client();
  check('ne lit pas les sessions', denied(await visitor.from('exam_sessions').select('id')));
  check('ne peut pas appeler join_jury', denied(await visitor.rpc('join_jury', { p_code: code, p_jury_number: 1 })));

  const owner = await user('organisateur');
  const juryA = await user('juré A');
  const juryB = await user('juré B');
  const juryC = await user('juré C');
  const dash = await user('tableau de bord');
  const stranger = await user('inconnu');
  uids.push(owner.id, juryA.id, juryB.id, juryC.id, dash.id, stranger.id);

  console.log('Organisateur : création');
  let r = await owner.c.rpc('claim_session', { p_code: 'AB', p_scenario_name: 'x', p_date_oral: null });
  check('code trop court refusé', r.data?.reason === 'invalid_code_format', JSON.stringify(r));
  r = await owner.c.rpc('claim_session', { p_code: code, p_scenario_name: 'Test fictif', p_date_oral: '2027-06-15' });
  check('session créée', r.data?.ok === true && r.data.created === true, JSON.stringify(r));
  const sessionId = r.data.session_id;
  const direction = r.data.direction_code;
  check('code direction remis à la création', /^[A-HJKMNP-Z2-9]{8}$/.test(direction ?? ''), JSON.stringify(r.data));
  check('insertion directe d\'une session refusée', denied(await owner.c.from('exam_sessions').insert({ code: 'ZZDIRECT', expires_at: new Date().toISOString() })));

  const j1 = await owner.c.from('session_jurys').insert({ session_id: sessionId, jury_number: 1, jury_name: 'Jury 1', mode: 'solo' }).select('id').single();
  const j2 = await owner.c.from('session_jurys').insert({ session_id: sessionId, jury_number: 2, jury_name: 'Jury 2', mode: 'solo' }).select('id').single();
  check('jurys créés', !!j1.data?.id && !!j2.data?.id, JSON.stringify([j1.error, j2.error]));
  const eleve = (jury, n) => ({ jury_id: jury, eleve_hash: `hash-${n}`, display_name: `Élève ${n}.`, classe: '3Z', ordre_passage: n, status: 'pending' });
  r = await owner.c.from('session_eleves').insert([eleve(j1.data.id, 1), eleve(j1.data.id, 2), eleve(j1.data.id, 3), eleve(j2.data.id, 4)]);
  check('élèves créés', !r.error, JSON.stringify(r.error));
  const all = await owner.c.from('session_eleves').select('id, jury_id, ordre_passage').order('ordre_passage');
  check('l\'organisateur relit ses 4 élèves', rows(all) === 4);
  const e1 = all.data[0].id, e2 = all.data[1].id, e4 = all.data[3].id;

  console.log('Inconnu');
  check('ne voit aucune session', rows(await stranger.c.from('exam_sessions').select('id')) === 0);
  check('ne voit aucun jury', rows(await stranger.c.from('session_jurys').select('id')) === 0);
  check('ne voit aucun élève', rows(await stranger.c.from('session_eleves').select('id')) === 0);
  check('ne peut pas supprimer les jurys', denied(await stranger.c.from('session_jurys').delete().eq('session_id', sessionId)));
  check('ne peut pas supprimer la session', denied(await stranger.c.from('exam_sessions').delete().eq('id', sessionId)));
  check('ne peut pas ajouter un jury', denied(await stranger.c.from('session_jurys').insert({ session_id: sessionId, jury_number: 9, jury_name: 'Pirate' })));
  check('ne peut pas ajouter un élève', denied(await stranger.c.from('session_eleves').insert(eleve(j1.data.id, 99))));
  check('ne peut pas modifier le verrou', rows(await stranger.c.from('exam_sessions').update({ locked: true }).eq('id', sessionId).select('id')) === 0);
  r = await stranger.c.rpc('claim_session', { p_code: code, p_scenario_name: 'vol', p_date_oral: null });
  check('ne peut pas reprendre la session', r.data?.reason === 'not_owner', JSON.stringify(r));
  check('ne peut pas s\'inscrire directement dans un jury', denied(await stranger.c.from('jury_members').insert({ jury_id: j1.data.id, slot: 'A' })));
  check('ne peut pas noter', denied(await stranger.c.from('final_scores').insert({ eleve_id: e1, total: 20 })));
  check('ne peut pas obtenir le code direction', (await stranger.c.rpc('get_direction_code', { p_code: code })).data === null);

  console.log('Jurés');
  r = await juryA.c.rpc('join_jury', { p_code: code.toLowerCase(), p_jury_number: 1 });
  check('juré A rejoint le jury 1 (emplacement A)', r.data?.ok && r.data.slot === 'A' && r.data.jury_id === j1.data.id, JSON.stringify(r));
  r = await juryB.c.rpc('join_jury', { p_code: code, p_jury_number: 1 });
  check('juré B rejoint le jury 1 (emplacement B)', r.data?.ok && r.data.slot === 'B', JSON.stringify(r));
  r = await juryA.c.rpc('join_jury', { p_code: code, p_jury_number: 1 });
  check('juré A retrouve son emplacement', r.data?.slot === 'A');
  r = await juryA.c.rpc('join_jury', { p_code: code, p_jury_number: 7 });
  check('jury inexistant signalé', r.data?.reason === 'jury_not_found');
  check('juré A lit sa session', rows(await juryA.c.from('exam_sessions').select('id, criteria_config').eq('id', sessionId)) === 1);
  check('juré A ne voit que ses 3 élèves', rows(await juryA.c.from('session_eleves').select('id')) === 3);
  check('juré A ne voit que son jury', rows(await juryA.c.from('session_jurys').select('id')) === 1);
  check('juré A met à jour le statut de son élève', rows(await juryA.c.from('session_eleves').update({ status: 'in_progress' }).eq('id', e1).select('id')) === 1);
  check('juré A ne touche pas l\'élève d\'un autre jury', rows(await juryA.c.from('session_eleves').update({ status: 'absent' }).eq('id', e4).select('id')) === 0);
  check('juré A ne peut pas renommer un élève', denied(await juryA.c.from('session_eleves').update({ display_name: 'X' }).eq('id', e1)));
  r = await juryA.c.from('evaluations').upsert({ eleve_id: e1, juror_slot: 'A', total: 15, scores: { a: 1 } }, { onConflict: 'eleve_id,juror_slot' });
  check('juré A enregistre son évaluation', !r.error, JSON.stringify(r.error));
  r = await juryA.c.from('evaluations').upsert({ eleve_id: e1, juror_slot: 'A', total: 16, scores: { a: 2 } }, { onConflict: 'eleve_id,juror_slot' });
  check('juré A corrige son évaluation', !r.error, JSON.stringify(r.error));
  check('juré A ne peut pas écrire à la place du juré B', denied(await juryA.c.from('evaluations').upsert({ eleve_id: e1, juror_slot: 'B', total: 1 }, { onConflict: 'eleve_id,juror_slot' })));
  r = await juryA.c.from('final_scores').upsert({ eleve_id: e1, total: 16, scores: { a: 2 } }, { onConflict: 'eleve_id' });
  check('juré A enregistre la note finale', !r.error, JSON.stringify(r.error));
  check('juré A ne note pas l\'élève d\'un autre jury', denied(await juryA.c.from('final_scores').upsert({ eleve_id: e4, total: 20 }, { onConflict: 'eleve_id' })));
  check('juré B lit la note finale de son jury', rows(await juryB.c.from('final_scores').select('id')) === 1);
  check('juré A ne peut pas supprimer une note', denied(await juryA.c.from('final_scores').delete().eq('eleve_id', e1)));
  r = await juryA.c.rpc('open_dashboard', { p_code: code });
  check("juré A n'ouvre pas le tableau de bord avec le seul code de session", r.data?.reason === 'direction_code_required', JSON.stringify(r));
  check('juré A ne voit toujours que son jury', rows(await juryA.c.from('session_jurys').select('id')) === 1);
  check('juré A ne peut pas verrouiller la session', rows(await juryA.c.from('exam_sessions').update({ locked: true }).eq('id', sessionId).select('id')) === 0);

  console.log('Tableau de bord');
  r = await dash.c.rpc('open_dashboard', { p_code: 'ZZNOPE99' });
  const unknown = r.data?.reason;
  r = await dash.c.rpc('open_dashboard', { p_code: code });
  check('sans code direction, même refus que la session existe ou non', unknown === 'direction_code_required' && r.data?.reason === 'direction_code_required', JSON.stringify(r));
  check("rien n'est lisible avant le code direction", rows(await dash.c.from('session_eleves').select('id')) === 0);
  r = await dash.c.rpc('open_dashboard', { p_code: 'ZZNOPE99', p_direction_code: direction });
  check('code de session inconnu refusé', r.data?.reason === 'invalid_code');
  r = await dash.c.rpc('open_dashboard', { p_code: code, p_direction_code: 'AAAAAAAA' });
  check('mauvais code direction refusé', r.data?.reason === 'invalid_code');
  r = await dash.c.rpc('open_dashboard', { p_code: code, p_direction_code: ` ${direction.slice(0, 4).toLowerCase()}-${direction.slice(4)} ` });
  check('ouverture avec le code direction (minuscules et tiret tolérés)', r.data?.ok && r.data.session_id === sessionId, JSON.stringify(r));
  r = await dash.c.rpc('open_dashboard', { p_code: code });
  check("le poste déjà autorisé n'a plus à ressaisir le code direction", r.data?.ok === true);
  check('lit la session', rows(await dash.c.from('exam_sessions').select('*').eq('id', sessionId)) === 1);
  check('lit les 2 jurys', rows(await dash.c.from('session_jurys').select('id')) === 2);
  check('lit les 4 élèves', rows(await dash.c.from('session_eleves').select('id')) === 4);
  check('lit les évaluations et la note', rows(await dash.c.from('evaluations').select('id')) === 1 && rows(await dash.c.from('final_scores').select('id')) === 1);
  check('ne peut pas noter', denied(await dash.c.from('final_scores').upsert({ eleve_id: e2, total: 3 }, { onConflict: 'eleve_id' })));
  check('ne peut pas changer le code', denied(await dash.c.from('exam_sessions').update({ code: 'ZZHACK01' }).eq('id', sessionId)));
  const grille = {
    categories: [{ id: 'oral', label: 'Oral' }],
    criteria: [{ id: 'c1', label: 'Critère', desc: '', categoryId: 'oral', max: 2, levels: [{ label: 'Acquis', shortLabel: 'A', value: 2 }] }],
  };
  const setGrille = g => dash.c.from('exam_sessions').update({ criteria_config: g }).eq('id', sessionId).select('id');
  check('grille mal formée refusée', denied(await setGrille({ test: true })));
  check('grille sans niveaux refusée', denied(await setGrille({ ...grille, criteria: [{ ...grille.criteria[0], levels: [] }] })));
  check('grille au mauvais format refusée', denied(await setGrille({ categories: 'x', criteria: 3 })));
  check('enregistre une grille valide', rows(await setGrille(grille)) === 1);
  check('revient à la grille par défaut', rows(await setGrille(null)) === 1);
  check('verrouille la session', rows(await dash.c.from('exam_sessions').update({ locked: true }).eq('id', sessionId).select('id')) === 1);

  console.log('Session verrouillée');
  check('le juré ne modifie plus un statut', rows(await juryA.c.from('session_eleves').update({ status: 'validated' }).eq('id', e1).select('id')) === 0);
  check('le juré ne modifie plus une note', denied(await juryA.c.from('final_scores').upsert({ eleve_id: e1, total: 1 }, { onConflict: 'eleve_id' })));
  check('le juré ne note plus un nouvel élève', denied(await juryB.c.from('final_scores').upsert({ eleve_id: e2, total: 1 }, { onConflict: 'eleve_id' })));
  r = await juryC.c.rpc('join_jury', { p_code: code, p_jury_number: 1 });
  check('on ne rejoint plus un jury', r.data?.reason === 'locked');
  check('le juré lit toujours la note', rows(await juryA.c.from('final_scores').select('total').eq('eleve_id', e1)) === 1);
  check('déverrouillage', rows(await dash.c.from('exam_sessions').update({ locked: false }).eq('id', sessionId).select('id')) === 1);

  console.log('Changement d\'appareil');
  r = await juryC.c.rpc('join_jury', { p_code: code, p_jury_number: 1 });
  check('un troisième appareil prend la place du plus ancien', r.data?.ok && r.data.slot === 'A', JSON.stringify(r));
  check('l\'ancien appareil ne voit plus les élèves', rows(await juryA.c.from('session_eleves').select('id')) === 0);
  check('le nouvel appareil note à sa place', !(await juryC.c.from('final_scores').upsert({ eleve_id: e2, total: 12 }, { onConflict: 'eleve_id' })).error);

  console.log('Organisateur : reprise');
  r = await owner.c.rpc('owned_session_score_count', { p_code: code });
  check('compte ses 2 notes', r.data === 2, JSON.stringify(r));
  r = await stranger.c.rpc('owned_session_score_count', { p_code: code });
  check('l\'inconnu n\'apprend rien du compteur', r.data === 0);
  r = await owner.c.rpc('claim_session', { p_code: code, p_scenario_name: 'Test fictif', p_date_oral: null });
  check('réexport refusé tant qu\'il y a des notes', r.data?.reason === 'has_scores' && r.data.score_count === 2, JSON.stringify(r));
  r = await owner.c.rpc('open_dashboard', { p_code: code });
  check('ouvre le tableau de bord sans code direction', r.data?.ok === true, JSON.stringify(r));
  check('retrouve son code direction', (await owner.c.rpc('get_direction_code', { p_code: code })).data === direction);
  check('ne peut pas supprimer la session directement', denied(await owner.c.from('exam_sessions').delete().eq('id', sessionId)));

  console.log('Limitation des essais');
  let last;
  for (let i = 0; i < 9; i++) last = await stranger.c.rpc('join_jury', { p_code: `ZZBAD${i}00`, p_jury_number: 1 });
  check('blocage après trop de codes faux', last.data?.reason === 'too_many_attempts', JSON.stringify(last.data));
  r = await stranger.c.rpc('open_dashboard', { p_code: code });
  check('le blocage vaut aussi pour le tableau de bord', r.data?.reason === 'too_many_attempts');

  console.log('Organisateur : réexport sans note');
  const code2 = 'ZU' + Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, 'X');
  r = await owner.c.rpc('claim_session', { p_code: code2, p_scenario_name: 'Test 2', p_date_oral: null });
  const s2 = r.data.session_id;
  await owner.c.from('session_jurys').insert({ session_id: s2, jury_number: 1, jury_name: 'Jury 1' });
  r = await owner.c.rpc('claim_session', { p_code: code2, p_scenario_name: 'Test 2 bis', p_date_oral: null });
  check('la reprise conserve le code direction', r.data?.direction_code === (await owner.c.rpc('get_direction_code', { p_code: code2 })).data && !!r.data?.direction_code);
  check('reprise acceptée, anciens jurys retirés', r.data?.ok && r.data.created === false && rows(await owner.c.from('session_jurys').select('id').eq('session_id', s2)) === 0, JSON.stringify(r));
  console.log(`CODES ${code} ${code2}`);
} catch (err) {
  fail++;
  console.log('ERREUR', err.message);
} finally {
  console.log(`UIDS ${uids.join(',')}`);
  console.log(`\nRésultat : ${pass} réussis, ${fail} en échec`);
}
