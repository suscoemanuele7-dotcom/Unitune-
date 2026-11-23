/**
 * Dichiarazioni minime del runtime Deno usate dalle Edge Function, per poter
 * fare type-check con `tsc` senza installare Deno. Su Supabase il runtime
 * reale fornisce queste API.
 */
declare namespace Deno {
  const env: { get(key: string): string | undefined }
  function serve(handler: (request: Request) => Response | Promise<Response>): unknown
}
