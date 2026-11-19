import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import type { ThemeName } from '../theme';

export type Sfx = 'tick' | 'pop' | 'nope' | 'thud' | 'legend' | 'drop' | 'level' | 'combo';

const FILES: Record<ThemeName, Record<Sfx, number>> = {
  swiss: {
    tick: require('../../assets/sounds/swiss/tick.wav'), pop: require('../../assets/sounds/swiss/pop.wav'),
    nope: require('../../assets/sounds/swiss/nope.wav'), thud: require('../../assets/sounds/swiss/thud.wav'),
    legend: require('../../assets/sounds/swiss/legend.wav'), drop: require('../../assets/sounds/swiss/drop.wav'),
    level: require('../../assets/sounds/swiss/level.wav'), combo: require('../../assets/sounds/swiss/combo.wav'),
  },
};

const VOLUME: Record<Sfx, number> = { tick: 0.35, pop: 0.7, nope: 0.6, thud: 0.8, legend: 0.8, drop: 0.8, level: 0.9, combo: 0.7 };

class Feedback {
  sound = true;
  haptics = true;
  theme: ThemeName = 'swiss';
  private players = new Map<string, AudioPlayer>();
  private ready = false;

  init() {
    if (this.ready) return;
    this.ready = true;
    // Mix with whatever the user is listening to; never pause their music.
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
    for (const name of Object.keys(FILES[this.theme]) as Sfx[]) this.player(this.theme, name);
  }

  private player(theme: ThemeName, name: Sfx): AudioPlayer | null {
    const k = `${theme}/${name}`;
    let p = this.players.get(k);
    if (!p) {
      try { p = createAudioPlayer(FILES[theme][name]); p.volume = VOLUME[name]; this.players.set(k, p); }
      catch { return null; }
    }
    return p;
  }

  play(name: Sfx) {
    if (!this.sound) return;
    const p = this.player(this.theme, name);
    if (!p) return;
    try { p.seekTo(0).catch(() => {}); p.play(); } catch { /* audio unavailable */ }
  }

  /** Haptic vocabulary: tick per swipe, success/failure on answers, heavy on big moments. */
  buzz(kind: 'tick' | 'success' | 'fail' | 'heavy' | 'select') {
    if (!this.haptics || Platform.OS === 'web') return;
    const run = () => {
      switch (kind) {
        case 'tick': return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        case 'select': return Haptics.selectionAsync();
        case 'success': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        case 'fail': return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        case 'heavy': return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    };
    run()?.catch(() => {});
  }

  both(s: Sfx, h: Parameters<Feedback['buzz']>[0]) { this.play(s); this.buzz(h); }
}

export const fx = new Feedback();
