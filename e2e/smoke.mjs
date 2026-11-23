/**
 * Test end-to-end "smoke" dell'app in modalità demo, su un telefono simulato.
 *
 * Uso:  npm run test:e2e   (fa la build, avvia `vite preview` e lancia i test)
 * Prima volta: npx playwright install chromium
 *
 * Lo script ufficiale dell'IFrame API viene SOSTITUITO, solo in questo test,
 * da un finto player (fake-youtube-iframe-api.js): così il test non dipende
 * dalla rete né da YouTube e può simulare errori (es. embed disabilitato).
 * L'app reale carica sempre lo script ufficiale.
 */
import { chromium, devices } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SP = path.join(HERE, '..', 'test-results', 'e2e')
fs.mkdirSync(SP + '/shots', { recursive: true })
const PORT = 4173
const BASE = `http://localhost:${PORT}`
const fakeYt = fs.readFileSync(path.join(HERE, 'fake-youtube-iframe-api.js'), 'utf8')

// ── Audius simulato: due brani "lofi" e un file audio WAV di 2 secondi ──
function silentWav(seconds) {
  const rate = 8000
  const samples = rate * seconds
  const buf = Buffer.alloc(44 + samples * 2)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples * 2, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(samples * 2, 40)
  return buf
}
const WAV = silentWav(6)
const audiusTrack = (id, title, artist, genre = 'Lo-Fi') => ({
  id, title, duration: 2, genre, is_streamable: true, is_stream_gated: false, is_delete: false, is_available: true,
  access: { stream: true }, permalink: `/${artist}/${id}`, artwork: {}, user: { name: artist, handle: artist },
})
const AUDIUS_SEARCH = { data: [audiusTrack('AuA1', 'Notte in biblioteca', 'Studio Beats'), audiusTrack('AuB2', 'Pioggia sul campus', 'Studio Beats')] }
const AUDIUS_TRENDING = { data: [audiusTrack('AuT3', 'Caffè delle 8', 'Lofi Aula'), audiusTrack('AuT4', 'Appunti', 'Lofi Aula')] }

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const stopServer = () => server.kill()
for (let i = 0; i < 50; i++) {
  try {
    await fetch(BASE)
    break
  } catch {
    await new Promise((r) => setTimeout(r, 200))
  }
}
let failures = 0;
let currentPage = null;
function check(cond, msg) { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failures++; }

async function setup(ctx) {
  await ctx.route('https://www.youtube.com/iframe_api', (r) => r.fulfill({ contentType: 'text/javascript', body: fakeYt }));
  await ctx.route('https://i.ytimg.com/**', (r) => r.abort());
  await ctx.route('https://api.audius.co/**', (r) => {
    const url = new URL(r.request().url())
    if (url.pathname.endsWith('/stream')) return r.fulfill({ contentType: 'audio/wav', body: WAV })
    if (url.pathname.endsWith('/tracks/trending')) return r.fulfill({ json: AUDIUS_TRENDING })
    if (url.pathname.endsWith('/tracks/search')) {
      const q = url.searchParams.get('query') || ''
      return r.fulfill({ json: /lofi|studio/i.test(q) ? AUDIUS_SEARCH : { data: [] } })
    }
    return r.fulfill({ json: { data: [] } })
  });
}

