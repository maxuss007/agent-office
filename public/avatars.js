export const avatarMode = 'suits';
export const environment = 'webgl';
export const fruitIndex = { harvey: 0, mike: 1, louis: 2, donna: 3, jessica: 4, rachel: 5, harold: 6, scottie: 7, hardman: 2, jenny: 4, trevor: 1, tanner: 7, kyle: 6, norma: 3 };
const names = ['Banán', 'Avokádo', 'Ananas', 'Pomeranč', 'Jahoda', 'Mango', 'Pitaya', 'Citron'];
const main = { harvey: 0, mike: 1, louis: 2, donna: 3, jessica: 4, rachel: 5, harold: 6, scottie: 7 };
const extra = { hardman: 0, jenny: 1, trevor: 2, tanner: 3, kyle: 4, norma: 5 };
export const SUITS = { harvey: 'Harvey Specter', mike: 'Mike Ross', louis: 'Louis Litt', rachel: 'Rachel Zane', donna: 'Donna Paulsen', jessica: 'Jessica Pearson', harold: 'Harold Gunderson', norma: 'Norma', kyle: 'Kyle Durant', scottie: 'Dana Scott', hardman: 'Daniel Hardman', jenny: 'Jenny Griffith', trevor: 'Trevor Evans', tanner: 'Travis Tanner', benjamin: 'Benjamin', katrina: 'Katrina Bennett', gretchen: 'Gretchen Bodinski', alex: 'Alex Williams', robert: 'Robert Zane', samantha: 'Samantha Wheeler', edith: 'Edith Ross', stu: 'Stu Buzzini', moore: 'Soudkyně Moore', esther: 'Esther Litt', gallo: 'Frank Gallo', oliver: 'Oliver Grady', logan: 'Logan Sanders', tara: 'Tara Messer', marcus: 'Marcus Specter', sheila: 'Sheila Sazs', ava: 'Ava Hessington', soloff: 'Jack Soloff' };
const MAIN = ['harvey', 'donna', 'mike', 'rachel', 'louis'];
// A stable face for any agent without its own character: any cast member except the five leads.
export function face(id) { const pool = Object.keys(SUITS).filter((k) => !MAIN.includes(k)); let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return pool[(h >>> 0) % pool.length]; }
export function avatarName(character, fallback) { return avatarMode === 'fruit' ? names[fruitIndex[character] ?? 0] : SUITS[character] || fallback || 'Kolega'; }
function reloadView() {
  const url = new URL(location.href), repo = document.body.dataset.repo;
  if (document.body.dataset.view === 'office' && repo) { url.searchParams.set('view', 'office'); url.searchParams.set('repo', repo); }
  location.href = url.href;
}
window.OfficeAvatars = {
  mode: avatarMode, environment,
  name: avatarName, face,
  info(character) { return SUITS[character] ? { portrait: true, image: `/assets/suits/face/${character}.png` } : null; },
  toggle() { localStorage.setItem('office.avatarMode', avatarMode === 'fruit' ? 'suits' : 'fruit'); reloadView(); },
  toggleEnvironment() { localStorage.setItem('office.environment', environment === 'webgl' ? 'painted' : 'webgl'); reloadView(); },
};
