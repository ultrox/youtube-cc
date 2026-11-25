// Isolated world: finds YouTube's player and puts the picker next to its CC button.
import './page.css';
import { type PageSettings, SETTINGS_EVENT } from '@/src/bridge/protocol';
import {
  loadDual,
  loadLanguages,
  loadOriginalAudio,
  onDualChanged,
  onLanguagesChanged,
  onOriginalAudioChanged,
  saveDual,
  saveLanguages,
  saveOriginalAudio,
} from '@/src/settings';
import { type DualLines, mountDualLines } from '@/src/ui/lines';
import { mountPicker, type Picker } from '@/src/ui/picker';

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  runAt: 'document_idle',
  async main(ctx) {
    let [languages, originalAudio, dual] = await Promise.all([
      loadLanguages(),
      loadOriginalAudio(),
      loadDual(),
    ]);
    let picker: Picker | null = null;
    let lines: DualLines | null = null;

    // The page script (player.content.ts) acts on the player; tell it what the user wants.
    const sendSettings = () => {
      const settings: PageSettings = { originalAudio };
      document.dispatchEvent(new CustomEvent(SETTINGS_EVENT, { detail: JSON.stringify(settings) }));
    };
    sendSettings();

    const stopLanguages = onLanguagesChanged((next) => {
      languages = next;
      picker?.settingsChanged();
      lines?.sync();
    });
    const stopDual = onDualChanged((next) => {
      dual = next;
      picker?.settingsChanged();
      lines?.sync();
    });
    const stopAudio = onOriginalAudioChanged((next) => {
      originalAudio = next;
      sendSettings();
      picker?.settingsChanged();
    });

    function attach() {
      const player = document.getElementById('movie_player');
      // The two lines of dual subtitles live in the player, with or without its CC button.
      if (lines && (lines.player !== player || !lines.attached())) {
        lines.destroy();
        lines = null;
      }
      if (player && !lines) {
        lines = mountDualLines({ player, dual: () => dual, languages: () => languages });
      }
      const native = player?.querySelector<HTMLElement>('.ytp-right-controls .ytp-subtitles-button');
      if (picker?.attached() && picker.native === native) return;
      picker?.destroy();
      picker = null;
      if (!player || !native) return;
      picker = mountPicker({
        player,
        native,
        languages: () => languages,
        setLanguages: async (next) => {
          languages = next; // at once; storage.onChanged follows and agrees
          picker?.settingsChanged();
          lines?.sync();
          await saveLanguages(next);
        },
        dual: () => dual,
        setDual: async (next) => {
          dual = next;
          picker?.settingsChanged();
          lines?.sync();
          await saveDual(next);
        },
        originalAudio: () => originalAudio,
        setOriginalAudio: async (next) => {
          originalAudio = next;
          sendSettings();
          picker?.settingsChanged();
          await saveOriginalAudio(next);
        },
      });
    }

    // YouTube swaps players and rebuilds its control bar without reloading the page. A cheap
    // check every second covers that without observing the whole document.
    ctx.setInterval(attach, 1000);
    ctx.addEventListener(document, 'yt-navigate-start', () => {
      picker?.reset();
      lines?.sync();
    });
    ctx.addEventListener(document, 'yt-navigate-finish', () => {
      attach();
      lines?.sync();
    });
    ctx.onInvalidated(() => {
      stopLanguages();
      stopAudio();
      stopDual();
      lines?.destroy();
      lines = null;
      // An old copy of this script (extension updated) must not keep switching audio.
      originalAudio = false;
      sendSettings();
      picker?.destroy();
      picker = null;
    });
    attach();
  },
});