try {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'block' });
  await setup(ctx);
  const page = await ctx.newPage();
  currentPage = page;
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/i\.ytimg|ERR_FAILED|service worker/i.test(m.text())) errors.push(m.text()); });
  const shot = (n) => page.screenshot({ path: `${SP}/shots/${n}.png` });

  // 1. Onboarding + login demo
  await page.goto(BASE + '/');
  await page.waitForURL('**/welcome');
  check(true, 'senza login → /welcome');
  await shot('01-onboarding');
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByRole('button', { name: 'Avanti' }).click();
  await page.getByRole('button', { name: 'Inizia' }).click();
  await page.waitForURL('**/login');
  await shot('02-login-demo');
  await page.getByLabel('Come ti chiami?').fill('Giulia');
  await page.getByRole('button', { name: 'Entra' }).click();
  await page.waitForURL(BASE + '/');
  await page.getByText("Playlist dell'università").waitFor();
  check(await page.getByText('Sessione esami').isVisible(), 'Home mostra le playlist dell’università (demo)');
  await shot('03-home-vuota');

  // 2. Ricerca
  await page.getByRole('link', { name: 'Cerca', exact: true }).click();
  await page.getByRole('searchbox').fill('queen');
  await page.getByText('Bohemian Rhapsody').first().waitFor();
  check(await page.getByText('Catalogo dimostrativo').isVisible(), 'avviso catalogo dimostrativo visibile');
  await shot('04-ricerca');

  // 3. Play → mini-player + player flottante 200x200
  await page.getByText('Bohemian Rhapsody').first().click();
  await page.waitForFunction(() => window.__ytLoads && window.__ytLoads.length === 1);
  const mini = page.getByRole('button', { name: /In riproduzione: Bohemian Rhapsody/ });
  await mini.waitFor();
  check(true, 'mini-player compare');
  await page.waitForTimeout(400);
  const fbox = await page.locator('iframe[data-fake-yt]').boundingBox();
  check(fbox && fbox.width >= 200 && fbox.height >= 200 && fbox.x >= 0 && fbox.y >= 0, `player flottante visibile ≥200×200 (${fbox && Math.round(fbox.width)}×${fbox && Math.round(fbox.height)} @${fbox && Math.round(fbox.x)},${fbox && Math.round(fbox.y)})`);
  await shot('05-mini-player-flottante');

  // 4. Full-screen
  await mini.click();
  await page.waitForURL('**/player');
  await page.waitForTimeout(400);
  const slot = await page.locator('div.aspect-square.bg-black').boundingBox();
  const ibox = await page.locator('iframe[data-fake-yt]').boundingBox();
  check(slot && ibox && Math.abs(slot.x - ibox.x) < 2 && Math.abs(slot.y - ibox.y) < 2 && Math.abs(slot.width - ibox.width) < 2, 'in full-screen l’iframe è sovrapposto al riquadro copertina');
  check(ibox.width >= 200 && ibox.height >= 200, `iframe full-screen ≥200×200 (${Math.round(ibox.width)}×${Math.round(ibox.height)})`);
  check(await page.evaluate(() => navigator.mediaSession.metadata && navigator.mediaSession.metadata.title) === 'Bohemian Rhapsody', 'Media Session: titolo impostato');
  check(await page.evaluate(() => navigator.mediaSession.metadata.artist) === 'Queen', 'Media Session: artista impostato');
  await shot('06-player-fullscreen');
  const ps = page.getByRole('dialog', { name: 'In riproduzione' });
  const loadsBefore = await page.evaluate(() => window.__ytLoads.length);
  await ps.getByRole('button', { name: 'Pausa', exact: true }).click();
  check((await page.evaluate(() => window.__ytCalls)).includes('pause'), 'pausa inviata al player');
  await ps.getByRole('button', { name: 'Riproduci', exact: true }).click();
  check(await page.evaluate((n) => window.__ytLoads.length === n, loadsBefore), 'play dopo pausa non ricarica il video');
  await ps.getByRole('button', { name: 'Attiva riproduzione casuale' }).click();
  check(await ps.getByRole('button', { name: 'Attiva Smart Shuffle' }).isVisible(), 'shuffle attivato (prossimo tocco: Smart Shuffle)');
  await ps.getByRole('button', { name: 'Attiva ripetizione' }).click();
  check(await ps.getByRole('button', { name: 'Ripeti un brano' }).isVisible(), 'ripetizione: tutto');
  await ps.getByRole('button', { name: 'Successivo' }).click();
  await page.waitForFunction((n) => window.__ytLoads.length === n + 1, loadsBefore);
  check(true, '“Successivo” carica il brano seguente');
  await ps.getByRole('button', { name: 'Precedente' }).click();
  await page.waitForFunction((n) => window.__ytLoads.length === n + 2, loadsBefore);
  check(true, '“Precedente” torna al brano prima');

  // 5. Coda
  await ps.getByRole('link', { name: 'Coda' }).click();
  await page.waitForURL('**/queue');
  await page.getByRole('dialog', { name: 'Coda' }).getByRole('heading', { name: 'In riproduzione' }).waitFor();
  check(true, 'pagina coda');
  await shot('07-coda');
  await page.goBack();
  await page.goBack();
  await page.waitForURL('**/search');

  // 6. Errore embed disabilitato → banner + salto automatico
  await page.evaluate(() => { window.__ytErrors['kJQP7kiw5Fk'] = 150; });
  const ytSection = page.getByRole('region', { name: 'YouTube' });
  await page.getByRole('searchbox').fill('fonsi');
  await ytSection.getByRole('button', { name: /Despacito/ }).first().waitFor();
  await page.waitForTimeout(600);
  await ytSection.getByRole('button', { name: /Despacito/ }).first().click();
  await page.getByText('Il creator non consente la riproduzione fuori da YouTube.').waitFor();
  check(true, 'errore 150 → messaggio “embed disabilitato”');
  await shot('08-errore-embed');

  // 7. Preferiti + playlist
  await page.getByRole('searchbox').fill('ed sheeran');
  await page.getByText('Shape of You').first().waitFor();
  await page.getByRole('button', { name: /Altre opzioni: Shape of You/ }).click();
  await shot('09-menu-brano');
  await page.getByRole('dialog').getByRole('button', { name: 'Aggiungi ai preferiti', exact: true }).click();
  await page.getByText('Aggiunto ai preferiti').waitFor();
  await page.getByRole('button', { name: /Altre opzioni: Perfect/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Aggiungi a playlist', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Nuova playlist', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Nome').fill('Studio serale');
  await page.getByRole('dialog').getByRole('button', { name: 'Crea', exact: true }).click();
  await page.getByText('Aggiunto a “Studio serale”').waitFor();
  check(true, 'playlist creata dal menu e brano aggiunto');
  await page.getByRole('link', { name: 'La tua libreria' }).click();
  await page.getByText('Brani che ti piacciono').waitFor();
  check(await page.getByRole('link', { name: /Brani che ti piacciono/ }).textContent().then((x) => x.includes('1 brano')), 'libreria: preferiti 1 brano');
  await shot('10-libreria');
  await page.getByRole('link', { name: /Studio serale/ }).click();
  await page.getByRole('heading', { name: 'Studio serale' }).waitFor();
  check(await page.getByText('Perfect').isVisible(), 'pagina playlist mostra il brano');
  await shot('11-playlist');

  // 8. Cronologia: accelera il tempo del finto player (30 s di ascolto)
  // La cronologia conta il tempo REALE di ascolto (30 s): aspettiamo davvero.
  await page.getByRole('button', { name: 'Riproduci', exact: true }).first().click();
  await page.waitForTimeout(31_500);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await page.getByRole('heading', { name: 'Riproduci di recente' }).waitFor();
  check(await page.locator('section').first().getByText('Perfect').isVisible(), 'dopo 30 s di ascolto il brano è in “Riproduci di recente”');
  check(await page.getByText('Scelti per te').isVisible(), 'sezione “Scelti per te”');
  await shot('12-home-piena');

  // 9. Riduci player flottante → pausa
  await page.getByRole('button', { name: 'Riduci il video (mette in pausa)' }).click();
  await page.waitForTimeout(200);
  const parked = await page.locator('iframe[data-fake-yt]').boundingBox();
  check(parked && parked.x < -1000, 'player ridotto: spostato fuori schermo');
  check(await page.getByRole('button', { name: 'Riproduci', exact: true }).isVisible(), 'player ridotto: in pausa');
  await page.getByRole('button', { name: 'Riproduci', exact: true }).click();
  await page.waitForTimeout(300);
  const back = await page.locator('iframe[data-fake-yt]').boundingBox();
  check(back && back.x >= 0 && back.width >= 200, 'play → il player ricompare visibile');

  // 10. Menu aperto → player flottante in alto, non coperto
  await page.getByRole('link', { name: 'Cerca', exact: true }).click();
  await page.getByRole('searchbox').fill('adele');
  await page.getByRole('button', { name: /Altre opzioni: Hello/ }).click();
  await page.waitForTimeout(300);
  const top = await page.locator('iframe[data-fake-yt]').boundingBox();
  const sheet = await page.getByRole('dialog').boundingBox();
  check(top && sheet && top.y + top.height <= sheet.y + 1, 'con un pannello aperto il player sale e non viene coperto');
  await shot('13-pannello-player-in-alto');
  await page.keyboard.press('Escape');

  // 11. Quota
  await page.getByRole('searchbox').fill('!quota');
  await page.getByText(/quota giornaliera di ricerche YouTube è esaurita/).waitFor();
  check(true, 'quota esaurita → messaggio con orario di reset');
  await shot('14-quota');

  // 11b. Audius: ricerca su due fonti, riproduzione audio, niente riquadro video
  await page.getByRole('searchbox').fill('lofi');
  const auSection = page.getByRole('region', { name: 'Audius' });
  await auSection.getByText('Notte in biblioteca').waitFor();
  check(await page.getByRole('region', { name: 'YouTube' }).isVisible(), 'ricerca su due fonti: sezione YouTube e sezione Audius');
  await shot('14b-ricerca-due-fonti');
  const ytLoadsBeforeAudius = await page.evaluate(() => window.__ytLoads.length);
  await auSection.getByText('Notte in biblioteca').click();
  await page.locator('[data-playback-status="playing"]').waitFor({ timeout: 10000 });
  check(true, 'brano Audius in riproduzione con <audio>');
  const parkedForAudio = await page.locator('iframe[data-fake-yt]').boundingBox();
  check(!parkedForAudio || parkedForAudio.x < -1000, 'brano Audius: nessun riquadro video visibile');
  check(await page.evaluate(() => navigator.mediaSession.metadata.title) === 'Notte in biblioteca', 'Media Session con brano Audius');
  check(await page.getByRole('button', { name: /In riproduzione: Notte in biblioteca/ }).getByText('Audius').isVisible(), 'mini-player: etichetta Audius 🌙');

  // 11c. Schermo spento: a fine brano Audius si salta il brano YouTube e si va al prossimo Audius
  await page.getByRole('searchbox').fill('ed sheeran');
  await page.getByText('Shape of You').first().waitFor();
  await page.getByRole('button', { name: /Altre opzioni: Shape of You/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Riproduci dopo' }).click();
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); });
  await page.getByRole('button', { name: /In riproduzione: Pioggia sul campus/ }).waitFor({ timeout: 15000 });
  check(await page.evaluate((n) => window.__ytLoads.length === n, ytLoadsBeforeAudius), 'schermo spento: saltato il brano YouTube, partito il prossimo Audius');
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); });
  await page.getByRole('button', { name: 'Pausa', exact: true }).click();

  // 11d. Smart Shuffle su una playlist: brani simili con ✨ nella coda
  await page.getByRole('link', { name: 'La tua libreria' }).click();
  await page.getByRole('link', { name: /Studio serale/ }).click();
  await page.getByRole('button', { name: /Smart Shuffle/ }).click();
  await page.getByRole('button', { name: /In riproduzione: Perfect/ }).click();
  await page.waitForURL('**/player');
  await page.getByRole('dialog', { name: 'In riproduzione' }).getByRole('link', { name: 'Coda' }).click();
  const queueDialog = page.getByRole('dialog', { name: 'Coda' });
  await queueDialog.getByText('Smart Shuffle attivo').waitFor({ timeout: 10000 });
  await queueDialog.getByText('Consigliato da Smart Shuffle').first().waitFor({ timeout: 10000 });
  const recCount = await queueDialog.getByText('Consigliato da Smart Shuffle').count();
  check(recCount >= 1, `Smart Shuffle: ${recCount} brani consigliati inseriti nella coda`);
  const sameArtist = (await queueDialog.getByText(/Shape of You|Thinking Out Loud/).count()) > 0;
  check(sameArtist, 'Smart Shuffle: consigliato un brano dello stesso artista (Ed Sheeran)');
  await shot('14c-smart-shuffle-coda');
  await page.goBack();
  await page.goBack();

  // 12. Offline: play bloccato con messaggio chiaro
  await page.getByRole('button', { name: 'Pausa', exact: true }).click();
  await ctx.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.getByText('Sei offline · connessione richiesta').waitFor();
  await page.getByRole('link', { name: 'La tua libreria' }).click();
  await page.getByRole('link', { name: /Studio serale/ }).click();
  await page.getByRole('heading', { name: 'Studio serale' }).waitFor();
  check(true, 'offline: playlist consultabile dalla cache');
  await page.getByRole('button', { name: 'Riproduci', exact: true }).first().click();
  await page.getByText('Connessione richiesta per riprodurre.').first().waitFor();
  check(true, 'offline: “Connessione richiesta per riprodurre”');
  await shot('15-offline');
  await ctx.setOffline(false);

  check(errors.length === 0, 'nessun errore JS in console' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();

  // ── Contesto con Service Worker: shell offline + ultima sessione ──
  const b2 = await chromium.launch();
  const c2 = await b2.newContext({ ...devices['Pixel 7'] });
  await setup(c2);
  const p2 = await c2.newPage();
  await p2.goto(BASE + '/welcome');
  await p2.evaluate(() => navigator.serviceWorker.ready);
  await p2.getByRole('button', { name: 'Salta' }).click();
  await p2.getByLabel('Come ti chiami?').fill('Luca');
  await p2.getByRole('button', { name: 'Entra' }).click();
  await p2.getByRole('link', { name: 'Cerca', exact: true }).click();
  await p2.getByRole('searchbox').fill('coldplay');
  await p2.getByText('Paradise').first().click();
  await p2.getByRole('button', { name: /In riproduzione: Paradise/ }).waitFor();
  await p2.getByRole('button', { name: 'Pausa', exact: true }).click();
  await c2.setOffline(true);
  await p2.reload();
  await p2.getByText('Sei offline').waitFor();
  check(await p2.getByRole('button', { name: /In riproduzione: Paradise/ }).isVisible(), 'SW: avvio offline con ultima sessione (mini-player ripristinato)');
  await p2.screenshot({ path: `${SP}/shots/16-avvio-offline.png` });
  await b2.close();

  console.log(failures ? `\n${failures} controlli FALLITI` : '\nTutti i controlli superati');
  stopServer();
  process.exit(failures ? 1 : 0);
} catch (e) {
  console.error(e);
  if (currentPage) await currentPage.screenshot({ path: `${SP}/shots/ERRORE.png` }).catch(() => {});
  stopServer();
  process.exit(1);
}
