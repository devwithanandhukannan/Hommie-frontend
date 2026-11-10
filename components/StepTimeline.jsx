'use client';
import { useState } from 'react';
import { Icon } from '@/components/ui';

/**
 * Extracts explicit durations (e.g. "30 minutes", "15-20 min", "1 hr", "20 മിനിറ്റ്")
 * or estimates an appropriate cooking step duration when `estimate` is true.
 */
export function extractStepDuration(raw, { estimate = false } = {}) {
  const s = String(raw || '').trim();
  if (!s) return null;

  // Match explicit range first: "15-20 minutes", "10 to 15 mins"
  const rangeMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?|min\b|seconds?|secs?|മണിക്കൂർ|മിനിറ്റ്)/i);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    const unit = rangeMatch[3].toLowerCase();
    const avg = (a + b) / 2;
    if (/hour|hr|h\b|മണിക്കൂർ/.test(unit)) {
      return { label: `${a}–${b} hr`, minutes: Math.round(avg * 60), estimated: false };
    }
    if (/sec/.test(unit)) {
      return { label: `${a}–${b} sec`, minutes: Math.max(1, Math.round(avg / 60)), estimated: false };
    }
    return { label: `${a}–${b} min`, minutes: Math.round(avg), estimated: false };
  }

  // Match single explicit duration: "30 minutes", "20 min", "1.5 hours", "20 മിനിറ്റ്"
  const singleMatch = s.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h\b|minutes?|mins?|min\b|seconds?|secs?|മണിക്കൂർ|മിനിറ്റ്)/i);
  if (singleMatch) {
    const val = Number(singleMatch[1]);
    const unit = singleMatch[2].toLowerCase();
    if (/hour|hr|h\b|മണിക്കൂർ/.test(unit)) {
      const mins = Math.round(val * 60);
      return { label: `${val} hr`, minutes: mins, estimated: false };
    }
    if (/sec/.test(unit)) {
      return { label: `${val} sec`, minutes: 1, estimated: false };
    }
    return { label: `${Math.round(val)} min`, minutes: Math.round(val), estimated: false };
  }

  if (!estimate) return null;

  const low = s.toLowerCase();
  if (/(?:\bdum\b|\bbake\b|\broast\b|pressure cook|whistle|slow cook|\bsimmer\b|cook until (?:tender|soft|done)|സ്റ്റീം|വേവിക്കുക)/.test(low)) {
    return { label: '~15 min', minutes: 15, estimated: true };
  }
  if (/(?:\bsaut[eé]\b|golden brown|carameliz|deep fry|pan fry|shallow fry|\bboil\b|\brice\b|\bpasta\b|വഴറ്റുക)/.test(low)) {
    return { label: '~10 min', minutes: 10, estimated: true };
  }
  if (/(?:\bmarinate\b|\bsoak\b|\bchill\b|\bfreeze\b|\bproof\b|set aside|മാരിനേറ്റ്|കുതിർക്കുക)/.test(low)) {
    return { label: '~25 min', minutes: 25, estimated: true };
  }
  if (/(?:\blayer\b|\bgarnish\b|\bserve\b|\bplate\b|\btemper\b|\btadka\b|\bassemble\b|വിളമ്പുക)/.test(low)) {
    return { label: '~3 min', minutes: 3, estimated: true };
  }
  return { label: '~5 min', minutes: 5, estimated: true };
}

export function formatTotalTime(totalMinutes) {
  if (!totalMinutes || totalMinutes <= 0) return '';
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins ? `${hrs} hr ${mins} min` : `${hrs} hr`;
}

