export const SCENES = ['plains', 'island', 'swamp', 'mountain', 'forest'] as const;

export type SceneId = (typeof SCENES)[number];

export type SceneMode = 'menu' | 'game';

export const SCENE_MS = 16_000;

const SCENE_KEY = 'manaDuel.scene';

export function isSceneId(value: unknown): value is SceneId {
  return typeof value === 'string' && (SCENES as readonly string[]).includes(value);
}

export function nextScene(scene: SceneId): SceneId {
  return SCENES[(SCENES.indexOf(scene) + 1) % SCENES.length] ?? SCENES[0];
}

export function loadScene(): SceneId | null {
  try {
    const stored = localStorage.getItem(SCENE_KEY);
    return isSceneId(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function saveScene(scene: SceneId): void {
  try {
    localStorage.setItem(SCENE_KEY, scene);
  } catch {
    return;
  }
}

export function sceneFrom(params: URLSearchParams): SceneId | null {
  const value = params.get('scene');
  return isSceneId(value) ? value : null;
}

export function firstScene(pinned: SceneId | null, stored: SceneId | null): SceneId {
  if (pinned) return pinned;
  return stored ? nextScene(stored) : SCENES[0];
}
