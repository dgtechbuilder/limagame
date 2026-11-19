import { useEffect, useRef, useState, type Dispatch, type FormEvent } from 'react';
import { NavBar } from '../components/Nav';
import { CloseX } from '../components/Success';
import { BRANDS, REWARD_SPONSOR, SLOTS, activeBrands, brandOf, offerCode, type Brand, type BrandId } from '../partners/data';
import { engagement } from '../partners/track';
import { BrandMark } from '../partners/ui';
import { AREAS, PARTNER_EMAIL, PARTNER_FORM_URL, RULES, WAYS, applicationText, areaOf, shortlistText, wayOf, type AreaId, type PartnerApplication, type WayToPartner } from '../partners/catalogue';
import { REWARDS } from '../data';
import type { Action, GameState, PartnersTab } from '../state';

/* Partners: for players, the offers from the brands that sponsor the game (Get offer shows what it gives, then the
   player's code, kept in Messages, and a button to where it is used); for partners (and
   the team selling to them), every place in the game a brand can appear, who has it, and how often it was seen and
   tapped on this device; and for partners still to sign, every way to partner with TemoLima (Partner with us), with
   an Open to partner form to apply and a shortlist to send. The brands and slots are set in src/partners/data.ts, the ways to partner in catalogue.ts.
   Opened from PARTNERS on the farm, the main menu, a billboard or sponsor line, or #/partners (also before the farm
   opens, for a partner visiting before they play). */

type Props = { s: GameState; dispatch: Dispatch<Action>; tab?: PartnersTab; brand?: BrandId };

const TABS: { id: PartnersTab; label: string; icon: string }[] = [
  { id: 'offers', label: 'Offers', icon: '🎁' },
  { id: 'placements', label: 'Placements', icon: '📍' },
  { id: 'join', label: 'Partner with us', icon: '🤝' },
  { id: 'shortlist', label: 'Shortlist', icon: '★' },
];