/** Renders simple **bold** spans safely without HTML injection. */
export function InlineMarkdown({ text }) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** Parses AI markdown replies into structured paragraphs, ingredients lists, and numbered step timelines. */
export function parseAiReply(text, { hasRecipeAction = false, missingNames = [] } = {}) {
  const lines = String(text || '').split('\n');
  const blocks = [];
  let currentHeading = '';
  let textBuf = [];
  let bulletBuf = [];
  let stepBuf = [];

  const isRecipeContext = hasRecipeAction || /(ingredients?|simple steps|instructions|directions|ചേരുവകൾ|തയ്യാറാക്കുന്ന വിധം)/i.test(text || '');

  const flushText = () => {
    const joined = textBuf.join('\n').trim();
    if (joined) blocks.push({ type: 'text', text: joined });
    textBuf = [];
  };

  const flushBullets = () => {
    if (!bulletBuf.length) return;
    const isIngredients = /ingredient|ചേരുവ/i.test(currentHeading);
    if (isIngredients) {
      const parsed = bulletBuf.map((raw) => {
        const clean = raw.replace(/\*\*/g, '').trim();
        const inKitchen = /\((?:already available|in (?:your )?kitchen|in stock|available|അടുക്കളയിലുള്ളത്|അടുക്കളയിൽ ഉണ്ട്|സ്റ്റോക്കിലുണ്ട്|കയ്യിലുള്ളത്|ഉണ്ട്)[^)]*\)/i.test(clean);
        const explicitMissing = /\((?:not in (?:your )?kitchen|need to buy|missing|to buy|buy|അടുക്കളയിൽ ഇല്ല|വാങ്ങാനുള്ളത്|ഇല്ല)[^)]*\)/i.test(clean);
        const withoutNote = clean
          .replace(/\s*\((?:already available|in (?:your )?kitchen|in stock|available|not in (?:your )?kitchen|need to buy|missing|to buy|അടുക്കളയിലുള്ളത്|അടുക്കളയിൽ ഉണ്ട്|സ്റ്റോക്കിലുണ്ട്|കയ്യിലുള്ളത്|അടുക്കളയിൽ ഇല്ല|വാങ്ങാനുള്ളത്)[^)]*\)/gi, '')
          .trim();
        const sepMatch = withoutNote.match(/^(.*?)\s*(?::|\s[-–—]\s)\s*(.+)$/);
        if (sepMatch && sepMatch[1].trim().length > 0 && sepMatch[1].trim().length < 60) {
          return {
            name: sepMatch[1].trim(),
            qty: sepMatch[2].trim(),
            inKitchen,
            explicitMissing,
          };
        }
        return { name: withoutNote, qty: '', inKitchen, explicitMissing };
      });
      const normMissing = missingNames.map((n) => String(n || '').trim().toLowerCase()).filter(Boolean);
      const hasStockSignals = parsed.some((it) => it.inKitchen || it.explicitMissing) || normMissing.length > 0;
      const items = parsed.map((it) => {
        const lowName = it.name.toLowerCase();
        const matchesAction = normMissing.some((m) => lowName.includes(m) || m.includes(lowName));
        const missing = !it.inKitchen && (it.explicitMissing || matchesAction || hasStockSignals);
        return { name: it.name, qty: it.qty, inKitchen: it.inKitchen, missing };
      });
      blocks.push({ type: 'ingredients', title: currentHeading || 'Ingredients', items });
    } else {
      blocks.push({ type: 'bullets', items: [...bulletBuf] });
    }
    bulletBuf = [];
  };

  const flushSteps = () => {
    if (!stepBuf.length) return;
    blocks.push({
      type: 'steps',
      title: currentHeading || 'Steps',
      steps: [...stepBuf],
      isRecipe: isRecipeContext || /step|method|instruction|direction|വിധം/i.test(currentHeading),
    });
    stepBuf = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushText();
      flushBullets();
      flushSteps();
      continue;
    }

    // Heading line like "**Ingredients:**" or "### Simple Steps:"
    const headingMatch = line.match(/^(?:#{1,4}\s*|\*\*)?([^*:#]+?):?\*\*$/i) || line.match(/^#{1,4}\s+(.+?):?$/);
    if (headingMatch && line.length < 60 && !/^\d+\./.test(line) && !/^[-*•]\s/.test(line)) {
      flushText();
      flushBullets();
      flushSteps();
      currentHeading = headingMatch[1].replace(/\*\*/g, '').replace(/:$/, '').trim();
      blocks.push({ type: 'heading', text: currentHeading });
      continue;
    }

    // Bullet item "- ..."
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      flushText();
      flushSteps();
      bulletBuf.push(bulletMatch[1]);
      continue;
    }

    // Numbered step "1. ..." or "1) ..."
    const stepMatch = line.match(/^\d+[.)]\s+(.+)$/);
    if (stepMatch) {
      flushText();
      flushBullets();
      stepBuf.push(stepMatch[1].replace(/^\*\*/, '').replace(/\*\*$/, ''));
      continue;
    }

    flushBullets();
    flushSteps();
    textBuf.push(rawLine);
  }

  flushText();
  flushBullets();
  flushSteps();

  // Avoid duplicate standalone heading directly above an ingredients/steps block that renders its own title
  return blocks.filter((b, idx) => {
    if (b.type !== 'heading') return true;
    const next = blocks[idx + 1];
    return !(next && (next.type === 'ingredients' || next.type === 'steps'));
  });
}

