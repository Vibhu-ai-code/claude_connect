import { useEffect, useState } from 'react';
import './App.css';

const NAV = [
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About' },
  { id: 'work', label: 'Work' },
  { id: 'contact', label: 'Contact' },
];

const SERVICES = [
  {
    title: 'Strategy',
    body: 'Clear direction grounded in research. We help you decide what to build, for whom, and why it matters.',
  },
  {
    title: 'Design',
    body: 'Considered, restrained, and human. Brand systems and product interfaces that earn trust on first sight.',
  },
  {
    title: 'Build',
    body: 'Modern engineering practices, shipped on time. From marketing sites to durable internal platforms.',
  },
];

const WORK = [
  { client: 'Northwind Trading', tag: 'Brand & Site', year: '2025' },
  { client: 'Lakeside Capital', tag: 'Product Design', year: '2025' },
  { client: 'Field & Forge', tag: 'E-commerce', year: '2024' },
  { client: 'Atlas Logistics', tag: 'Internal Platform', year: '2024' },
];

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container header-inner">
        <a href="#top" className="brand">
          <span className="brand-mark">M</span>
          <span className="brand-name">Moolchand</span>
        </a>
        <nav className={`site-nav ${open ? 'is-open' : ''}`}>
          {NAV.map((item) => (
            <a key={item.id} href={`#${item.id}`} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
        </nav>
        <a href="#contact" className="cta-button">
          Start a project
        </a>
        <button
          className="menu-toggle"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="top" className="hero">
      <div className="container hero-inner">
        <p className="eyebrow">Established 1998 — Strategy, design & build</p>
        <h1>
          Building lasting value<br />with care and craft.
        </h1>
        <p className="lede">
          Moolchand is a small studio of strategists, designers, and engineers helping
          ambitious teams ship clear, durable products and brands.
        </p>
        <div className="hero-actions">
          <a href="#services" className="cta-button cta-primary">Our services</a>
          <a href="#contact" className="cta-button cta-ghost">Get in touch →</a>
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section id="services" className="section">
      <div className="container">
        <div className="section-head">
          <span className="section-label">01 — Services</span>
          <h2>Three disciplines, one team.</h2>
          <p className="section-sub">
            We work end-to-end so strategy, design, and engineering stay in conversation
            from kickoff to launch.
          </p>
        </div>
        <div className="grid">
          {SERVICES.map((s, i) => (
            <article key={s.title} className="card">
              <span className="card-index">0{i + 1}</span>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="section section-alt">
      <div className="container about-grid">
        <div>
          <span className="section-label">02 — About</span>
          <h2>A studio built on patience.</h2>
        </div>
        <div className="about-body">
          <p>
            Moolchand was founded on a simple idea: the best work comes from teams that
            take time to understand the problem before reaching for a solution. We stay
            small on purpose — every engagement is led by a senior partner from start to
            finish.
          </p>
          <p>
            Our clients range from early-stage founders to established institutions.
            What they share is a belief that clear thinking and quiet design outlast
            trends.
          </p>
          <dl className="stats">
            <div>
              <dt>27</dt>
              <dd>Years in practice</dd>
            </div>
            <div>
              <dt>140+</dt>
              <dd>Projects shipped</dd>
            </div>
            <div>
              <dt>12</dt>
              <dd>People on the team</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}

function Work() {
  return (
    <section id="work" className="section">
      <div className="container">
        <div className="section-head">
          <span className="section-label">03 — Selected work</span>
          <h2>Recent engagements.</h2>
        </div>
        <ul className="work-list">
          {WORK.map((w) => (
            <li key={w.client}>
              <span className="work-client">{w.client}</span>
              <span className="work-tag">{w.tag}</span>
              <span className="work-year">{w.year}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="section section-dark">
      <div className="container contact-grid">
        <div>
          <span className="section-label section-label-light">04 — Contact</span>
          <h2>Tell us about your project.</h2>
          <p className="lede lede-light">
            We take on a small number of new engagements each quarter. The best way to
            reach us is a short note describing what you're working on.
          </p>
        </div>
        <div className="contact-card">
          <a className="contact-row" href="mailto:hello@moolchand.co">
            <span>Email</span>
            <strong>hello@moolchand.co</strong>
          </a>
          <a className="contact-row" href="tel:+10000000000">
            <span>Phone</span>
            <strong>+1 (000) 000-0000</strong>
          </a>
          <div className="contact-row">
            <span>Studio</span>
            <strong>Brooklyn, NY</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <span>© {new Date().getFullYear()} Moolchand Studio</span>
        <span className="footer-meta">Made with care.</span>
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Services />
        <About />
        <Work />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
