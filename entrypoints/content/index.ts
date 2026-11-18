// Isolated world: finds YouTube's player and puts the picker next to its CC button.
import './page.css';
import { loadLanguages, onLanguagesChanged, saveLanguages } from '@/src/settings';
import { mountPicker, type Picker } from '@/src/ui/picker';

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  runAt: 'document_idle',
  async main(ctx) {
    let languages = await loadLanguages();
    let picker: Picker | null = null;

    const stopWatching = onLanguagesChanged((next) => {
      languages = next;
      picker?.languagesChanged();
    });

    function attach() {
      const player = document.getElementById('movie_player');
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
          picker?.languagesChanged();
          await saveLanguages(next);
        },
      });
    }

    // YouTube swaps players and rebuilds its control bar without reloading the page. A cheap
    // check every second covers that without observing the whole document.
    ctx.setInterval(attach, 1000);
    ctx.addEventListener(document, 'yt-navigate-start', () => picker?.reset());
    ctx.addEventListener(document, 'yt-navigate-finish', attach);
    ctx.onInvalidated(() => {
      stopWatching();
      picker?.destroy();
      picker = null;
    });
    attach();
  },
});
