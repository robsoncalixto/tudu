import { LOCALES, type Dictionary, type Locale } from "@/i18n";
import type { TaskView } from "../selectors";

interface Props {
  t: Dictionary;
  locale: Locale;
  onLocale: (locale: Locale) => void;
  openCount: number;
  tagCounts: TaskView["tagCounts"];
  tagFilter: string | null;
  onTag: (tag: string | null) => void;
}

const LOCALE_LABEL: Record<Locale, string> = { en: "EN", "pt-BR": "PT" };

export function Sidebar({ t, locale, onLocale, openCount, tagCounts, tagFilter, onTag }: Props) {
  // A tag stays listed while it is the active filter, even with no open tasks left.
  const tags =
    tagFilter && !tagCounts.some(([tag]) => tag === tagFilter)
      ? [[tagFilter, 0] as [string, number], ...tagCounts]
      : tagCounts;

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-name">TUDU</span>
      </div>

      <nav className="nav" aria-label={t.tags}>
        <NavItem label={t.allTasks} count={openCount} active={tagFilter === null} onClick={() => onTag(null)} />
        {tags.length > 0 && <p className="nav-label">{t.tags}</p>}
        {tags.map(([tag, count]) => (
          <NavItem key={tag} label={`#${tag}`} count={count} active={tagFilter === tag} onClick={() => onTag(tag)} />
        ))}
      </nav>

      <div className="locale" role="group" aria-label={t.language}>
        {LOCALES.map((code) => (
          <button
            type="button"
            key={code}
            className={code === locale ? "is-active" : ""}
            aria-pressed={code === locale}
            onClick={() => onLocale(code)}
          >
            {LOCALE_LABEL[code]}
          </button>
        ))}
      </div>
    </aside>
  );
}

function NavItem(props: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`nav-item${props.active ? " is-active" : ""}`}
      aria-current={props.active ? "page" : undefined}
      onClick={props.onClick}
    >
      <span>{props.label}</span>
      <span className="nav-count">{props.count}</span>
    </button>
  );
}
