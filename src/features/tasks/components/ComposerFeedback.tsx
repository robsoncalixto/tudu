import type { QuickAddProblem, QuickWarning } from "@/features/quick-add/schema";
import type { Dictionary } from "@/i18n";
import { Icon } from "@/lib/Icon";

interface Props {
  t: Dictionary;
  /** What the field could not read and left in the title. */
  warnings: QuickWarning[];
  /** Why the text cannot be saved. */
  problem: QuickAddProblem | null;
  /** How many lines hold a task. One line is not called by its number. */
  lines: number;
  tagLimit: boolean;
}

function problemText(problem: QuickAddProblem, lines: number, t: Dictionary): string {
  if (!("line" in problem)) return problem.kind === "line_limit" ? t.quickLineLimit : t.quickTextLimit;
  const line = lines > 1 ? problem.line : null;
  if (problem.kind === "tag_limit") return t.quickTagsOnLine(line);
  if (problem.kind === "title_missing") return t.quickTitleMissing(line);
  if (problem.kind === "title_long") return t.quickTitleLong(line);
  return t.quickInvalidLine(problem.line);
}

/** One message says what is wrong, in the line kept free for it under the field: the list below does not move. */
export function ComposerFeedback({ t, warnings, problem, lines, tagLimit }: Props) {
  return <div id="composer-feedback" className="composer-feedback">
    {warnings.map((warning) => <p className="hint" aria-live="polite" key={`${warning.start}-${warning.text}`}>
      <Icon name="info" size={14} />{warning.kind === "date" ? t.composerInvalidDate(warning.text) : t.composerUnknownProject(warning.text)}
    </p>)}
    {problem && <p className="hint is-error" role="alert">{problemText(problem, lines, t)}</p>}
    {tagLimit && <p className="hint is-error" role="alert">{t.composerTagLimit}</p>}
  </div>;
}