export default function StepTimeline({ steps = [], title = 'Steps', estimate = true, interactive = true }) {
  const [done, setDone] = useState(() => new Set());
  if (!Array.isArray(steps) || !steps.length) return null;

  const cleanStepText = (raw) =>
    String(raw || '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/\s*\((?:~|approx\.?\s*)?\d+(?:\.\d+)?(?:\s*(?:-|to|–)\s*\d+(?:\.\d+)?)?\s*(?:hours?|hrs?|h|minutes?|mins?|min|seconds?|secs?|മണിക്കൂർ|മിനിറ്റ്)\)(\.?)$/i, '$1')
      .trim();

  const parsed = steps.map((stepText) => ({
    text: cleanStepText(stepText),
    duration: extractStepDuration(stepText, { estimate }),
  }));

  const totalMinutes = parsed.reduce((acc, s) => acc + (s.duration?.minutes || 0), 0);
  const totalLabel = formatTotalTime(totalMinutes);
  const hasAnyEstimated = parsed.some((s) => s.duration?.estimated);

  const toggle = (idx) => {
    if (!interactive) return;
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="step-tl-wrap">
      <div className="step-tl-head">
        <span className="step-tl-dot-head" aria-hidden="true" />
        <span className="step-tl-title">{title}</span>
        <span className="step-tl-summary">
          {parsed.length} {parsed.length === 1 ? 'step' : 'steps'}
          {totalLabel ? ` · ${hasAnyEstimated ? '~' : ''}${totalLabel}` : ''}
        </span>
      </div>

      <div className="step-tl-list">
        <svg className="step-tl-curve" width="38" height="34" viewBox="0 0 38 34" aria-hidden="true">
          <path d="M 8 0 C 8 15, 28 13, 28 34" />
        </svg>

        {parsed.map((item, idx) => {
          const isDone = done.has(idx);
          const isFirst = idx === 0;
          const isLast = idx === parsed.length - 1;
          return (
            <div
              key={idx}
              className={`step-tl-item ${isFirst ? 'is-first' : ''} ${isLast ? 'is-last' : ''} ${isDone ? 'is-done' : ''}`}
            >
              <button
                type="button"
                className="step-tl-pill"
                aria-label={interactive ? `Step ${idx + 1}${isDone ? ' completed' : ''}` : undefined}
                aria-pressed={interactive ? isDone : undefined}
                onClick={() => toggle(idx)}
              >
                <span className="step-tl-node" aria-hidden="true">
                  {isDone ? <Icon name="check" size={11} /> : <span>{idx + 1}</span>}
                </span>
                <span className="step-tl-body">
                  <InlineMarkdown text={item.text} />
                </span>
                {item.duration ? (
                  <span className={`step-tl-time ${item.duration.estimated ? 'is-est' : ''}`} title={item.duration.estimated ? 'Estimated time' : 'Duration'}>
                    {item.duration.label}
                  </span>
                ) : null}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
