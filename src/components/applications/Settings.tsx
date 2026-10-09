import { useState } from 'react';
import { Volume2, Monitor, UserRound, Check, Moon, Sun } from 'lucide-react';
import { useDesktop } from '../../lib/DesktopContext';
import { profile } from '../../data/profile';
import Icon from '../Icon';
export default function Settings() {
  const { settings, setSettings, launch, clearTemporary, resetDesktop, restart } = useDesktop();
  const [tab, setTab] = useState('Display');
  return (
    <div className="settings-app">
      <div className="settings-header">
        <Icon name="settings" size={44} />
        <div>
          <h1>Make yourself at home.</h1>
          <p>A few little things to make this computer yours.</p>
        </div>
      </div>
      <div className="settings-tabs">
        {['Display', 'Sounds', 'System'].map((t) => (
          <button key={t} className={tab === t ? 'current' : ''} onClick={() => setTab(t)}>
            {t === 'Display' ? (
              <Monitor size={14} />
            ) : t === 'Sounds' ? (
              <Volume2 size={14} />
            ) : (
              <UserRound size={14} />
            )}{' '}
            {t}
          </button>
        ))}
      </div>
      <div className="settings-panel">
        {tab === 'Display' ? (
          <>
            <h2>Desktop background</h2>
            <div className="wallpaper-choices">
              <button
                className={settings.wallpaper === 'bliss' ? 'chosen' : ''}
                onClick={() => setSettings({ wallpaper: 'bliss' })}
              >
                <div className="wallpaper-swatch bliss-swatch">
                  <Sun size={18} />
                </div>
                <span>
                  Somewhere peaceful {settings.wallpaper === 'bliss' && <Check size={14} />}
                </span>
              </button>
              <button
                className={settings.wallpaper === 'night' ? 'chosen' : ''}
                onClick={() => setSettings({ wallpaper: 'night' })}
              >
                <div className="wallpaper-swatch night-swatch">
                  <Moon size={18} />
                </div>
                <span>After hours {settings.wallpaper === 'night' && <Check size={14} />}</span>
              </button>
              <button
                className={settings.wallpaper === 'slate' ? 'chosen' : ''}
                onClick={() => setSettings({ wallpaper: 'slate' })}
              >
                <div className="wallpaper-swatch slate-swatch" />
                <span>Classic teal {settings.wallpaper === 'slate' && <Check size={14} />}</span>
              </button>
              <button onClick={() => launch('shelf', { view: 'archive' })}>
                <div className="wallpaper-swatch personal-swatch">
                  <Icon name="certificate" size={26} />
                </div>
                <span>Saved local images</span>
              </button>
            </div>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.crt}
                onChange={(e) => setSettings({ crt: e.target.checked })}
              />
              <span>
                <b>That old monitor feeling</b>
                <small>Subtle scanlines, soft glow, and a little nostalgia.</small>
              </span>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.skipBoot}
                onChange={(e) => setSettings({ skipBoot: e.target.checked })}
              />
              <span>
                <b>Take the scenic route? Maybe next time.</b>
                <small>Skip the boot sequence on your next visit.</small>
              </span>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.reducedMotion}
                onChange={(e) => setSettings({ reducedMotion: e.target.checked })}
              />
              <span>
                <b>Reduced motion</b>
                <small>Turn off decorative transitions and animated noise.</small>
              </span>
            </label>
            <p className="settings-hint">Reduced-motion preferences are respected automatically.</p>
          </>
        ) : tab === 'Sounds' ? (
          <>
            <Icon name="computer" size={56} />
            <h2>The sound of a simpler time.</h2>
            <p>
              Soft beeps and familiar little melodies. Sound starts after your first interaction and
              follows these controls.
            </p>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(e) => setSettings({ sound: e.target.checked })}
              />
              <span>Enable system sounds</span>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.bootSound}
                onChange={(e) => setSettings({ bootSound: e.target.checked })}
              />
              <span>Boot and shutdown sounds</span>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.clickSound}
                onChange={(e) => setSettings({ clickSound: e.target.checked })}
              />
              <span>Mouse clicks and keyboard sounds</span>
            </label>
            <label className="setting-toggle">
              <input
                type="checkbox"
                checked={settings.ambient}
                onChange={(e) => setSettings({ ambient: e.target.checked })}
              />
              <span>Ambient fan and CRT hum</span>
            </label>
            <label className="volume-slider">
              Volume{' '}
              <input
                type="range"
                min="0"
                max="1"
                step=".05"
                value={settings.volume}
                onChange={(e) => setSettings({ volume: Number(e.target.value) })}
              />
              <output>{Math.round(settings.volume * 100)}%</output>
            </label>
          </>
        ) : (
          <>
            <div className="system-identity">
              <Icon name="computer" size={64} />
              <div>
                <h2>
                  Personal Computer <sup>xp</sup>
                </h2>
                <p>Curiosity Edition · Version 2.0</p>
              </div>
            </div>
            <hr />
            <p>Registered to:</p>
            <h3>{profile.name}</h3>
            <p>{profile.role}</p>
            <div className="system-specs">
              <span>Processor</span>
              <b>A curious mind</b>
              <span>Memory</span>
              <b>Plenty of good ones</b>
              <span>System</span>
              <b>React + TypeScript</b>
              <span>Languages</span>
              <b>Ready to personalize</b>
            </div>
            <button className="xp-button" onClick={() => launch('explorer', { folder: 'about' })}>
              About the developer
            </button>
            <div className="system-maintenance">
              <h3>System maintenance</h3>
              <button className="xp-button" onClick={clearTemporary}>
                Clear temporary files
              </button>
              <button className="xp-button" onClick={resetDesktop}>
                Reset desktop
              </button>
              <button className="xp-button" onClick={restart}>
                Restart computer
              </button>
            </div>
          </>
        )}
      </div>
      <footer className="settings-footer">
        <span>Changes are saved automatically.</span>
        <button
          className="xp-button"
          onClick={() =>
            setSettings({
              crt: false,
              sound: false,
              volume: 0.4,
              wallpaper: 'bliss',
              skipBoot: false,
              clickSound: true,
              bootSound: true,
              ambient: true,
              reducedMotion: false,
              bootTarget: 'windows',
            })
          }
        >
          Restore defaults
        </button>
      </footer>
    </div>
  );
}
