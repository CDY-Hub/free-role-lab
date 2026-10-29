/**
 * Rena parsers för Transfermarkt-HTML. Ingen nätverksåtkomst här, så koden går att testa.
 *
 * Strategin är att utgå från huvudlänken i varje rad (<td class="hauptlink"><a href=...>) och sedan
 * läsa kringliggande kolumner. Det är mer tåligt än att hitta hela <tr>-block, eftersom spelarrader
 * innehåller en nästlad tabell.
 */

export type TmPlayerHit = {
  id: string;
  name: string;
  imageUrl?: string | undefined;
  position?: string | undefined;
  age?: number | undefined;
  marketValue?: number | undefined;
  club?: { id?: string | undefined; name: string } | undefined;
  nationalities?: string[] | undefined;
};

export type TmClubHit = {
  id: string;
  name: string;
  country?: string | undefined;
  imageUrl?: string | undefined;
  squadSize?: number | undefined;
  marketValue?: number | undefined;
};

export type TmCoachHit = {
  id: string;
  name: string;
  imageUrl?: string | undefined;
};

const PLAYER_KIND = "profil/spieler";
const CLUB_KIND = "startseite/verein";
const COACH_KIND = "profil/trainer";

const POSITION_RX =
  /\b(Goalkeeper|Centre-Back|Left-Back|Right-Back|Defender|Defensive Midfield|Central Midfield|Attacking Midfield|Left Midfield|Right Midfield|Midfield|Left Winger|Right Winger|Second Striker|Centre-Forward|Striker|Attack|Forward)\b/;

// Vanliga namngivna entiteter i spelar- och klubbnamn (Gy&ouml;keres, &Oslash;degaard ...).
const NAMED_ENTITIES: Record<string, string> = {
  aacute: "á",
  Aacute: "Á",
  agrave: "à",
  acirc: "â",
  atilde: "ã",
  auml: "ä",
  Auml: "Ä",
  aring: "å",
  Aring: "Å",
  aelig: "æ",
  AElig: "Æ",
  ccedil: "ç",
  Ccedil: "Ç",
  eacute: "é",
  Eacute: "É",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  iacute: "í",
  Iacute: "Í",
  igrave: "ì",
  icirc: "î",
  iuml: "ï",
  ntilde: "ñ",
  Ntilde: "Ñ",
  oacute: "ó",
  Oacute: "Ó",
  ograve: "ò",
  ocirc: "ô",
  otilde: "õ",
  ouml: "ö",
  Ouml: "Ö",
  oslash: "ø",
  Oslash: "Ø",
  szlig: "ß",
  uacute: "ú",
  Uacute: "Ú",
  ugrave: "ù",
  ucirc: "û",
  uuml: "ü",
  Uuml: "Ü",
  yacute: "ý",
  yuml: "ÿ",
  scaron: "š",
  Scaron: "Š",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  eth: "ð",
  thorn: "þ",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&([A-Za-z]+);/g, (whole, name: string) => NAMED_ENTITIES[name] ?? whole)
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .trim();
}

export function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

/** "€150.00m" -> 150000000, "€800k" -> 800000, "-" -> undefined */
export function parseMarketValue(s?: string): number | undefined {
  if (!s) return undefined;
  const m = s.replace(/[€,\s]/g, "").match(/^([\d.]+)(bn|m|k|th\.)?$/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]!);
  if (!Number.isFinite(n)) return undefined;
  const unit = m[2]?.toLowerCase();
  if (unit === "bn") return Math.round(n * 1_000_000_000);
  if (unit === "m") return Math.round(n * 1_000_000);
  if (unit === "k" || unit === "th.") return Math.round(n * 1_000);
  return Math.round(n);
}

function absoluteUrl(src?: string): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("http")) return src;
  return undefined;
}

function attr(tag: string, name: string): string | undefined {
  const m = new RegExp(`${name}="([^"]*)"`, "i").exec(tag);
  return m ? decodeEntities(m[1]!) : undefined;
}

/** Sista bilden före huvudlänken vars <img>-tagg matchar `hint` (t.ex. "portrait" eller "wappen"). */
function imageBefore(html: string, index: number, hint: RegExp): string | undefined {
  const before = html.slice(Math.max(0, index - 900), index);
  const tags = before.match(/<img\b[^>]*>/gi) ?? [];
  for (let i = tags.length - 1; i >= 0; i--) {
    const tag = tags[i]!;
    if (!hint.test(tag)) continue;
    const src = attr(tag, "data-src") ?? attr(tag, "src");
    const url = absoluteUrl(src);
    if (url && !/default|placeholder/i.test(url)) return url;
  }
  return undefined;
}

type Anchor = { id: string; slug: string; name: string; index: number };

function mainAnchors(html: string, kind: string): Anchor[] {
  const rx = new RegExp(
    `<td[^>]*class="[^"]*hauptlink[^"]*"[^>]*>\\s*<a\\b([^>]*)href="/([^"/]+)/${kind}/(\\d+)[^"]*"([^>]*)>([\\s\\S]*?)</a>`,
    "gi",
  );
  const out: Anchor[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) {
    const id = m[3]!;
    if (seen.has(id)) continue;
    seen.add(id);
    const title = attr(`${m[1]} ${m[4]}`, "title");
    const text = stripTags(m[5]!);
    out.push({ id, slug: m[2]!, name: text || title || m[2]!, index: m.index });
  }
  return out;
}

