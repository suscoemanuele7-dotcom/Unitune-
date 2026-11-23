/// <reference lib="webworker" />
/**
 * Service worker di UniTune (vite-plugin-pwa, strategia `injectManifest`).
 *
 * COSA METTIAMO IN CACHE: solo la "shell" statica dell'app (HTML, JS, CSS,
 * icone), elencata a build-time in `self.__WB_MANIFEST`.
 *
 * COSA NON METTIAMO IN CACHE, di proposito:
 * - nulla da youtube.com / youtube-nocookie.com / googlevideo.com: la
 *   riproduzione avviene solo nel player ufficiale IFrame, e salvare o
 *   intercettare i suoi contenuti violerebbe i Termini di YouTube;
 * - le risposte della YouTube Data API: passano dalla nostra Edge Function,
 *   che applica la propria cache nei limiti delle Developer Policies;
 * - le chiamate a Supabase (dati personali sempre aggiornati).
 * Non registriamo route di runtime: qualsiasi richiesta non precaricata va
 * direttamente in rete.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute, type PrecacheEntry } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | PrecacheEntry)[]
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA: ogni navigazione (anche offline) riceve index.html dalla cache,
// poi il router client decide cosa mostrare.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

// L'utente ha premuto "Aggiorna" nel prompt: attiva subito la nuova versione.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data: unknown = event.data
  if (typeof data === 'object' && data !== null && 'type' in data && data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

clientsClaim()
