/** Domain catalogs hydrate through the existing bounded, release-pinned client. */
export class DomainRepository {
  constructor(client, bootstrap) { this.client=client; this.bootstrap=bootstrap; }
  async catalog(domain, options={}) {
    if (!['items','honors','events','photos'].includes(domain) || !this.bootstrap.domains[domain]) throw Error('Unavailable archive domain');
    const index=await this.client.load(this.bootstrap.domains[domain],options);
    if (!Array.isArray(index.pages) || !Number.isInteger(index.count)) throw Error('Invalid domain directory');
    const pages=await Promise.all(index.pages.map(page=>this.client.load(page,options)));
    const rows=pages.flatMap(page=>page.rows || []);
    if (rows.length!==index.count || new Set(rows.map(row=>String(row.id))).size!==rows.length ||
      rows.some(row=>!row.detail || !String(row.id))) throw Error('Domain directory identity mismatch');
    return rows;
  }
  async detail(domain,row,options={}) {
    const payload=await this.client.load(row.detail,options);
    const record=['items','honors'].includes(domain) ? payload.rows?.find(entry=>entry.id===row.id) : payload;
    if (!record || String(record.id)!==String(row.id) || !record.view) throw Error('Domain detail identity mismatch');
    if (['items','honors'].includes(domain) && String(record.view.entry?.id)!==String(row.id)) throw Error('Collection entry identity mismatch');
    if (domain==='photos' && row.id!=='materials' && String(record.view.actor?.idolId)!==String(row.id)) throw Error('Photo actor identity mismatch');
    if (domain==='photos' && row.id!=='materials' && String(record.view.media?.idolId)!==String(row.id)) throw Error('Photo media identity mismatch');
    return record.view;
  }
}
