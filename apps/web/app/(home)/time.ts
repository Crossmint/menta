/** A length of time as people write it in `tag`: "6m 40s". */
export function duration(tag: string, seconds: number) {
  const unit = (value: number, name: "minute" | "second") =>
    new Intl.NumberFormat(tag, {
      style: "unit",
      unit: name,
      unitDisplay: "narrow",
    }).format(value);
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (!minutes) {
    return unit(rest, "second");
  }
  return rest
    ? `${unit(minutes, "minute")} ${unit(rest, "second")}`
    : unit(minutes, "minute");
}
