import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  House,
  Search,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { profile } from '../../data/profile';
import { useDesktop } from '../../lib/DesktopContext';
import type { WindowData } from '../../types';
import Icon from '../Icon';
import MenuBar from '../MenuBar';
const pages = ['home', 'projects', 'about', 'contact'];
export default function Browser({ window: w }: { window: WindowData }) {
  const [history, setHistory] = useState([w.params.page || 'home']);
  const [index, setIndex] = useState(0);
  const [address, setAddress] = useState(`portfolio://${history[0]}`);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { launch, notify } = useDesktop();
  const page = history[index];
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const refresh = () => {
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setLoading(false), 450);
  };
  const navigate = (p: string) => {
    setHistory((h) => [...h.slice(0, index + 1), p]);
    setIndex(index + 1);
    setAddress('portfolio://' + p);
    refresh();
  };
  const travel = (i: number) => {
    setIndex(i);
    setAddress('portfolio://' + history[i]);
    refresh();
  };
  const go = () => {
    const input = address.trim();
    const p = input.replace(/^portfolio:\/\//, '').replace(/\/$/, '');
    if (pages.includes(p)) {
      navigate(p);
      return;
    }
    try {
      const url = new URL(input.includes('://') ? input : 'https://' + input);
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error();
      window.open(url.href, '_blank', 'noopener,noreferrer');
      notify('External website opened in a new browser tab.');
    } catch {
      notify('Enter portfolio://home, projects, about, contact, or a valid web address.');
    }
  };
  return (
    <div className="browser app-column">
      <MenuBar
        menus={[
          {
            label: 'File',
            items: [
              { label: 'New window', action: () => launch('browser') },
              {
                label: 'Open address',
                action: () => document.getElementById(`browser-address-${w.id}`)?.focus(),
              },
            ],
          },
          {
            label: 'Edit',
            items: [
              {
                label: 'Copy address',
                action: () => {
                  void navigator.clipboard
                    .writeText(address)
                    .catch(() => notify('Select the address and use Copy.'));
                },
              },
            ],
          },
          { label: 'View', items: [{ label: 'Refresh', action: refresh }] },
          {
            label: 'Favorites',
            items: [
              { label: 'My projects', action: () => navigate('projects') },
              {
                label: 'GitHub',
                action: () => window.open(profile.github, '_blank', 'noopener,noreferrer'),
              },
            ],
          },
          {
            label: 'Tools',
            items: [{ label: 'Internet options', action: () => launch('settings') }],
          },
          {
            label: 'Help',
            items: [
              {
                label: 'About this browser',
                action: () =>
                  notify(
                    'Local portfolio pages live inside this computer. External sites open in a new tab.',
                  ),
              },
            ],
          },
        ]}
      />
      <div className="browser-toolbar">
        <button aria-label="Browser back" disabled={index === 0} onClick={() => travel(index - 1)}>
          <ArrowLeft size={22} />
          <span>Back</span>
        </button>
        <button
          aria-label="Browser forward"
          disabled={index === history.length - 1}
          onClick={() => travel(index + 1)}
        >
          <ArrowRight size={22} />
        </button>
        <button aria-label="Refresh page" onClick={refresh}>
          <RotateCw size={20} />
        </button>
        <button aria-label="Browser home" onClick={() => navigate('home')}>
          <House size={22} />
        </button>
        <i />
        <button onClick={() => navigate('projects')}>
          <Search size={21} />
          <span>Explore</span>
        </button>
        <div className="browser-toolbar-logo">
          <Icon name="globe" size={27} />
        </div>
      </div>
      <form
        className="address-bar"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <label htmlFor={`browser-address-${w.id}`}>Address</label>
        <div>
          <Icon name="globe" size={17} />
          <input
            id={`browser-address-${w.id}`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            spellCheck={false}
          />
        </div>
        <button type="submit">
          <ArrowRight size={17} />
          Go
        </button>
      </form>
      <div className={`browser-page ${loading ? 'is-loading' : ''}`}>
        <header className="site-header">
          <button className="site-brand" onClick={() => navigate('home')}>
            ro<span>✳</span>
          </button>
          <nav>
            {pages.map((p) => (
              <button key={p} className={page === p ? 'current' : ''} onClick={() => navigate(p)}>
                {p === 'home' ? 'Hello' : p[0].toUpperCase() + p.slice(1)}
              </button>
            ))}
          </nav>
          <span className="web-online">
            <i /> Online, probably
          </span>
        </header>
        {page === 'home' && (
          <>
            <div className="web-hero">
              <span className="eyebrow">A PERSONAL SPACE ON THE WORLD WIDE WEB</span>
              <h1>
                Built on curiosity.
                <br />
                <span>Powered by possibility.</span>
              </h1>
              <p>{profile.about}</p>
              <button className="web-cta" onClick={() => navigate('projects')}>
                See what I’m working on <ArrowUpRight size={17} />
              </button>
              <div className="web-orbit">✳</div>
            </div>
            <div className="web-marquee">
              THINK · TINKER · BREAK · LEARN · BUILD · REPEAT · THINK · TINKER · BREAK · LEARN
            </div>
            <div className="web-intro">
              <div>
                <small>01 / A LITTLE ABOUT ME</small>
                <h2>
                  There’s a person
                  <br />
                  behind these pixels.
                </h2>
              </div>
              <div>
                <p>
                  {profile.shortRole}. Internet explorer. Firm believer that the best way to
                  understand something is to take it apart.
                </p>
                <button onClick={() => navigate('about')}>
                  Meet the human <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
        {page === 'projects' && (
          <div className="web-section">
            <span className="eyebrow">SELECTED WORK & SMALL EXPERIMENTS</span>
            <h1>The things I make.</h1>
            <p>A collection of ideas that made it out of the notebook.</p>
            <div className="project-grid">
              {profile.projects.map((p, i) => (
                <article className="project-card" key={p.name}>
                  <div className={`project-art ${p.accent}`}>
                    <div className="mini-window">
                      <div>
                        <i />
                        <i />
                        <i />
                      </div>
                      <Icon name={p.icon} size={74} />
                      <span>{i === 0 ? 'hello, world.' : 'coming_soon'}</span>
                    </div>
                    <span className="project-number">0{i + 1}</span>
                  </div>
                  <small>{p.type}</small>
                  <h2>{p.name}</h2>
                  <p>{p.description}</p>
                  <div className="project-tags">
                    {p.technologies.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      View source <ExternalLink size={13} />
                    </a>
                  ) : (
                    <span className="project-pending">Still cooking. Check back soon.</span>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
        {page === 'about' && (
          <div className="web-section">
            <span className="eyebrow">THE HUMAN BEHIND THE SCREEN</span>
            <h1>Hi, I’m {profile.name}.</h1>
            <p className="about-lede">{profile.about}</p>
            <div className="about-columns">
              <div>
                <h2>The current toolbox</h2>
                <div className="skill-tags">
                  {profile.skills.map((s) => (
                    <span key={s}>{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <h2>Currently learning</h2>
                <p>
                  How to ask better questions, write better code, and make the internet a little
                  more interesting.
                </p>
              </div>
            </div>
            <button className="web-cta" onClick={() => launch('explorer', { folder: 'education' })}>
              Open the education folder <ArrowUpRight size={16} />
            </button>
            <p className="sample-note">{profile.note}</p>
          </div>
        )}
        {page === 'contact' && (
          <div className="web-section contact-page">
            <span className="eyebrow">GOOD THINGS START WITH A HELLO</span>
            <Icon name="mail" size={80} />
            <h1>Let’s make a connection.</h1>
            <p>
              Have an idea, a question, or a particularly good internet discovery?
              <br />
              I’d love to hear about it.
            </p>
            <a className="web-cta" href={profile.github} target="_blank" rel="noopener noreferrer">
              Find me on GitHub <ArrowUpRight size={18} />
            </a>
            {profile.email && (
              <a className="contact-link" href={`mailto:${profile.email}`}>
                {profile.email}
              </a>
            )}
            {profile.linkedin && (
              <a
                className="contact-link"
                href={profile.linkedin}
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn
              </a>
            )}
            <small>One human. Many open tabs.</small>
          </div>
        )}
        <footer className="site-footer">
          <span>
            © {new Date().getFullYear()} {profile.name}
          </span>
          <span>Handmade for the internet. ✳</span>
        </footer>
      </div>
      <footer className="status-bar">
        <span>{loading ? 'Opening page…' : 'Done'}</span>
        <span>
          <ShieldCheck size={13} /> Local portfolio
        </span>
      </footer>
    </div>
  );
}
