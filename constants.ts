export const TIME_SLOTS: string[] = [];
for (let h = 8; h < 24; h++) {
    TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:00`);
    if (h < 23) {
      TIME_SLOTS.push(`${h.toString().padStart(2, '0')}:30`);
    }
}
