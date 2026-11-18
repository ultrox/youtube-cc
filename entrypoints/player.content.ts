// Main world: the page script that talks to YouTube's player API (src/bridge/page.ts).
import { installPageBridge } from '@/src/bridge/page';

export default defineContentScript({
  matches: ['https://www.youtube.com/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main() {
    installPageBridge();
  },
});
