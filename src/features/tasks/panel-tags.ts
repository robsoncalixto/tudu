export function formatPanelTags(tags: string[]) {
  return tags.map((tag) => tag.replaceAll("\\", "\\\\").replaceAll(",", "\\,")).join(", ");
}

export function parsePanelTags(value: string) {
  const tags: string[] = [];
  let tag = "";
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === "\\" && (value[index + 1] === "," || value[index + 1] === "\\")) tag += value[++index];
    else if (char === ",") {
      if (tag.trim()) tags.push(tag.trim());
      tag = "";
    } else tag += char;
  }
  if (tag.trim()) tags.push(tag.trim());
  return tags;
}