export function PartnersPage({ s, dispatch, tab: startTab, brand }: Props) {
  const tab: PartnersTab = startTab ?? 'offers';
  const close = () => dispatch({ type: 'close' });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'close' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
  const taken = SLOTS.filter(x => x.brand).length;
  return (
    <div className="abs settings-page partners-page" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label="Partners">
      <div className="scrim" onClick={close} />
      <div className="fs-panel set-panel" style={{ left: 24, top: 46, width: 826, height: 334 }}>
        <nav className="set-tabs" aria-label="Partners sections">
          <p className="set-heading">Partners</p>
          {TABS.map(t => (
            <button key={t.id} type="button" className={`set-tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => dispatch({ type: 'open', modal: { kind: 'partners', tab: t.id } })}>
              <i aria-hidden="true">{t.icon}</i>
              {t.label}
              {t.id === 'offers' && (s.offers ?? []).length > 0 && <small className="ach-count">{(s.offers ?? []).length} got</small>}
              {t.id === 'shortlist' && (s.partnerPicks ?? []).length > 0 && <small className="ach-count">{(s.partnerPicks ?? []).length}</small>}
            </button>
          ))}
          <p className="set-foot">
            {activeBrands().length} partners · {taken} of {SLOTS.length} placements taken
          </p>
        </nav>
        <section className="set-content ach-content" aria-label={TABS.find(t => t.id === tab)!.label}>
          {tab === 'offers' && <Offers s={s} dispatch={dispatch} focus={brand} />}
          {tab === 'placements' && <Placements />}
          {tab === 'join' && <Join s={s} dispatch={dispatch} />}
          {tab === 'shortlist' && <Shortlist s={s} dispatch={dispatch} />}
        </section>
      </div>
      <NavBar horizontal onBack={close} hideHome={s.fs.phase !== 'done'} style={{ right: 62, top: 8 }} />
      <CloseX className="page-x" onClick={close} />
      <p className="set-title-bar">
        <span aria-hidden="true">🤝</span> Partners · <b>{TABS.find(t => t.id === tab)!.label}</b>
      </p>
    </div>
  );
}

function Offers({ s, dispatch, focus }: { s: GameState; dispatch: Dispatch<Action>; focus?: BrandId }) {
  const saved = s.offers ?? [];
  const box = useRef<HTMLDivElement>(null);
  // the offer open in the sheet: from a card's Get offer, or from a billboard or sponsor line (its brand)
  const [open, setOpen] = useState<BrandId | null>(focus ?? null);
  useEffect(() => {
    if (focus) {
      box.current?.querySelector(`[data-brand="${focus}"]`)?.scrollIntoView({ block: 'nearest' });
      setOpen(focus);
    }
  }, [focus]);
  const farmer = s.farmer?.name;
  const canGo = s.fs.phase === 'done';
  const use = (b: Brand) => dispatch({ type: 'route', path: b.offer.use.to });
  const sheet = brandOf(open);
  return (
    <div ref={box} className="pt-offers">
      <div className="ach-row-head">
        <p className="set-title">Offers from the partners who back your farm</p>
        <small className="pt-note">
          {saved.length} of {activeBrands().length} offers got
        </small>
      </div>
      <div className="pt-grid">
        {activeBrands().map(b => {
          const has = saved.includes(b.id);
          return (
            <article key={b.id} data-brand={b.id} className={`pt-card${focus === b.id ? ' is-focus' : ''}${has ? ' is-got' : ''}`} style={{ ['--brand' as string]: b.color, ['--accent' as string]: b.accent }} aria-label={`${b.name}: ${b.offer.title}`}>
              <header>
                <BrandMark b={b} size={30} />
                <span className="pt-who">
                  <b>{b.name}</b>
                  <small>{b.tagline}</small>
                </span>
                <em className="pt-tag">{b.category}</em>
              </header>
              <p className="pt-offer">
                <b>{b.offer.title}</b>
                <small>{b.offer.line}</small>
              </p>
              <footer>
                {has ? (
                  <>
                    <span className="pt-code" aria-label={`${b.name} offer got, code ${offerCode(b.id, farmer)}`}>
                      ✓ <b>{offerCode(b.id, farmer)}</b>
                    </span>
                    {canGo && (
                      <button type="button" className="set-link pt-use" onClick={() => use(b)}>
                        Use it ›
                      </button>
                    )}
                  </>
                ) : (
                  <button type="button" className="ach-claim" onClick={() => setOpen(b.id)} aria-label={`Get the ${b.name} offer`}>
                    Get offer
                  </button>
                )}
                {b.url && (
                  <a className="set-link pt-visit" href={b.url} target="_blank" rel="noopener noreferrer">
                    Visit site <span aria-hidden="true">›</span>
                  </a>
                )}
              </footer>
            </article>
          );
        })}
      </div>
      {sheet && <OfferSheet b={sheet} got={saved.includes(sheet.id)} code={offerCode(sheet.id, farmer)} canGo={canGo} onGet={() => dispatch({ type: 'partnerSave', id: sheet.id })} onUse={() => use(sheet)} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Getting an offer: what it gives and where it is used, then the player's code once they take it. */
function OfferSheet({ b, got, code, canGo, onGet, onUse, onClose }: { b: Brand; got: boolean; code: string; canGo: boolean; onGet: () => void; onUse: () => void; onClose: () => void }) {
  const main = useRef<HTMLButtonElement>(null);
  // Escape closes the sheet, not the whole page; the main button has the focus at each step
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  useEffect(() => main.current?.focus(), [got]);
  return (
    <div className="pt-sheet-wrap">
      <div className="pt-sheet-scrim" onClick={onClose} />
      <div className={`pt-sheet${got ? ' is-got' : ''}`} role="dialog" aria-modal="true" aria-label={`${b.name} offer`} style={{ ['--brand' as string]: b.color, ['--accent' as string]: b.accent }}>
        <CloseX className="pt-sheet-x" onClick={onClose} />
        <header>
          <BrandMark b={b} size={38} />
          <span>
            <small>
              {b.name} · {b.category}
            </small>
            <b>{b.offer.title}</b>
          </span>
        </header>
        {!got ? (
          <>
            <p className="pt-sheet-head">What you get</p>
            <ul className="pt-gets">
              {b.offer.get.map(g => (
                <li key={g}>{g}</li>
              ))}
            </ul>
            <p className="pt-sheet-where">
              <i aria-hidden="true">📍</i> {b.offer.line}.
            </p>
            {b.sample && <p className="pt-sheet-fine">{b.name} is a sample partner made up for the game.</p>}
            <div className="pt-sheet-actions">
              <button ref={main} type="button" className="ach-claim is-big" onClick={onGet}>
                Get this offer
              </button>
              <button type="button" className="set-link" onClick={onClose}>
                Not now
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="pt-voucher" aria-live="polite">
              <small>Your offer code</small>
              <b>{code}</b>
              <span>✓ Saved to Messages</span>
            </div>
            <p className="pt-sheet-where">
              <i aria-hidden="true">📍</i> {b.offer.line}.
            </p>
            <div className="pt-sheet-actions">
              {canGo && (
                <button ref={main} type="button" className="ach-claim is-big" onClick={onUse}>
                  {b.offer.use.label} ›
                </button>
              )}
              <button type="button" className="set-link" onClick={onClose}>
                Back to offers
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type Row = { id: string; surface: string; where: string; format: string; brand?: BrandId | null; n?: { views: number; taps: number } };

function Placements() {
  const e = engagement();
  const rows: Row[] = [
    ...SLOTS.map(x => ({ id: x.id, surface: x.surface, where: x.where, format: x.format, brand: x.brand, n: e[x.id] ?? { views: 0, taps: 0 } })),
    ...REWARDS.filter(r => REWARD_SPONSOR[r.id]).map(r => ({ id: r.id, surface: 'Rewards', where: `Voucher: ${r.name}`, format: `Voucher sponsor (${r.off}% off)`, brand: REWARD_SPONSOR[r.id] })),
  ];
  // the rows by where in the game they sit, in the order they are listed
  const groups = [...new Set(rows.map(r => r.surface))].map(surface => ({ surface, rows: rows.filter(r => r.surface === surface) }));
  const taken = SLOTS.filter(x => x.brand).length;
  const views = SLOTS.reduce((t, x) => t + (e[x.id]?.views ?? 0), 0);
  const taps = SLOTS.reduce((t, x) => t + (e[x.id]?.taps ?? 0), 0);
  const num = (v: number) => v.toLocaleString('en-US');
  return (
    <div className="pt-place">
      <div className="ach-row-head pt-offers-head">
        <p className="set-title">Every place a partner can appear</p>
        <small className="pt-note">Views and taps are counted on this device only</small>
      </div>
      <div className="pt-stats">
        <p>
          <b>
            {taken}
            <small> / {SLOTS.length}</small>
          </b>
          <small>Placements taken</small>
        </p>
        <p className="is-open">
          <b>{SLOTS.length - taken}</b>
          <small>Open to a partner</small>
        </p>
        <p>
          <b>{num(views)}</b>
          <small>Views</small>
        </p>
        <p>
          <b>{num(taps)}</b>
          <small>Taps</small>
        </p>
      </div>
      <div className="pt-table-card">
        <table className="pt-table">
          <thead>
            <tr>
              <th scope="col">Placement</th>
              <th scope="col">Partner</th>
              <th scope="col">Views</th>
              <th scope="col">Taps</th>
            </tr>
          </thead>
          {groups.map(g => (
            <tbody key={g.surface}>
              <tr className="pt-group">
                <th scope="colgroup" colSpan={4}>
                  {g.surface} <small>{g.rows.length}</small>
                </th>
              </tr>
              {g.rows.map(r => {
                const b = brandOf(r.brand ?? undefined);
                return (
                  <tr key={r.id} className={b ? undefined : 'is-open'}>
                    <td>
                      <b className="pt-where">{r.where}</b>
                      <small className="pt-format">{r.format}</small>
                    </td>
                    <td>
                      {b ? (
                        <span className="pt-brand">
                          <BrandMark b={b} size={16} /> {b.name}
                          {b.sample && <em>sample</em>}
                        </span>
                      ) : (
                        <span className="pt-open">Available</span>
                      )}
                    </td>
                    <td className={r.n?.views ? undefined : 'is-zero'}>{r.n ? num(r.n.views) : '–'}</td>
                    <td className={r.n?.taps ? undefined : 'is-zero'}>{r.n ? num(r.n.taps) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="pg-foot pt-foot">
        {BRANDS.filter(b => b.sample).length} sample brands hold slots for partners still to sign.
      </p>
    </div>
  );
}

/* ---------------- Partner with us: every way to partner, for partners still to sign ---------------- */

/** Who holds the placements an option sells: a signed partner, or open. */
function holder(w: WayToPartner): { brand?: Brand; open: number } {
  const slots = SLOTS.filter(x => w.slots?.includes(x.id));
  return { brand: brandOf(slots.find(x => x.brand)?.brand ?? undefined), open: slots.filter(x => !x.brand).length };
}

function Join({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const [area, setArea] = useState<AreaId | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  // the Open to partner form: the category and way it starts on, or closed
  const [apply, setApply] = useState<{ area?: AreaId; way?: string } | null>(null);
  const picks = s.partnerPicks ?? [];
  const shown = WAYS.filter(w => area === 'all' || w.area === area);
  const sheet = open ? wayOf(open) : undefined;
  return (
    <div className="pj-join">
      <div className="ach-row-head pj-head">
        <p className="set-title">Ways to partner with TemoLima</p>
        <small className="pt-note">
          {WAYS.length} ways · {AREAS.length} categories
        </small>
        <button type="button" className="ach-claim pj-open-btn" onClick={() => setApply({ area: area === 'all' ? undefined : area })}>
          Open to partner
        </button>
      </div>
      <div className="pj-areas" role="group" aria-label="Areas">
        {[{ id: 'all' as const, label: 'All', icon: '' }, ...AREAS].map(a => (
          <button key={a.id} type="button" className={`pj-area${area === a.id ? ' is-on' : ''}`} aria-pressed={area === a.id} onClick={() => setArea(a.id)}>
            {a.icon && <i aria-hidden="true">{a.icon}</i>}
            {a.label}
          </button>
        ))}
      </div>
      <div className="pj-grid">
        {shown.map(w => {
          const picked = picks.includes(w.id);
          const h = holder(w);
          return (
            <button key={w.id} type="button" className={`pj-card${picked ? ' is-picked' : ''}`} onClick={() => setOpen(w.id)} aria-label={`${w.name}. ${picked ? 'On your shortlist. ' : ''}See details`}>
              <span className="pj-card-head">
                <i aria-hidden="true">{w.icon}</i>
                <b>{w.name}</b>
                {picked && <span className="pj-tick" aria-hidden="true">✓</span>}
              </span>
              <span className="pj-pitch">{w.pitch}</span>
              <span className="pj-card-foot">
                <em className="pj-cat">{areaOf(w.area).label}</em>
                {h.brand ? <small>With {h.brand.name}</small> : h.open > 0 ? <small className="is-open">Open</small> : null}
              </span>
            </button>
          );
        })}
      </div>
      <ul className="pj-rules">
        {RULES.map(r => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {sheet && !apply && <WaySheet w={sheet} s={s} picked={picks.includes(sheet.id)} dispatch={dispatch} onApply={() => setApply({ area: sheet.area, way: sheet.id })} onClose={() => setOpen(null)} />}
      {apply && <ApplyForm dispatch={dispatch} start={apply} onClose={() => setApply(null)} />}
    </div>
  );
}

/** One way to partner: where players meet it, what the partner gets, Open to partner, Interested, and the screen that shows it. */
function WaySheet({ w, s, picked, dispatch, onApply, onClose }: { w: WayToPartner; s: GameState; picked: boolean; dispatch: Dispatch<Action>; onApply: () => void; onClose: () => void }) {
  const main = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  useEffect(() => main.current?.focus(), []);
  const h = holder(w);
  // the game's other screens open once the farm is open
  const canGo = s.fs.phase === 'done';
  return (
    <div className="pt-sheet-wrap">
      <div className="pt-sheet-scrim" onClick={onClose} />
      <div className="pt-sheet pj-sheet" role="dialog" aria-modal="true" aria-label={w.name}>
        <CloseX className="pt-sheet-x" onClick={onClose} />
        <header>
          <span className="pj-sheet-icon" aria-hidden="true">
            {w.icon}
          </span>
          <span>
            <small>{areaOf(w.area).label}</small>
            <b>{w.name}</b>
          </span>
        </header>
        <p className="pj-sheet-pitch">{w.pitch}</p>
        <p className="pt-sheet-head">Where players meet it</p>
        <ul className="pj-where">
          {w.where.map(x => (
            <li key={x}>{x}</li>
          ))}
        </ul>
        <p className="pt-sheet-head">What you get</p>
        <p className="pj-gets">{w.gets}</p>
        {(h.brand || h.open > 0) && (
          <p className="pt-sheet-where">
            <i aria-hidden="true">📍</i>
            {h.brand ? `Held today by ${h.brand.name}${h.brand.sample ? ' (a sample partner)' : ''}.` : 'Its placement is open.'}
          </p>
        )}
        <div className="pt-sheet-actions">
          <button ref={main} type="button" className="ach-claim is-big" onClick={onApply}>
            Open to partner
          </button>
          <button type="button" className={`ach-claim is-big pj-pick${picked ? ' is-on' : ''}`} aria-pressed={picked} onClick={() => dispatch({ type: 'partnerPick', id: w.id })}>
            {picked ? '✓ On my shortlist' : '+ Interested'}
          </button>
          {w.see && canGo && (
            <button type="button" className="set-link" onClick={() => dispatch({ type: 'route', path: w.see!.to })}>
              {w.see.label} ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Open to partner: the application form ---------------- */

type Draft = Omit<PartnerApplication, 't'>;
type Field = 'org' | 'name' | 'role' | 'email' | 'phone' | 'country' | 'website';

const FIELDS: { id: Field; label: string; type?: string; need?: boolean; auto?: string }[] = [
  { id: 'org', label: 'Organisation', need: true, auto: 'organization' },
  { id: 'name', label: 'Your name', need: true, auto: 'name' },
  { id: 'role', label: 'Role', auto: 'organization-title' },
  { id: 'email', label: 'Email', type: 'email', need: true, auto: 'email' },
  { id: 'phone', label: 'Phone', type: 'tel', auto: 'tel' },
  { id: 'country', label: 'Country', need: true, auto: 'country-name' },
  { id: 'website', label: 'Website', type: 'url', auto: 'url' },
];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What is missing or wrong in a draft, by field (empty when it can be sent). */
function problems(d: Draft): Partial<Record<Field | 'message', string>> {
  const out: Partial<Record<Field | 'message', string>> = {};
  for (const f of FIELDS) if (f.need && !d[f.id].trim()) out[f.id] = 'Needed';
  if (d.email.trim() && !EMAIL.test(d.email.trim())) out.email = 'Not an email address';
  if (!d.message.trim()) out.message = 'Tell us a little about what you would like to do';
  return out;
}

/** Open to partner: a partner's details, their category and ways to partner, and a message; then sent. */
function ApplyForm({ dispatch, start, onClose }: { dispatch: Dispatch<Action>; start: { area?: AreaId; way?: string }; onClose: () => void }) {
  const first = useRef<HTMLInputElement>(null);
  const [d, setD] = useState<Draft>(() => ({
    org: '',
    name: '',
    role: '',
    email: '',
    phone: '',
    country: '',
    website: '',
    area: start.area ?? AREAS[0].id,
    ways: start.way ? [start.way] : [],
    message: '',
  }));
  const [tried, setTried] = useState(false);
  const [sent, setSent] = useState<PartnerApplication | null>(null);
  const [post, setPost] = useState<'sending' | 'sent' | 'failed' | null>(null);
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  useEffect(() => first.current?.focus(), []);
  const bad = problems(d);
  const set = (patch: Partial<Draft>) => setD(x => ({ ...x, ...patch }));
  const ways = WAYS.filter(w => w.area === d.area);
  const toggle = (id: string) => set({ ways: d.ways.includes(id) ? d.ways.filter(x => x !== id) : [...d.ways, id] });

  const send = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTried(true);
    if (Object.keys(bad).length > 0) {
      e.currentTarget.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    const trim = (v: string) => v.trim();
    const app: PartnerApplication = {
      t: Date.now(),
      ...d,
      org: trim(d.org),
      name: trim(d.name),
      role: trim(d.role),
      email: trim(d.email),
      phone: trim(d.phone),
      country: trim(d.country),
      website: trim(d.website),
      message: trim(d.message),
      // only the ways in the category picked
      ways: d.ways.filter(id => wayOf(id)?.area === d.area),
    };
    dispatch({ type: 'partnerApply', app });
    setSent(app);
    if (!PARTNER_FORM_URL) return;
    setPost('sending');
    try {
      const r = await fetch(PARTNER_FORM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...app, category: areaOf(app.area).label, waysToPartner: app.ways.map(id => wayOf(id)?.name) }),
      });
      setPost(r.ok ? 'sent' : 'failed');
    } catch {
      setPost('failed');
    }
  };

  if (sent) {
    const text = applicationText(sent);
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied('yes');
      } catch {
        setCopied('no');
      }
    };
    return (
      <div className="pt-sheet-wrap">
        <div className="pt-sheet-scrim" onClick={onClose} />
        <div className="pt-sheet pj-sheet pj-form is-sent" role="dialog" aria-modal="true" aria-label="Open to partner">
          <CloseX className="pt-sheet-x" onClick={onClose} />
          <header>
            <span className="pj-sheet-icon" aria-hidden="true">
              🤝
            </span>
            <span>
              <small>{areaOf(sent.area).label}</small>
              <b>Thank you, {sent.org}</b>
            </span>
          </header>
          <p className="pj-sheet-pitch" role="status">
            {post === 'sending'
              ? 'Sending your application…'
              : post === 'sent'
                ? `Your application is with the TemoLima team. We will reply to ${sent.email}.`
                : post === 'failed'
                  ? 'It could not be sent just now. It is saved on this device: email or copy it below.'
                  : PARTNER_EMAIL
                    ? 'Your application is ready. Email it to the TemoLima team to send it.'
                    : 'Your application is saved on this device. Copy it and send it to the TemoLima team.'}
          </p>
          <pre className="pj-summary">{text}</pre>
          <div className="pt-sheet-actions">
            {PARTNER_EMAIL && post !== 'sent' && (
              <a className="ach-claim is-big pj-mail" href={`mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent(`TemoLima partner application: ${sent.org}`)}&body=${encodeURIComponent(text)}`}>
                Email it to the team
              </a>
            )}
            <button type="button" className={PARTNER_EMAIL && post !== 'sent' ? 'set-link' : 'ach-claim is-big'} onClick={copy}>
              Copy it
            </button>
            <button type="button" className="set-link" onClick={onClose}>
              Done
            </button>
            {copied && <span className="pj-copied">{copied === 'yes' ? 'Copied.' : 'This browser would not copy it: select the text above.'}</span>}
          </div>
        </div>
      </div>
    );
  }

  const err = (id: Field | 'message') => (tried ? bad[id] : undefined);
  return (
    <div className="pt-sheet-wrap">
      <div className="pt-sheet-scrim" onClick={onClose} />
      <div className="pt-sheet pj-sheet pj-form" role="dialog" aria-modal="true" aria-label="Open to partner">
        <CloseX className="pt-sheet-x" onClick={onClose} />
        <header>
          <span className="pj-sheet-icon" aria-hidden="true">
            🤝
          </span>
          <span>
            <small>Partner with TemoLima</small>
            <b>Open to partner</b>
          </span>
        </header>
        <form noValidate onSubmit={send}>
          <div className="pj-fields">
            {FIELDS.map((f, i) => (
              <label key={f.id} className={`pj-field${err(f.id) ? ' is-bad' : ''}`}>
                <span>
                  {f.label}
                  {f.need ? <i aria-hidden="true"> *</i> : <small> (optional)</small>}
                </span>
                <input
                  ref={i === 0 ? first : undefined}
                  type={f.type ?? 'text'}
                  value={d[f.id]}
                  autoComplete={f.auto}
                  maxLength={f.id === 'website' ? 200 : 120}
                  required={f.need}
                  aria-invalid={err(f.id) ? true : undefined}
                  onChange={e => set({ [f.id]: e.target.value } as Partial<Draft>)}
                />
                {err(f.id) && <em className="pj-err">{err(f.id)}</em>}
              </label>
            ))}
            <label className="pj-field">
              <span>
                Partnership category<i aria-hidden="true"> *</i>
              </span>
              <select value={d.area} onChange={e => set({ area: e.target.value as AreaId })}>
                {AREAS.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <fieldset className="pj-ways">
            <legend>
              Ways to partner in {areaOf(d.area).label} <small>(optional)</small>
            </legend>
            {ways.map(w => (
              <label key={w.id} className={`pj-way${d.ways.includes(w.id) ? ' is-on' : ''}`}>
                <input type="checkbox" checked={d.ways.includes(w.id)} onChange={() => toggle(w.id)} />
                <i aria-hidden="true">{w.icon}</i> {w.name}
              </label>
            ))}
          </fieldset>
          <label className={`pj-field is-wide${err('message') ? ' is-bad' : ''}`}>
            <span>
              About you and what you would like to do<i aria-hidden="true"> *</i>
            </span>
            <textarea value={d.message} rows={3} maxLength={2000} required aria-invalid={err('message') ? true : undefined} onChange={e => set({ message: e.target.value })} />
            {err('message') && <em className="pj-err">{err('message')}</em>}
          </label>
          <div className="pt-sheet-actions">
            <button type="submit" className="ach-claim is-big">
              Send application
            </button>
            <button type="button" className="set-link" onClick={onClose}>
              Cancel
            </button>
            {tried && Object.keys(bad).length > 0 && <span className="pj-err">Fill in the fields marked *</span>}
          </div>
        </form>
      </div>
    </div>
  );
}

function Shortlist({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const picks = s.partnerPicks ?? [];
  const picked = picks.map(wayOf).filter((w): w is WayToPartner => !!w);
  const text = shortlistText(picks);
  if (picked.length === 0)
    return (
      <div className="pj-empty">
        <p className="set-title">Your shortlist is empty</p>
        <p>Open Partner with us, tap a way to partner, then + Interested.</p>
        <button type="button" className="ach-claim is-big" onClick={() => dispatch({ type: 'open', modal: { kind: 'partners', tab: 'join' } })}>
          See the ways to partner
        </button>
      </div>
    );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('yes');
    } catch {
      setCopied('no');
    }
  };
  return (
    <div className="pj-short">
      <div className="ach-row-head">
        <p className="set-title">Your shortlist</p>
        <small className="pt-note">
          {picked.length} of {WAYS.length} ways
        </small>
      </div>
      <ul className="pj-list">
        {picked.map(w => (
          <li key={w.id}>
            <i aria-hidden="true">{w.icon}</i>
            <span>
              <b>{w.name}</b>
              <small>{areaOf(w.area).label}</small>
            </span>
            <button type="button" className="pj-remove" onClick={() => dispatch({ type: 'partnerPick', id: w.id })} aria-label={`Take ${w.name} off the shortlist`}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="pt-sheet-actions">
        <button type="button" className="ach-claim is-big" onClick={copy}>
          Copy the shortlist
        </button>
        {PARTNER_EMAIL && (
          <a className="set-link" href={`mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent('TemoLima partnership')}&body=${encodeURIComponent(text)}`}>
            Email it to the TemoLima team ›
          </a>
        )}
        {copied && (
          <span className="pj-copied" role="status">
            {copied === 'yes' ? 'Copied. Paste it into an email or a message.' : 'This browser would not copy it: select the text below.'}
          </span>
        )}
      </div>
      {copied === 'no' && <textarea className="pj-text" readOnly value={text} aria-label="The shortlist as text" />}
    </div>
  );
}
