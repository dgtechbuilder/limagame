import { useEffect, useMemo, useState } from 'react';
import { CROPS, PARTNERS, SEASONS, SEASON_IDS, WHEN_PLANT, rng, scoreSeason, type CropId, type PartnerId, type PlantWhen, type SeasonId, type SeedChoice } from '../rules';
import { GameFrame, Go, Say, Tool, animate, type GameProps } from './common';

/* Drought-tolerant seed and intercropping, played: a season's forecast, then three choices: the main crop, what goes
   between the rows, and when to plant. Then the season plays out week by week, its rain against what the crops need,
   and the harvest is counted against the best that season allowed. Three seasons (one on the daily drill). */

const W = 600;
const H = 260;
const CH = { x: 40, y: 64, w: 540, h: 120 };
const SHORT_CROP: Record<CropId, string> = { hybrid: 'Hybrid maize', dtmaize: 'DT maize', sorghum: 'Sorghum', millet: 'Millet' };
const SHORT_PART: Record<PartnerId, string> = { none: 'Nothing', beans: 'Beans', cowpea: 'Cowpeas', pigeon: 'Pigeon peas' };
const SHORT_WHEN: Record<PlantWhen, string> = { dry: 'Dry soil', onset: 'Wet a hand deep', late: '3 weeks late' };

