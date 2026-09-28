const AUTO_PASS_KEY = 'manaDuel.autoPass';

export function loadAutoPass(): boolean {
  try {
    return localStorage.getItem(AUTO_PASS_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveAutoPass(on: boolean): void {
  try {
    localStorage.setItem(AUTO_PASS_KEY, on ? 'on' : 'off');
  } catch {
    return;
  }
}
