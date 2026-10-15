import { useEffect, useState } from 'react';
import { libraryApi } from '../../lib/library/api';
export function useOwnerSession() {
  const [owner, setOwner] = useState(libraryApi.isOwner());
  useEffect(() => {
    const changed = () => setOwner(libraryApi.isOwner());
    window.addEventListener('library-change', changed);
    return () => window.removeEventListener('library-change', changed);
  }, []);
  return owner;
}
export default function OwnerAccess() {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="os-owner-login"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await libraryApi.login(email, password);
          setPassword('');
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Owner sign-in</h2>
      <p>Use the same private owner account as your collection.</p>
      <label>
        Owner email
        <input
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
