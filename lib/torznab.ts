/** Lightweight Torznab/Newznab XML parser for indexer grab counts. */

export interface TorznabItem {
  guid: string;
  title: string;
  link: string;
  publishDate: string;
  size: number;
  grabs: number;
  categories: Array<{ id: number; name: string }>;
  indexer: string;
  downloadUrl: string;
  commentUrl?: string;
}

function textOf(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim() ?? "";
}

function attrValue(block: string, name: string): string | null {
  const patterns = [
    new RegExp(`<(?:newznab:)?attr[^>]*name=["']${name}["'][^>]*value=["']([^"']*)["']`, "i"),
    new RegExp(`<(?:newznab:)?attr[^>]*value=["']([^"']*)["'][^>]*name=["']${name}["']`, "i"),
    new RegExp(`<(?:torznab:)?attr[^>]*name=["']${name}["'][^>]*value=["']([^"']*)["']`, "i"),
  ];
  for (const re of patterns) {
    const m = block.match(re);
    if (m?.[1] != null) return m[1];
  }
  return null;
}

function allAttrCategories(block: string): Array<{ id: number; name: string }> {
  const cats: Array<{ id: number; name: string }> = [];
  const re = /<(?:newznab:)?attr[^>]*name=["']category["'][^>]*value=["'](\d+)["'][^>]*(?:displayValue=["']([^"']*)["'])?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    cats.push({ id: Number(m[1]), name: m[2] ?? String(m[1]) });
  }
  return cats;
}

export function parseTorznabSearchXml(xml: string, indexerName: string): TorznabItem[] {
  const items = xml.split(/<item\b/i).slice(1);
  const results: TorznabItem[] = [];

  for (const chunk of items) {
    const block = `<item${chunk}`;
    const title = textOf(block, "title");
    if (!title) continue;

    const link = textOf(block, "link");
    const guid = textOf(block, "guid") || link || title;
    const pubDate = textOf(block, "pubDate");
    const size = Number(attrValue(block, "size") ?? textOf(block, "enclosure")?.match(/length=["'](\d+)["']/i)?.[1] ?? 0);
    const grabs = Number(attrValue(block, "grabs") ?? 0) || 0;
    const enclosure = block.match(/<enclosure[^>]*url=["']([^"']+)["']/i);
    const downloadUrl = enclosure?.[1] ?? link;
    const comments = textOf(block, "comments");

    results.push({
      guid,
      title,
      link,
      publishDate: pubDate,
      size: Number.isNaN(size) ? 0 : size,
      grabs,
      categories: allAttrCategories(block),
      indexer: indexerName,
      downloadUrl,
      commentUrl: comments || undefined,
    });
  }

  return results;
}

export async function searchTorznabIndexer(
  baseUrl: string,
  apiKey: string,
  indexerId: number,
  indexerName: string,
  query: string,
  categories: number[],
  limit: number,
): Promise<TorznabItem[]> {
  const params = new URLSearchParams({
    apikey: apiKey,
    t: "search",
    q: query,
    limit: String(limit),
    offset: "0",
    extended: "1",
    attrs: "grabs,size",
  });
  if (categories.length > 0) {
    params.set("cat", categories.join(","));
  }

  const root = baseUrl.replace(/\/$/, "");
  const urls = [
    `${root}/api/v1/indexer/${indexerId}/newznab?${params.toString()}`,
    `${root}/${indexerId}/api?${params.toString()}`,
  ];

  let xml: string | null = null;
  let lastStatus = 0;

  for (const url of urls) {
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(20_000),
    });
    lastStatus = response.status;
    if (!response.ok) continue;
    xml = await response.text();
    if (xml.includes("<item")) break;
  }

  if (!xml) {
    throw new Error(`Torznab search failed (${lastStatus}) for indexer ${indexerName}`);
  }

  return parseTorznabSearchXml(xml, indexerName);
}
