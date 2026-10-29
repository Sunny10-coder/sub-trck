import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyDatabase, createLocalDb, createMemoryKv, LOCAL_DB_KEY } from './local-db';
import { mergePersonalWorkbook } from './personal-import';
import { computeInsights } from './local-insights';

const seed = {
 subscriptions: [
  {id:'example-trial',provider:'Example Creative',status:'Trial',price:0,currency:'AED',billing_cycle:'yearly',trial_end:'2099-01-03',import_batch:'personal-2026-10-28',source_fields:{Plan:'Trial'}},
  {id:'account-a',provider:'Example Audio',account_email:'one@example.com',status:'Unknown',import_batch:'personal-2026-10-28',source_fields:{Mailbox:'one@example.com'}},
  {id:'account-b',provider:'Example Audio',account_email:'two@example.com',status:'Unknown',import_batch:'personal-2026-10-28',source_fields:{Mailbox:'two@example.com'}},
 ],
 accounts:[{id:'example-cancelled',service_name:'Example Social',account_type:'cancelled',access_until:'2099-11-22',import_batch:'personal-2026-10-28'}],
 watchlist:[],promos:[{id:'example-promo',service:'Example',code:'EXAMPLE25'}],
 inbox:[{id:'example-evidence',status:'needs_confirmation',source_fields:{Evidence:'Example invoice'}}],
};
const merge = (db: ReturnType<typeof emptyDatabase>) => mergePersonalWorkbook(db,seed);

test('import preserves existing edits and is idempotent including tombstones',()=>{
 const current=emptyDatabase();current.subscriptions=[{id:'existing',provider:'Personal service',notes:'keep my edits'}];
 const next=merge(current);assert.deepEqual(next.subscriptions[0],current.subscriptions[0]);
 assert.equal(next.subscriptions.length,4);assert.equal(next.accounts.length,1);
 assert.strictEqual(merge(next),next);
 const deleted={...next,accounts:next.accounts.map(r=>({...r,deleted_at:'2026-10-28'}))};
 assert.strictEqual(merge(deleted),deleted);
});
test('import keeps separate mailboxes, trial pricing and cancelled access dates',()=>{
 const next=merge(emptyDatabase());const audio=next.subscriptions.filter(r=>r.provider==='Example Audio');
 assert.equal(audio.length,2);assert.notEqual(audio[0].account_email,audio[1].account_email);
 assert.ok(audio.every(r=>r.source_fields));assert.equal(next.accounts[0].access_until,'2099-11-22');
 assert.equal(next.subscriptions[0].price,0);assert.equal(next.subscriptions[0].status,'Trial');
 assert.equal(next.inbox[0].status,'needs_confirmation');
});
test('initializer persists once and serial reads see the full import',async()=>{
 const kv=createMemoryKv();const db=createLocalDb(kv,merge);
 const [a,b]=await Promise.all([db.read(d=>d.accounts.length),db.read(d=>d.accounts.length)]);
 assert.equal(a,1);assert.equal(a,b);const stored=JSON.parse((await kv.getItem(LOCAL_DB_KEY))!);
 assert.equal(stored.settings.personal_import_batch,'personal-2026-10-28');
});
test('currency totals exclude other currencies, prepaid and usage prices',()=>{
 const db=emptyDatabase();db.subscriptions=[{status:'Active',price:12,currency:'AED',billing_cycle:'monthly'},{status:'Active',price:10,currency:'USD',billing_cycle:'monthly'},{status:'Active',price:100,currency:'AED',billing_cycle:'prepaid'},{status:'Active',price:99,currency:'AED',billing_cycle:'usage'}];
 const out=computeInsights(db);assert.equal(out.monthly_spend,12);assert.equal(out.monthly_by_currency.USD,10);
});
test('calendar deadlines exclude uncertain records and require notification opt-in',()=>{
 const next=merge(emptyDatabase());assert.equal(next.reminders.length,2);
 assert.ok(next.reminders.every(r=>!r.notify));assert.ok(next.reminders.every(r=>!['account-a','account-b'].includes(r.ref_id)));
});
test('empty public defaults do not consume the private import marker',()=>{
 const current=emptyDatabase();assert.strictEqual(mergePersonalWorkbook(current,{subscriptions:[],accounts:[],watchlist:[],promos:[],inbox:[]}),current);
});
