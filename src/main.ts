import './ui/styles/base.css';
import './ui/styles/screens.css';
import './ui/styles/hud.css';
import './ui/styles/overlays.css';
import './ui/styles/parent.css';
import { startApp } from './app/app';
import { buildShell, showBootError } from './app/boot';
import { registerServiceWorker } from './app/pwa';
import { createAudio } from './audio/index';
import { loadContent } from './content/index';
import { createGameView } from './render/index';
import { createRepository } from './storage';
import { placeChests } from './explore/index';
import { createExploreWorld, createWorldFromTheme, deserializeWorld } from './world/index';

const STORAGE_HELP =
  'Saving is not available in this browser window (private browsing can block it). ' +
  'Please open Tibu in a normal Safari or Chrome window.';
const GENERIC_HELP = 'Something went wrong while loading. Please check the connection for the first visit and try again.';

async function main(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  const updates = registerServiceWorker();
  const shell = buildShell(root);
  let repo;
  try {
    repo = await createRepository();
  } catch {
    showBootError(root, STORAGE_HELP);
    updates?.setSafe(true); // A fixed version may be waiting.
    return;
  }
  try {
    const registry = await loadContent();
    const audio = createAudio();
    const view = createGameView(shell.canvas, registry);
    await startApp({
      registry,
      audio,
      view,
      repo,
      screenRoot: shell.screenRoot,
      overlayRoot: shell.overlayRoot,
      stage: shell.stage,
      worlds: { createWorldFromTheme, deserializeWorld, createExploreWorld, placeChests },
      updates,
    });
    document.documentElement.classList.add('ready');
  } catch (error) {
    showBootError(root, GENERIC_HELP);
    updates?.setSafe(true);
    // Surface details for developers without a console.log in production paths.
    reportError(error);
  }
}

void main();
