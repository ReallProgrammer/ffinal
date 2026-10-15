import { useState } from 'react';
import { ShieldCheck, Flag } from 'lucide-react';
export default function AccessChallenge({ onPass }: { onPass: () => void }) {
  const [solved, setSolved] = useState(false),
    [flag, setFlag] = useState(''),
    [error, setError] = useState('');
  return (
    <main className="access-challenge" aria-label="Capture the flag entry challenge">
      <section>
        <div className="challenge-terminal-bar">
          <span>ACCESS TERMINAL</span>
          <span>LEVEL 01 / BEGINNER</span>
        </div>
        <ShieldCheck size={46} />
        <p className="eyebrow">ONE SMALL CHALLENGE. A WHOLE COMPUTER TO EXPLORE.</p>
        <h1>Catch the flag.</h1>
        <p>
          A fake email asks you to sign in on a look-alike website to “verify” your password. What
          is this attack called?
        </p>
        {!solved ? (
          <div className="challenge-answers">
            {['Phishing', 'Encryption', 'A software update'].map((answer) => (
              <button
                key={answer}
                onClick={() => {
                  if (answer === 'Phishing') {
                    setSolved(true);
                    setError('');
                  } else
                    setError('Not quite. The attacker is fishing for your credentials. Try again.');
                }}
              >
                {answer}
              </button>
            ))}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (flag.trim().toLowerCase() === 'flag{spot_the_phish}') onPass();
              else setError('Copy the flag exactly, including the braces.');
            }}
          >
            <div className="captured-flag">
              <Flag size={22} />
              <div>
                <b>Correct — phishing.</b>
                <p>Check the real domain before entering a password.</p>
                <code>FLAG{'{spot_the_phish}'}</code>
              </div>
            </div>
            <label>
              Submit your flag
              <input
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={flag}
                onChange={(e) => setFlag(e.target.value)}
                placeholder="FLAG{...}"
              />
            </label>
            <button type="submit">Unlock the desktop →</button>
          </form>
        )}
        {error && <p role="alert">{error}</p>}
        <small>A playful welcome challenge. Owner sign-in remains separate.</small>
      </section>
    </main>
  );
}
