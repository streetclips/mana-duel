export interface CardSlot {
  sideways: boolean;
}

export function fitCardScale(
  width: number,
  height: number,
  slots: CardSlot[],
  cardWidth: number,
  cardHeight: number,
  gap = 8,
  minScale = 0.5,
): number {
  if (slots.length === 0 || width <= 0 || height <= 0) return 1;
  for (let step = 0; ; step++) {
    const scale = Math.max(minScale, 1 - step * 0.04);
    const w = cardWidth * scale;
    const h = cardHeight * scale;
    const g = gap * scale;
    let rows = 1;
    let x = 0;
    for (const slot of slots) {
      const slotWidth = slot.sideways ? h : w;
      const next = x === 0 ? slotWidth : x + g + slotWidth;
      if (next > width && x > 0) {
        rows += 1;
        x = slotWidth;
      } else {
        x = next;
      }
    }
    if (rows * h + (rows - 1) * g <= height || scale === minScale) return Math.round(scale * 100) / 100;
  }
}
