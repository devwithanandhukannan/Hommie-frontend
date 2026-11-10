'use client';
import Link from 'next/link';
import { Icon, Spinner, Btn } from '@/components/ui';
import StepTimeline from '@/components/StepTimeline';
import {
  actionKind,
  actionIconName,
  actionTypeLabel,
  formatActionSubtitle,
  smartApplyLabel,
  destinationLinks,
} from '@/lib/aiActions';

/**
 * Unified, human-grouped action card list shared across Family Chat, Hommi AI Chat, and Quick Add AI Modal.
 */
export default function AiActionsList({
  actions = [],
  selected = [],
  onToggle,
  onApply,
  applying = false,
  applied = false,
  lang = 'en',
  hasInlineSteps = false,
  secondaryAction = null,
  onNavigate = null,
}) {
  const ml = lang === 'ml';

  if (applied) {
    const links = destinationLinks(selected, lang);
    return (
      <div className="ai-saved-panel">
        <div className="ai-applied-badge" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="check" size={16} />
          <span>{ml ? 'സേവ് ചെയ്തു!' : 'Saved to Hommi!'}</span>
        </div>
        {links.length > 0 ? (
          <div className="ai-saved-links">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="ai-saved-link" onClick={() => onNavigate?.()}>
                <span>{l.label}</span>
                <span aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (!actions || actions.length === 0) return null;

  const mealActions = actions.filter((a) => actionKind(a.type) === 'meal');
  const recipeActions = actions.filter((a) => actionKind(a.type) === 'recipe');
  const groceryActions = actions.filter((a) => actionKind(a.type) === 'grocery');
  const otherActions = actions.filter((a) => !['meal', 'recipe', 'grocery'].includes(actionKind(a.type)));

  const groceriesByShop = {};
  for (const g of groceryActions) {
    const shop = g.shop || (ml ? 'പലചരക്ക്' : 'Groceries');
    if (!groceriesByShop[shop]) groceriesByShop[shop] = [];
    groceriesByShop[shop].push(g);
  }

  const groupCount =
    (mealActions.length > 0 ? 1 : 0) +
    (recipeActions.length > 0 ? 1 : 0) +
    (groceryActions.length > 0 ? 1 : 0) +
    (otherActions.length > 0 ? 1 : 0);

  const renderRow = (act, key, { showBadge = true } = {}) => {
    const isSelected = selected.includes(act);
    const sub = formatActionSubtitle(act, lang);
    const badge = showBadge ? actionTypeLabel(act.type, lang) : '';

    return (
      <label key={key} className={`ai-chip-item ${!isSelected ? 'deselected' : ''}`}>
        <input
          type="checkbox"
          className="ai-chip-checkbox"
          checked={isSelected}
          onChange={() => onToggle(act)}
        />
        <span className="ai-chip-icon">
          <Icon name={actionIconName(act.type)} size={16} />
        </span>
        <span className="ai-chip-main">
          <span className="ai-chip-title">{act.title}</span>
          {sub ? <span className="ai-chip-sub">{sub}</span> : null}
        </span>
        {badge ? <span className="ai-chip-tag">{badge}</span> : null}
      </label>
    );
  };

  const buttonLabel = smartApplyLabel(selected, lang);

  return (
    <div className="col" style={{ gap: 12 }}>
      {/* Meal Plan Section */}
      {mealActions.length > 0 ? (
        <div className="ai-group">
          {groupCount > 1 ? (
            <div className="ai-group-head">{ml ? 'ഭക്ഷണ പ്ലാൻ' : 'Meal Plan'}</div>
          ) : null}
          <div className="col" style={{ gap: 6 }}>
            {mealActions.map((act, idx) => renderRow(act, `meal-${idx}`, { showBadge: true }))}
          </div>
        </div>
      ) : null}

      {/* Save to Recipe Section */}
      {recipeActions.length > 0 ? (
        <div className="ai-group">
          {groupCount > 1 ? (
            <div className="ai-group-head">{ml ? 'പാചകക്കുറിപ്പ്' : 'Recipe'}</div>
          ) : null}
          <div className="col" style={{ gap: 8 }}>
            {recipeActions.map((act, idx) => (
              <div key={`rec-${idx}`} className="col" style={{ gap: 6 }}>
                {renderRow(act, `rec-row-${idx}`, { showBadge: true })}
                {!hasInlineSteps && act.steps?.length ? (
                  <div className="ai-act-steps-box">
                    <StepTimeline steps={act.steps} title={ml ? 'തയ്യാറാക്കുന്ന വിധം' : 'Steps'} estimate />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Groceries Grouped by Shop */}
      {groceryActions.length > 0 ? (
        <div className="ai-group">
          {Object.entries(groceriesByShop).map(([shopName, items]) => (
            <div key={shopName} className="col" style={{ gap: 6 }}>
              <div className="ai-group-head row" style={{ gap: 5, alignItems: 'center' }}>
                <Icon name="store" size={12} />
                <span>{ml ? `വാങ്ങേണ്ടവ · ${shopName}` : `Buy Groceries · ${shopName}`}</span>
              </div>
              <div className="col" style={{ gap: 6 }}>
                {items.map((act, idx) => renderRow(act, `groc-${shopName}-${idx}`, { showBadge: false }))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Calendar / Tasks / Expenses / Bills */}
      {otherActions.length > 0 ? (
        <div className="ai-group">
          {groupCount > 1 ? (
            <div className="ai-group-head">{ml ? 'മറ്റു കാര്യങ്ങൾ' : 'Schedule & Tasks'}</div>
          ) : null}
          <div className="col" style={{ gap: 6 }}>
            {otherActions.map((act, idx) => renderRow(act, `other-${idx}`, { showBadge: true }))}
          </div>
        </div>
      ) : null}

      <div className="row" style={{ gap: 10, marginTop: 2 }}>
        {secondaryAction}
        <Btn
          type="button"
          className="grow"
          disabled={applying || selected.length === 0}
          onClick={onApply}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          {applying ? (
            <Spinner size={14} />
          ) : (
            <>
              <Icon name="check" size={15} />
              <span>{buttonLabel}</span>
            </>
          )}
        </Btn>
      </div>
    </div>
  );
}

