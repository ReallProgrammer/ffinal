import { useState } from 'react';
import { ArrowRight, ArrowLeft, Power } from 'lucide-react';
import Icon from '../Icon';
import { profile } from '../../data/profile';
import { libraryApi } from '../../lib/library/api';
export default function AccountChooser({
  onSelect,
  onBack,
}: {
  onSelect: (account: 'owner' | 'guest') => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState(false);
  const [username, setUsername] = useState(profile.name);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section className="xp-logon" aria-label="Choose an account">
      <header>
        <span>
          Personal Computer<span className="xp-logon-xp">XP</span>
        </span>
      </header>
      <div className="xp-logon-body">
        <div className="xp-logon-welcome">
          <Icon name="computer" size={70} />
          <h1>Welcome</h1>
          <p>To begin, choose your account.</p>
        </div>
        <div className="xp-logon-accounts">
          <button
            className={'xp-account ' + (selected ? 'chosen' : '')}
            disabled={busy}
            onClick={() => {
              setSelected(true);
              setError('');
            }}
            aria-expanded={selected}
          >
            <span className="xp-account-avatar">
              <Icon name="user" size={48} />
            </span>
            <span>
              <b>{profile.name}</b>
              <small>Personal account</small>
            </span>
          </button>
          {selected && (
            <form
              className="xp-account-form"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                  await libraryApi.login(username, password);
                  setPassword('');
                  onSelect('owner');
                } catch {
                  setPassword('');
                  setError('Could not sign in. Check your username and password, then try again.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              <label>
                Username
                <input
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  maxLength={254}
                />
              </label>
              <label>
                Password
                <div>
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    maxLength={256}
                  />
                  <button aria-label="Sign in" disabled={busy}>
                    <ArrowRight size={22} />
                  </button>
                </div>
              </label>
              {busy && <p role="status">Signing in…</p>}
              {error && <p role="alert">{error}</p>}
            </form>
          )}
          <button
            className="xp-account"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await libraryApi.logout();
              } catch {
                /* Local access has already ended. */
              }
              onSelect('guest');
            }}
          >
            <span className="xp-account-avatar guest">
              <Icon name="user" size={48} />
            </span>
            <span>
              <b>Guest</b>
              <small>Explore the desktop</small>
            </span>
          </button>
        </div>
      </div>
      <footer>
        <button disabled={busy} onClick={onBack}>
          <ArrowLeft size={18} /> Back to terminal
        </button>
        <span>
          <Power size={16} /> {profile.name}’s computer
        </span>
      </footer>
    </section>
  );
}
