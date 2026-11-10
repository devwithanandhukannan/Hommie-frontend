'use client';
import { useState } from 'react';

/** Rounded rows with a dark round + button that opens into a soft card. */
export default function Accordion({ items, defaultOpen = null }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="acc">
      {items.map((it) => {
        const isOpen = open === it.id;
        return (
          <div key={it.id} className={`acc-item ${isOpen ? 'open' : ''}`}>
            <button type="button" className="acc-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : it.id)}>
              <span className="grow">{it.title}</span>
              {it.badge ? <span className="chip">{it.badge}</span> : null}
              <span className="acc-btn" aria-hidden="true">{isOpen ? '×' : '+'}</span>
            </button>
            {isOpen ? <div className="acc-body">{it.body}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
