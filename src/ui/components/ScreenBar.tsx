import type { ComponentChildren } from 'preact';
import { BackIcon } from './ModeIcons';

interface ScreenBarProps {
  title: ComponentChildren;
  detail?: string;
  backLabel: string;
  backTestId: string;
  onBack: () => void;
  children?: ComponentChildren;
}

export function ScreenBar({ title, detail, backLabel, backTestId, onBack, children }: ScreenBarProps) {
  return (
    <header class="screen-bar">
      <button type="button" class="icon-btn" aria-label={backLabel} data-testid={backTestId} onClick={onBack}>
        <BackIcon />
      </button>
      {typeof title === 'string' ? <h1>{title}</h1> : title}
      {detail && <span class="screen-bar-detail num">{detail}</span>}
      {children}
    </header>
  );
}