export function SeedsGame({ seed, drill, onDone }: GameProps) {
  const seasons = useMemo<SeasonId[]>(() => {
    const r = rng(seed);
    const list = [...SEASON_IDS];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return drill ? list.slice(0, 1) : list;
  }, [seed, drill]);
  const [round, setRound] = useState(0);
  const [c, setC] = useState<SeedChoice>({ crop: 'hybrid', partner: 'none', when: 'dry' });
  const [played, setPlayed] = useState<{ season: SeasonId; choice: SeedChoice; score: number; total: number; best: number }[]>([]);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const season = seasons[round];
  const S = SEASONS[season];
  const result = played[round];
  const shown = result ? scoreSeason(season, result.choice) : null;

  useEffect(() => {
    if (!running) return;
    return animate(2200, setT, () => setRunning(false));
  }, [running]);

  const plant = () => {
    const r = scoreSeason(season, c);
    setPlayed([...played, { season, choice: c, score: r.score, total: r.result.total, best: r.best.total }]);
    setT(0);
    setRunning(true);
  };
  const next = () => {
    setRound(round + 1);
    setC({ crop: 'hybrid', partner: 'none', when: 'dry' });
  };
  const finish = () => {
    const score = played.reduce((n, p) => n + p.score, 0) / played.length;
    onDone(score, played.map(p => `${SEASONS[p.season].name}: ${p.total} of a possible ${p.best} bags`).join(' · '));
  };

  const bw = CH.w / 16;
  const weekNow = result ? Math.floor((running ? t : 1) * 16) : -1;
  const ch = result?.choice;
  const crop = ch ? CROPS[ch.crop] : null;
  const part = ch && ch.partner !== 'none' ? PARTNERS[ch.partner] : null;
  const pw = shown?.result.week ?? 0;

  const stage = (
    <svg viewBox={`0 0 ${W} ${H}`} className="csa-svg" aria-label={`Season ${round + 1}: ${S.name}`}>
      <rect width={W} height={H} fill="#fbf3e2" />
      <text x={16} y={24} className="csa-svg-title">
        📻 {S.name}
      </text>
      <text x={16} y={44} className="csa-svg-note">
        {S.forecast}
      </text>
      {/* the weeks' rain */}
      {S.rain.map((r, w) => {
        const seen = !result || w <= weekNow;
        return (
          <g key={w}>
            <rect x={CH.x + w * bw + 3} y={CH.y + CH.h - r * CH.h} width={bw - 6} height={r * CH.h} rx={3} fill="#3aa7e0" opacity={seen ? 0.8 : 0.25} />
            <text x={CH.x + w * bw + bw / 2} y={CH.y + CH.h + 13} textAnchor="middle" className="csa-svg-tick">
              {w + 1}
            </text>
          </g>
        );
      })}
      <text x={CH.x - 6} y={CH.y + 8} textAnchor="end" className="csa-svg-tick">
        rain
      </text>
      <text x={CH.x + CH.w} y={CH.y + CH.h + 26} textAnchor="end" className="csa-svg-tick">
        weeks of the season
      </text>
      {/* the crops' weeks in the ground, and their need */}
      {crop && (
        <g>
          <rect x={CH.x + pw * bw} y={CH.y + CH.h + 30} width={Math.min(16 - pw, crop.weeks) * bw} height={10} rx={5} fill="#e0a92a" />
          <line x1={CH.x + pw * bw} x2={CH.x + Math.min(16, pw + crop.weeks) * bw} y1={CH.y + CH.h - crop.need * CH.h} y2={CH.y + CH.h - crop.need * CH.h} stroke="#c0432f" strokeDasharray="4 3" strokeWidth={2} />
          <text x={CH.x + pw * bw + 4} y={CH.y + CH.h - crop.need * CH.h - 4} className="csa-svg-note is-bad">
            {SHORT_CROP[ch!.crop]} needs
          </text>
          {part && <rect x={CH.x + pw * bw} y={CH.y + CH.h + 44} width={Math.min(16 - pw, part.weeks) * bw} height={8} rx={4} fill="#7cbf4a" />}
          <text x={CH.x + pw * bw} y={CH.y + CH.h + 64} className="csa-svg-tick">
            Planted week {pw + 1}
            {shown?.result.failed ? ': the seed sprouted, then died in the dry weeks' : ''}
          </text>
        </g>
      )}
      {result && !running && (
        <g transform="translate(400 6)">
          <rect width={190} height={50} rx={8} fill="#fffaf0" stroke="#e0c99a" />
          <text x={10} y={20} className="csa-svg-note">
            Harvest: <tspan fontWeight={800}>{result.total} bags</tspan>
          </text>
          <text x={10} y={38} className="csa-svg-tick">
            The best this season: {result.best} bags
          </text>
        </g>
      )}
    </svg>
  );

  const side = result ? (
    <>
      <p className="csa-step">
        Season {round + 1} of {seasons.length}
      </p>
      <Say tone={result.score >= 0.85 ? 'good' : 'bad'}>
        {running
          ? 'The season is growing…'
          : `${shown!.result.main} bags of ${CROPS[result.choice.crop].name.toLowerCase()}${shown!.result.second ? ` and ${shown!.result.second} of ${SHORT_PART[result.choice.partner].toLowerCase()}` : ''}. ${
              result.score >= 0.95
                ? 'The best choice for this season.'
                : `Best here: ${CROPS[shown!.best.choice.crop].name.toLowerCase()} with ${PARTNERS[shown!.best.choice.partner].name.toLowerCase()}, planted when the soil is wet a hand deep.`
            }`}
      </Say>
      {!running && (round < seasons.length - 1 ? <Go onClick={next}>Next season ›</Go> : <Go onClick={finish}>Finish</Go>)}
    </>
  ) : (
    <>
      <p className="csa-step">
        Season {round + 1} of {seasons.length}: choose
      </p>
      <div className="csa-pick" role="group" aria-label="The main crop">
        <small>Crop</small>
        {(Object.keys(CROPS) as CropId[]).map(k => (
          <Tool key={k} on={c.crop === k} onClick={() => setC({ ...c, crop: k })} label={`${CROPS[k].name}: ${CROPS[k].does}`}>
            {SHORT_CROP[k]}
          </Tool>
        ))}
      </div>
      <div className="csa-pick" role="group" aria-label="Between the rows">
        <small>Between</small>
        {(Object.keys(PARTNERS) as PartnerId[]).map(k => (
          <Tool key={k} on={c.partner === k} onClick={() => setC({ ...c, partner: k })} label={`${PARTNERS[k].name}: ${PARTNERS[k].does}`}>
            {SHORT_PART[k]}
          </Tool>
        ))}
      </div>
      <div className="csa-pick" role="group" aria-label="When to plant">
        <small>Plant</small>
        {(Object.keys(WHEN_PLANT) as PlantWhen[]).map(k => (
          <Tool key={k} on={c.when === k} onClick={() => setC({ ...c, when: k })} label={WHEN_PLANT[k]}>
            {SHORT_WHEN[k]}
          </Tool>
        ))}
      </div>
      <Go onClick={plant}>🌱 Plant and watch</Go>
    </>
  );
  return <GameFrame label="Seed and intercropping" stage={stage} side={side} />;
}
