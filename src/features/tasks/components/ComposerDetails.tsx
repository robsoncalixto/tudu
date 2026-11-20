import { Icon } from "@/lib/Icon";
import type { Dictionary } from "@/i18n";
import { PRIORITIES, type Priority } from "../schema";

export function ComposerDetails({ t, priority, due, tag, suggestions, busy, onPriority, onDue, onTag, onAddTag }: {
  t: Dictionary; priority: Priority; due: string; tag: string; suggestions: string[]; busy: boolean;
  onPriority: (priority: Priority) => void; onDue: (due: string) => void; onTag: (tag: string) => void; onAddTag: () => void;
}) {
  return <fieldset className="composer-details" disabled={busy}>
    <legend className="sr-only">{t.composerDetails}</legend>
    <label>{t.priority}
      <select aria-label={t.composerPriority} className="select-control" value={priority}
        onChange={(event) => onPriority(event.target.value as Priority)}>
        {PRIORITIES.map((option) => <option key={option} value={option}>{t[option]}</option>)}
      </select>
    </label>
    <label>{t.setDate}
      <input aria-label={t.composerDue} className="form-control" type="date" value={due}
        onChange={(event) => onDue(event.target.value)} />
    </label>
    <div className="composer-tags">
      <label>{t.tags}
        <input aria-label={t.composerTag} className="form-control" value={tag} list="composer-tag-suggestions"
          maxLength={40} onChange={(event) => onTag(event.target.value)} onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            onAddTag();
          }} />
      </label>
      <datalist id="composer-tag-suggestions">
        {suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
      </datalist>
      <button type="button" className="btn btn-secondary composer-add-tag" aria-label={t.composerAddTag} title={t.composerAddTag}
        disabled={!tag.trim()} onClick={onAddTag}><Icon name="plus" size={15} /></button>
    </div>
  </fieldset>;
}
