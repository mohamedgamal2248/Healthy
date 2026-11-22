/** Content shown to people other than the author must carry no health-derived notices (conditions leak). */
export function publicContent<T extends { cautions?: unknown; doctor_note?: unknown }>(content: T): T {
  return { ...content, cautions: [], doctor_note: null };
}
