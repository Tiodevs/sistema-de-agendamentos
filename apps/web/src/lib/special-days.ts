/**
 * UX-05: "próximos" e "passados" pelo dia civil de São Paulo (`YYYY-MM-DD`), nunca pela data UTC
 * (depois das 21h em Brasília, o dia UTC já é o seguinte). Sem imports com "@/" para os testes.
 */
export function splitSpecialDays<T extends { date: string }>(days: T[], todayKey: string) {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const day of days) {
    if (day.date.slice(0, 10) >= todayKey) upcoming.push(day);
    else past.push(day);
  }
  return { upcoming, past };
}
