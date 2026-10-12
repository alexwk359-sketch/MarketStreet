// Ajustes del jugador (no forman parte de la partida): se guardan aparte en el navegador.

export interface Settings {
  /** Volumen de los efectos (0-1). */
  volume: number;
  /** Lluvia y nieve en pantalla. */
  weatherFx: boolean;
  /** Oscurecer la escena al anochecer. */
  dayNightFx: boolean;
  /** Etiquetas de stock sobre los expositores. */
  labels: boolean;
}

const KEY = 'market-street-settings';
const DEFAULTS: Settings = { volume: 0.8, weatherFx: true, dayNightFx: true, labels: true };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings: Settings = load();

export function updateSettings(change: Partial<Settings>) {
  Object.assign(settings, change);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Sin almacenamiento los ajustes duran lo que la pestaña.
  }
}
