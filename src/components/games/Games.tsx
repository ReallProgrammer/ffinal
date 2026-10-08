import { useState } from 'react';
import ContextMenu from '../ContextMenu';
import { addFileEntry } from '../../data/filesystem';
import Icon from '../Icon';
import { useDesktop } from '../../lib/DesktopContext';
import type { AppId } from '../../types';
const games: { id: AppId; name: string; description: string; symbol: string }[] = [
  { id: 'snake', name: 'Snake', description: 'Just one more apple.', symbol: '▰' },
  { id: 'pong', name: 'Pong', description: 'A classic back-and-forth.', symbol: '▌·▐' },
  { id: 'minesweeper', name: 'Minesweeper', description: 'Watch your step.', symbol: '✹' },
  { id: 'game', name: 'Memory Lane', description: 'Find the matching pieces.', symbol: '✿' },
];
export default function Games() {
  const [context, setContext] = useState<{
    game: (typeof games)[number];
    x: number;
    y: number;
  } | null>(null);
  const { launch, notify } = useDesktop();
  return (
    <div className="games-library">
      <header>
        <Icon name="game" size={52} />
        <div>
          <span className="eyebrow">ACCESSORIES / GAMES</span>
          <h1>A little time well wasted.</h1>
          <p>Four familiar reasons to take a break.</p>
        </div>
      </header>
      <div className="games-grid">
        {games.map((g) => (
          <button
            className={`game-launch game-${g.id}`}
            key={g.id}
            onClick={() => launch(g.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContext({ game: g, x: e.clientX, y: e.clientY });
            }}
          >
            <div>{g.symbol}</div>
            <b>{g.name}</b>
            <small>{g.description}</small>
            <span>PLAY →</span>
          </button>
        ))}
      </div>
      {context && (
        <ContextMenu
          x={context.x}
          y={context.y}
          onClose={() => setContext(null)}
          items={[
            { label: 'Open', action: () => launch(context.game.id) },
            {
              label: 'Create desktop shortcut',
              action: () => {
                try {
                  addFileEntry({
                    id: crypto.randomUUID(),
                    name: context.game.name,
                    kind: 'app',
                    icon: 'game',
                    app: context.game.id,
                    parent: 'desktop',
                  });
                  notify('Shortcut created on the desktop.');
                } catch (e) {
                  notify((e as Error).message);
                }
              },
            },
            {
              label: 'Properties',
              action: () =>
                notify(
                  `${context.game.name}\nLocal game · No installation required\n${context.game.description}`,
                ),
            },
          ]}
        />
      )}
      <footer>Your high score stays on this computer.</footer>
    </div>
  );
}
