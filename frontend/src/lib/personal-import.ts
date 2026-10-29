import type { JsonRecord, LocalDatabase } from './local-db';
import workbook from '../data/personal-workbook.json';
import pasted from '../data/pasted-audit.json';
const bundled = Object.fromEntries(Object.keys(workbook).map(k => [k, [...(workbook as any)[k], ...(pasted as any)[k]]])) as Record<string, JsonRecord[]>;

const BATCH = 'personal-2026-10-28';
// Flag aggregate rows when a later source identifies a specific account; don't
// double-count them as two confirmed commitments.
const imported = bundled.subscriptions || [];
for (const row of imported) {
 const email = String(row.account_email || '').trim();
 const peers = imported.filter(r => r.id !== row.id && String(r.provider).toLowerCase() === String(row.provider).toLowerCase() && r.account_email);
 if (!email && peers.length && row.status === 'Active') { row.status='Unknown'; row.review_status='Needs confirmation · account identity missing'; }
}
for (const row of imported) { if (row.source_sheet !== 'Subscriptions') continue; const name=String(row.provider).toLowerCase(); if((name==='youtube' && !row.account_email) || (name==='budgetpixel' && !String(row.account_email || '').includes('@'))){row.status='Unknown';row.review_status='Needs confirmation · possible duplicate in source';} }
const collections = ['subscriptions','accounts','watchlist','promos','inbox'] as const;
const clean = (v: unknown) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
function identity(row: JsonRecord, area: string): string {
 if (area === 'promos') return clean(row.service) + '|' + clean(row.code);
 if (area === 'inbox') return row.id;
 const email = clean(row.account_email || row.email_used);
 return clean(row.provider || row.service_name) + '|' + clean(row.product || row.platform_usage || row.plan) + '|' + email;
}
/** A one-time, non-destructive merge. Same-name services with different account
 * identities remain separate; tombstones prevent deleted imports reappearing. */
export function mergePersonalWorkbook(current: LocalDatabase, seed: Record<string, JsonRecord[]> = bundled): LocalDatabase {
 if (current.settings?.personal_import_batch === BATCH) return current;
 if (!collections.some(area => seed[area]?.length)) return current;
 const next = {...current};
 const summary: Record<string,number> = {};
 for (const area of collections) {
   const existing = current[area] || [];
   const ids = new Set(existing.map(r => r.id));
   const keys = new Set(existing.map(r => identity(r, area)));
   const added: JsonRecord[] = [];
   for (const row of seed[area] || []) {
     if (ids.has(row.id) || keys.has(identity(row, area))) continue;
     // Don't merge evidence rows across mailboxes, even if the service matches.
     added.push(row); ids.add(row.id); keys.add(identity(row, area));
   }
   next[area] = [...existing, ...added];
   summary[area] = added.length;
 }
 const reminders = [...current.reminders];
 for (const [area,rows] of [['subscriptions',next.subscriptions],['accounts',next.accounts]] as const) {
   for (const row of rows) {
     if (row.import_batch !== BATCH || row.status === 'Unknown') continue;
     const date = area === 'accounts' ? row.benefit_expiry || row.access_until : row.trial_end || row.renewal_date;
     if (!date || date < '2026-10-28' || reminders.some(r => r.ref_id === row.id)) continue;
     reminders.push({id:'deadline-'+row.id,user_id:'local',deleted_at:null,title:(row.provider || row.service_name)+(area === 'accounts' ? ' · access / benefit ends' : row.status === 'Trial' ? ' · trial ends' : ' · renewal'),due_date:date,due_time:'09:00',kind:area === 'accounts'?'custom':'renewal',ref_type:area === 'accounts'?'account':'subscription',ref_id:row.id,completed:false,notify:false,created_at:'2026-10-28T00:00:00Z',notes:'Imported deadline. Review source details before enabling notifications.'});
   }
 }
 next.reminders = reminders;
 summary.reminders = reminders.length - current.reminders.length;
 next.settings = {...current.settings, personal_import_batch:BATCH, personal_import_summary:summary};
 return next;
}