function windowAfter(html: string, anchors: Anchor[], i: number): string {
  const start = anchors[i]!.index;
  const end = anchors[i + 1]?.index ?? Math.min(html.length, start + 3000);
  return html.slice(start, Math.min(end, start + 3000));
}

function flags(win: string): string[] {
  const tags = win.match(/<img\b[^>]*flaggenrahmen[^>]*>/gi) ?? [];
  const names = tags.map((t) => attr(t, "title")).filter((x): x is string => !!x);
  return [...new Set(names)];
}

function marketValueIn(win: string): number | undefined {
  const m = /<td[^>]*class="[^"]*rechts[^"]*hauptlink[^"]*"[^>]*>([\s\S]*?)<\/td>/i.exec(win);
  return m ? parseMarketValue(stripTags(m[1]!)) : undefined;
}

function ageIn(win: string): number | undefined {
  const plain = /<td[^>]*class="zentriert"[^>]*>\s*(\d{2})\s*<\/td>/i.exec(win);
  const born = /\((\d{2})\)\s*<\/td>/i.exec(win);
  const n = Number((plain ?? born)?.[1]);
  return Number.isFinite(n) && n >= 14 && n <= 50 ? n : undefined;
}

function clubIn(win: string): { id?: string | undefined; name: string } | undefined {
  const a = new RegExp(`<a\\b[^>]*title="([^"]+)"[^>]*href="/[^"/]+/${CLUB_KIND}/(\\d+)`, "i").exec(
    win,
  );
  if (a) return { id: a[2]!, name: decodeEntities(a[1]!) };
  const b = new RegExp(
    `<a\\b[^>]*href="/[^"/]+/${CLUB_KIND}/(\\d+)[^"]*"[^>]*title="([^"]+)"`,
    "i",
  ).exec(win);
  if (b) return { id: b[1]!, name: decodeEntities(b[2]!) };
  return undefined;
}

export function parsePlayers(html: string): TmPlayerHit[] {
  const anchors = mainAnchors(html, PLAYER_KIND);
  return anchors.map((a, i) => {
    const win = windowAfter(html, anchors, i);
    return {
      id: a.id,
      name: a.name,
      imageUrl: imageBefore(html, a.index, /portrait|bilderrahmen/i),
      position: POSITION_RX.exec(win)?.[1],
      age: ageIn(win),
      marketValue: marketValueIn(win),
      club: clubIn(win),
      nationalities: flags(win),
    };
  });
}

export function parseClubs(html: string): TmClubHit[] {
  const anchors = mainAnchors(html, CLUB_KIND);
  return anchors.map((a, i) => {
    const win = windowAfter(html, anchors, i);
    const squad = /<td[^>]*class="zentriert"[^>]*>\s*(\d{1,3})\s*<\/td>/i.exec(win);
    return {
      id: a.id,
      name: a.name,
      country: flags(win)[0],
      imageUrl: imageBefore(html, a.index, /wappen/i),
      squadSize: squad ? Number(squad[1]) : undefined,
      marketValue: marketValueIn(win),
    };
  });
}

export function parseCoaches(html: string): TmCoachHit[] {
  const anchors = mainAnchors(html, COACH_KIND);
  return anchors.map((a) => ({
    id: a.id,
    name: a.name,
    imageUrl: imageBefore(html, a.index, /portrait|bilderrahmen/i),
  }));
}

/** Svensk positionsgrupp för trupplistor. */
export function positionGroup(
  position?: string,
): "Målvakter" | "Försvarare" | "Mittfältare" | "Anfallare" | "Övriga" {
  const p = (position ?? "").toLowerCase();
  if (!p) return "Övriga";
  if (p.includes("keeper")) return "Målvakter";
  if (p.includes("back") || p.includes("defend")) return "Försvarare";
  if (p.includes("midfield")) return "Mittfältare";
  if (
    p.includes("winger") ||
    p.includes("forward") ||
    p.includes("striker") ||
    p.includes("attack")
  )
    return "Anfallare";
  return "Övriga";
}

// ─── Profilsidor (spelare, lag, tränare) ─────────────────────────────────────

export function exportFlags(html: string): string[] {
  return flags(html);
}

function imgFromTag(html: string, hint: RegExp): string | undefined {
  const tag = (html.match(/<img\b[^>]*>/gi) ?? []).find((t) => hint.test(t));
  if (!tag) return undefined;
  return absoluteUrl(attr(tag, "data-src") ?? attr(tag, "src"));
}

