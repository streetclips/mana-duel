import { useMemo } from 'preact/hooks';
import { ART_HEIGHT, ART_WIDTH, SCENE_ART, SCENE_LAYERS } from '../sceneArt';
import { SCENES, type SceneId, type SceneMode } from '../scenery';

interface BackdropProps {
  scene: SceneId;
  mode: SceneMode;
}

const GLOWS: Record<string, string> = { glow: 'glow', 'lamp-glow': 'lamp' };

const GLOW_STOPS = [
  [0, 0.6],
  [0.28, 0.3],
  [0.62, 0.09],
  [1, 0],
] as const;

function Glows({ id }: { id: SceneId }) {
  return (
    <defs>
      {Object.values(GLOWS).map((glow) => (
        <radialGradient key={glow} id={`scene-${glow}-${id}`}>
          {GLOW_STOPS.map(([offset, opacity]) => (
            <stop key={offset} class={`sc-${glow}-stop`} offset={offset} stop-opacity={opacity} />
          ))}
        </radialGradient>
      ))}
    </defs>
  );
}

function SceneLayers({ id }: { id: SceneId }) {
  const art = SCENE_ART[id];
  return (
    <>
      {SCENE_LAYERS.filter((layer) => art[layer].length > 0).map((layer) => (
        <svg
          key={layer}
          class={`scene-layer ${layer}`}
          viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}
          preserveAspectRatio="xMidYMax slice"
        >
          {layer === 'sky' && <Glows id={id} />}
          {art[layer].map((shape, index) => {
            const glow = GLOWS[shape.tone];
            return (
              <path
                key={index}
                class={`sc-${shape.tone}`}
                d={shape.d}
                fill={glow ? `url(#scene-${glow}-${id})` : undefined}
                stroke-width={shape.width}
              />
            );
          })}
        </svg>
      ))}
    </>
  );
}

export function Backdrop({ scene, mode }: BackdropProps) {
  const layers = useMemo(() => SCENES.map((id) => <SceneLayers key={id} id={id} />), []);
  return (
    <div class="backdrop" data-testid="backdrop" data-scene={scene} data-mode={mode} aria-hidden="true">
      {SCENES.map((id, index) => (
        <div key={id} class={`scene${id === scene ? ' on' : ''}`} data-scene-id={id}>
          {layers[index]}
        </div>
      ))}
      <div class="scene-veil" />
    </div>
  );
}
