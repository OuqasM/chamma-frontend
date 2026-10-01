/**
 * Writes the API's XML sitemap to the storefront as /sitemap.xml.
 *
 * Why a copy and not the API URL
 * ------------------------------
 * Search Console only accepts a sitemap on the host of the verified property.
 * The property is chammastore.com and the API answers on
 * api.chammastore.com, so the URL the sitemap is generated at is refused by
 * the form meant to accept it. Copying it here is the whole fix.
 *
 * Why a copy and not a proxy
 * --------------------------
 * Proxying /sitemap.xml to the API from .htaccess would keep it permanently
 * fresh, and it was tried first. It was dropped because this deploy does not
 * reliably ship new nested files or honour every rewrite rule, and a sitemap
 * that silently answers with index.html looks like a success while being
 * useless. A file that is either deployed and correct or visibly absent is the
 * better failure mode, and a plain file at the document root is known to
 * survive a deploy.
 *
 * Staleness
 * ---------
 * This runs on every build, so the committed copy matches the catalogue as of
 * the last deploy. After adding products, rebuild and redeploy for them to
 * appear here — Google is told about them by the sitemap, and only by it.
 */
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TARGET = path.join(ROOT, 'dist', 'sitemap.xml')

/** Reads the Vite env file so this and the bundle cannot disagree on the API host. */
async function readViteEnv(file = '.env.production') {
  const out = {}

  let raw = ''
  try {
    raw = await (await import('node:fs/promises')).readFile(path.join(ROOT, file), 'utf8')
  } catch {
    return out
  }

  for (const line of raw.split('\n')) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }

  return out
}

async function main() {
  const env = await readViteEnv()
  const api = (process.env.VITE_API_URL || env.VITE_API_URL || '').replace(/\/$/, '')

  if (!api) throw new Error('VITE_API_URL is not set, so the sitemap cannot be fetched')

  const res = await fetch(`${api}/api/sitemap.xml`, { headers: { Accept: 'application/xml' } })
  if (!res.ok) throw new Error(`GET /api/sitemap.xml → HTTP ${res.status}`)

  const xml = await res.text()
  const urls = (xml.match(/<loc>/g) ?? []).length

  if (!urls) throw new Error('the API returned a sitemap with no URLs; refusing to write it')

  // A pretty-printed HTML page here would be served as a sitemap and rejected,
  // which is the failure this whole change exists to remove. Say so plainly.
  if (!xml.trimStart().startsWith('<?xml')) {
    throw new Error('the API did not return XML — writing it as sitemap.xml would be worse than not writing it')
  }

  await writeFile(TARGET, xml, 'utf8')
  console.log(`sitemap: ${urls} URLs → dist/sitemap.xml`)
}

main().catch((error) => {
  console.error(`sitemap failed: ${error.message}`)
  process.exit(1)
})
