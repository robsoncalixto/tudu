"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";
import { shortcutsApi } from "../api";
import { SHORTCUT_SCOPES, type ShortcutBinding } from "../schema";
import { isCharacterBinding, keycaps } from "../selectors";
import "./shortcuts.css";

export function ShortcutSheet({ t, open, onClose }: { t: Dictionary; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [mac, setMac] = useState(false);
  const [characters, setCharacters] = useState(true);
  const s = t.shortcuts;

  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.userAgent));
    const read = () => setCharacters(shortcutsApi.charactersEnabled());
    read();
    return shortcutsApi.watchCharacters(read);
  }, []);

  useEffect(() => {
    const node = dialog.current;
    if (open && !node?.open) { node?.showModal(); node?.scrollTo(0, 0); }
    else if (!open && node?.open) node.close();
  }, [open]);

  const keyName = (cap: string) => Object.hasOwn(s.keys, cap) ? s.keys[cap as keyof typeof s.keys] : cap;
  function binding({ keys }: ShortcutBinding) {
    return keys.map((chord, step) => <Fragment key={chord}>
      {step > 0 && <span className="shortcut-join">{s.then}</span>}
      <span className="shortcut-chord">{keycaps(chord, mac).map((cap) => <kbd key={cap}>{keyName(cap)}</kbd>)}</span>
    </Fragment>);
  }

  return <dialog ref={dialog} className="card shortcut-sheet" aria-labelledby={`${id}-title`} onClose={onClose}>
    <header>
      <h2 id={`${id}-title`}>{s.title}</h2>
      <button type="button" className="icon-btn" aria-label={t.close} title={t.close} autoFocus onClick={() => dialog.current?.close()}>
        <Icon name="x" />
      </button>
    </header>
    <section aria-labelledby={`${id}-syntax`}>
      <h3 id={`${id}-syntax`}>{s.syntaxTitle}</h3>
      <p className="hint">{s.syntaxHint}</p>
      <dl className="shortcut-list">
        {s.syntax.map(({ token, meaning }) => <div key={token}><dt>{meaning}</dt><dd><code>{token}</code></dd></div>)}
      </dl>
    </section>
    <p className="hint">{s.intro}</p>
    <label className="shortcut-toggle">
      <input type="checkbox" checked={characters} aria-describedby={`${id}-characters`}
        onChange={(event) => shortcutsApi.setCharactersEnabled(event.target.checked)} />
      <span>{s.characters}</span>
    </label>
    <p className="hint" id={`${id}-characters`}>{s.charactersHint}</p>
    {SHORTCUT_SCOPES.map((scope) => <section key={scope} aria-labelledby={`${id}-${scope}`}>
      <h3 id={`${id}-${scope}`}>{s.scopes[scope]}</h3>
      <dl className="shortcut-list">
        {shortcutsApi.list().filter((shortcut) => shortcut.scope === scope).map((shortcut) => <div key={shortcut.id}>
          <dt>{s.labels[shortcut.id]}</dt>
          <dd>{shortcut.bindings.map((item, index) => <Fragment key={item.keys.join(" ")}>
            {index > 0 && <span className="shortcut-join">{s.or}</span>}
            <span className="shortcut-binding" data-off={!characters && isCharacterBinding(item) || undefined}>{binding(item)}</span>
          </Fragment>)}</dd>
        </div>)}
      </dl>
    </section>)}
  </dialog>;
}
