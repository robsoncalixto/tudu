import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";

interface Props {
  t: Dictionary;
  title: string;
  today: string;
  date: { weekday: string; rest: string } | null;
  open: number;
  done: number;
  loading: boolean;
  failed: boolean;
}

export function BoardHeader({ t, title, date, today, open, done, loading, failed }: Props) {
  return <header className="board-header">
    <div>
      {/* The line is there before the day is known, so the title under it never moves. */}
      {date ? <time className="board-date" dateTime={today}>
        <Icon name="calendar" size={15} /><span>{date.weekday}</span>, <span>{date.rest}</span>
      </time> : <span className="board-date" aria-hidden="true">&nbsp;</span>}
      <h1>{title}</h1>
    </div>
    {loading ? <p className="hint">{t.loading}</p> : !failed && <div className="view-tally">
      <div><span>{t.countOpen(open)}</span><span>{t.countDone(done)}</span></div>
      <progress aria-label={t.viewProgress} value={done} max={Math.max(open + done, 1)} />
    </div>}
  </header>;
}
