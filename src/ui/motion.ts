import { isPlayerTarget, type CardId, type PlayerId, type Target } from '../engine';
import { setFxClockFrozen, type FxEntry } from './fx';

const LUNGE_MS = 420;
const LUNGE_REACH_PX = 42;
const LUNGE_SHARE = 0.4;
const SHAKE_MS = 380;
const BUMP_MS = 340;

const SHAKE: Keyframe[] = [
  { translate: '0 0' },
  { translate: '-5px 0' },
  { translate: '4px 0' },
  { translate: '-3px 0' },
  { translate: '2px 0' },
  { translate: '0 0' },
];

const BUMP: Keyframe[] = [{ scale: '1' }, { scale: '1.14' }, { scale: '1' }];

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function slotOf(root: HTMLElement, card: CardId): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-slot="${card}"]`);
}

function chipOf(root: HTMLElement, player: PlayerId): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-testid="player-${player}"]`);
}

function targetElement(root: HTMLElement, target: Target): HTMLElement | null {
  return isPlayerTarget(target) ? chipOf(root, target.player) : slotOf(root, target.card);
}

function center(element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function start(element: HTMLElement, id: string, keyframes: Keyframe[], options: KeyframeAnimationOptions): void {
  const animation = element.animate(keyframes, { ...options, id });
  animation.id = id;
}

function run(element: HTMLElement | null, id: string, keyframes: Keyframe[], duration: number, delay: number, time: number): void {
  if (!element || typeof element.animate !== 'function') return;
  start(element, id, keyframes, { duration: duration * time, delay: delay * time, easing: 'ease-out', composite: 'add' });
}

function lunge(root: HTMLElement, card: CardId, target: Target, time: number): void {
  const from = slotOf(root, card);
  const to = targetElement(root, target);
  if (!from || !to || typeof from.animate !== 'function') return;
  const a = center(from);
  const b = center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const scale = distance === 0 ? 0 : Math.min(LUNGE_REACH_PX, distance * LUNGE_SHARE) / distance;
  const reach = `${Math.round(dx * scale)}px ${Math.round(dy * scale)}px`;
  start(
    from,
    'fx-lunge',
    [
      { translate: '0 0', zIndex: '6' },
      { translate: reach, zIndex: '6', offset: 0.42 },
      { translate: '0 0', zIndex: '6' },
    ],
    { duration: LUNGE_MS * time, easing: 'cubic-bezier(0.5, 0, 0.3, 1)' },
  );
}

export function playMotions(root: HTMLElement, entries: FxEntry[], human: PlayerId, time: number): void {
  if (time <= 0 || prefersReducedMotion()) return;
  const bumped = new Set<string>();
  const bumpOnce = (key: string, element: HTMLElement | null, delay = 0): void => {
    if (bumped.has(key)) return;
    bumped.add(key);
    run(element, 'fx-bump', BUMP, BUMP_MS, delay, time);
  };
  const lunged = new Set<string>();
  for (const entry of entries) {
    const cue = entry.cue;
    switch (cue.kind) {
      case 'strike':
        if (lunged.has(`${entry.seq}:${cue.card}`)) break;
        lunged.add(`${entry.seq}:${cue.card}`);
        lunge(root, cue.card, cue.target, time);
        break;
      case 'damage':
        run(slotOf(root, cue.card), 'fx-shake', SHAKE, SHAKE_MS, entry.delay, time);
        break;
      case 'life':
        if (cue.delta < 0) run(chipOf(root, cue.player), 'fx-shake', SHAKE, SHAKE_MS, entry.delay, time);
        bumpOnce(`life-${cue.player}`, root.querySelector<HTMLElement>(`[data-testid="life-${cue.player}"]`), entry.delay);
        break;
      case 'ability':
        bumpOnce(`card-${cue.card}`, slotOf(root, cue.card));
        break;
      case 'draw':
        if (cue.player !== human) bumpOnce(`counts-${cue.player}`, root.querySelector<HTMLElement>(`[data-testid="counts-${cue.player}"]`));
        break;
      case 'discard':
        bumpOnce(`counts-${cue.player}`, root.querySelector<HTMLElement>(`[data-testid="counts-${cue.player}"]`));
        break;
      default:
        break;
    }
  }
}

function isFxAnimation(animation: Animation): boolean {
  return fxAnimationName(animation).startsWith('fx-');
}

function isTransition(animation: Animation): boolean {
  return 'transitionProperty' in animation;
}

function isPlaying(animation: Animation): boolean {
  return animation.playState === 'running' || animation.playState === 'paused';
}

function fxAnimationName(animation: Animation): string {
  if (animation.id) return animation.id;
  return 'animationName' in animation ? String(animation.animationName) : '';
}

export async function freezeFx(progress: number | null = 0.5): Promise<string[]> {
  await Promise.resolve();
  if (typeof document === 'undefined' || typeof document.getAnimations !== 'function') return [];
  const animations = document
    .getAnimations()
    .filter((animation) => (isFxAnimation(animation) || isTransition(animation)) && isPlaying(animation));
  setFxClockFrozen(progress !== null);
  for (const animation of animations) {
    if (progress === null) {
      if (animation.playState === 'paused') animation.play();
      continue;
    }
    const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
    animation.pause();
    animation.currentTime = end * Math.min(1, Math.max(0, progress));
  }
  return animations.filter(isFxAnimation).map(fxAnimationName);
}