/** Etikett/värde-par från profilens faktaruta ("Height:", "Citizenship:" ...). */
export function parseInfoTable(html: string): Record<string, { text: string; flags: string[] }> {
  const out: Record<string, { text: string; flags: string[] }> = {};
  const rx = /info-table__content--regular[^>]*>([\s\S]*?)<\/span>/gi;
  const labels: { label: string; end: number; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(html)) !== null) {
    labels.push({
      label: stripTags(m[1]!).replace(/:$/, "").trim(),
      end: m.index + m[0].length,
      start: m.index,
    });
  }
  labels.forEach((l, i) => {
    const next = labels[i + 1]?.start ?? l.end + 1200;
    let chunk = html.slice(l.end, Math.min(next, l.end + 1200));
    const close = chunk.indexOf("</div>");
    if (close >= 0) chunk = chunk.slice(0, close);
    const text = stripTags(chunk);
    if (l.label && text && !(l.label in out)) out[l.label] = { text, flags: flags(chunk) };
  });
  return out;
}

export type TmProfileHeader = {
  name?: string | undefined;
  shirtNumber?: string | undefined;
  imageUrl?: string | undefined;
  marketValue?: number | undefined;
  club?: { id?: string | undefined; name: string } | undefined;
  info: Record<string, { text: string; flags: string[] }>;
};

export function parseProfileHeader(html: string): TmProfileHeader {
  const h1 = /<h1[^>]*data-header__headline-wrapper[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  let name: string | undefined;
  let shirtNumber: string | undefined;
  if (h1) {
    const text = stripTags(h1);
    const num = /^#\s*(\d{1,3})\s+/.exec(text);
    shirtNumber = num?.[1];
    name = text.replace(/^#\s*\d{1,3}\s+/, "").trim() || undefined;
  }
  if (!name) {
    const title = /<title>([^<]+)<\/title>/i.exec(html)?.[1];
    if (title) name = decodeEntities(title.split(/\s[-–|]\s/)[0] ?? "").trim() || undefined;
  }

  const mvBlock = /data-header__market-value-wrapper[^>]*>([\s\S]*?)<\/a>/i.exec(html)?.[1];
  const mvText = mvBlock ? stripTags(mvBlock) : "";
  const mv = /€\s?[\d.,]+\s?(?:bn|m|k|Th\.)?/i.exec(mvText)?.[0];

  const clubM = new RegExp(
    `data-header__club[^>]*>[\\s\\S]*?<a\\b[^>]*href="/[^"/]+/${CLUB_KIND}/(\\d+)[^"]*"[^>]*>([\\s\\S]*?)</a>`,
    "i",
  ).exec(html);
  const clubName = clubM ? stripTags(clubM[2]!) : undefined;

  return {
    name,
    shirtNumber,
    imageUrl: imgFromTag(html, /data-header__profile-image|modal-trigger|bilderrahmen/i),
    marketValue: parseMarketValue(mv),
    club: clubM && clubName ? { id: clubM[1]!, name: clubName } : undefined,
    info: parseInfoTable(html),
  };
}

export type TmClubHeader = {
  name?: string | undefined;
  imageUrl?: string | undefined;
  marketValue?: number | undefined;
};

export function parseClubHeader(html: string): TmClubHeader {
  const base = parseProfileHeader(html);
  const imageUrl = imgFromTag(html, /data-header__profile-image|wappen/i) ?? base.imageUrl;
  const total = /Total market value[\s\S]{0,400}?(€\s?[\d.,]+\s?(?:bn|m|k|Th\.)?)/i.exec(
    stripTags(html.slice(0, 60000)),
  )?.[1];
  return {
    name: base.name,
    imageUrl,
    marketValue: base.marketValue ?? parseMarketValue(total),
  };
}

/** Plockar bort referenser, källor och externa länkar i slutet av en Wikipedia-artikel. */
export function trimWikiHtml(html: string): string {
  const ids = "Notes|References|External_links|Further_reading|See_also|Sources|Bibliography";
  const modern = new RegExp(`<div class="mw-heading[^"]*"[^>]*>\\s*<h2 id="(?:${ids})"`, "i").exec(
    html,
  );
  const legacy = new RegExp(`<h2>\\s*<span class="mw-headline" id="(?:${ids})"`, "i").exec(html);
  const cuts = [modern?.index, legacy?.index].filter((i): i is number => i != null);
  return cuts.length ? html.slice(0, Math.min(...cuts)) : html;
}

type WikiHit = { title: string; snippet: string };

/** Väljer den Wikipedia-träff som troligast är fotbollsartikeln om `name`. */
export function pickWikiTitle(name: string, hits: WikiHit[]): string | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const n = norm(name);
  let best: { title: string; score: number } | null = null;
  for (const h of hits) {
    const t = norm(h.title);
    const snippet = stripTags(h.snippet).toLowerCase();
    let score = 0;
    if (t === n) score += 4;
    else if (t.startsWith(n) || n.startsWith(t)) score += 3;
    else if (t.includes(n) || n.includes(t)) score += 2;
    if (/football|footballer|soccer/.test(snippet) || /football|footballer/.test(t)) score += 2;
    if (/disambiguation|list of|season/.test(t)) score -= 3;
    if (!best || score > best.score) best = { title: h.title, score };
  }
  return best && best.score >= 3 ? best.title : null;
}
