import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { councilAPI } from '../api/client';

const activity = [
  { title: 'Research synthesis', meta: 'Strategy agent · 2 min ago', state: 'Completed', tone: 'emerald', icon: '↗' },
  { title: 'Risk assessment', meta: 'Council review · 8 min ago', state: 'Reviewing', tone: 'indigo', icon: '◇' },
  { title: 'Market signal scan', meta: 'Intelligence agent · 14 min ago', state: 'Completed', tone: 'emerald', icon: '⌁' },
  { title: 'Launch narrative', meta: 'Creative pipeline · 21 min ago', state: 'Queued', tone: 'slate', icon: '✦' },
];

const pipeline = [
  { label: 'Intake', value: 100 }, { label: 'Reasoning', value: 82 },
  { label: 'Council', value: 56 }, { label: 'Synthesis', value: 24 },
];

const Icon = ({ children }) => <span className="metric-icon" aria-hidden="true">{children}</span>;

function Dashboard() {
  const [stats, setStats] = useState({ total: 1284, approval_rate: .942, avg_score: 8.7 });
  const [connection, setConnection] = useState('syncing');
  const [range, setRange] = useState('7D');

  useEffect(() => {
    let live = true;
    councilAPI.stats().then(({ data }) => {
      if (live) { setStats(data); setConnection('live'); }
    }).catch(() => { if (live) setConnection('demo'); });
    return () => { live = false; };
  }, []);

  const chart = useMemo(() => {
    const points = range === '24H'
      ? [36, 42, 38, 54, 61, 58, 74, 70, 81, 78, 88, 92]
      : range === '30D'
        ? [22, 30, 27, 41, 38, 49, 46, 62, 58, 69, 76, 72, 84, 91]
        : [28, 34, 45, 42, 58, 53, 67, 63, 78, 74, 86, 91];
    return points.map((value, index) => `${(index / (points.length - 1)) * 600},${140 - value}`).join(' ');
  }, [range]);

  const cards = [
    { label: 'Active agents', value: '24', delta: '+4 today', icon: '◌', tone: 'violet' },
    { label: 'Council decisions', value: Number(stats.total || 0).toLocaleString(), delta: '+12.4%', icon: '◇', tone: 'cyan' },
    { label: 'Approval rate', value: `${((stats.approval_rate || 0) * 100).toFixed(1)}%`, delta: '+2.8%', icon: '✓', tone: 'green' },
    { label: 'Avg. confidence', value: Number(stats.avg_score || 0).toFixed(1), delta: 'High signal', icon: '⌁', tone: 'amber' },
  ];

  return <div className="command-dashboard">
    <section className="command-hero">
      <div>
        <div className="hero-kicker"><span /> LIVE WORKSPACE <b>/</b> AETHERION PRIME</div>
        <h1>Good morning, <em>Operator.</em></h1>
        <p>Your autonomous workforce is performing at peak capacity. Here is what deserves your attention.</p>
      </div>
      <div className="hero-actions">
        <button className="icon-button" aria-label="Open notifications"><span className="notification-dot" />♧</button>
        <Link className="new-mission" to="/tasks"><span>＋</span> New mission</Link>
      </div>
    </section>

    <section className="metric-grid" aria-label="Workspace metrics">
      {cards.map((card) => <article className={`metric-card metric-${card.tone}`} key={card.label}>
        <div className="metric-card-top"><Icon>{card.icon}</Icon><span className="metric-delta">{card.delta}</span></div>
        <strong>{card.value}</strong><p>{card.label}</p>
        <div className="mini-bars" aria-hidden="true">{[38,55,46,68,61,78,72,90].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div>
      </article>)}
    </section>

    <section className="dashboard-grid">
      <article className="command-panel performance-panel">
        <div className="panel-heading"><div><span className="panel-label">PERFORMANCE</span><h2>Mission throughput</h2></div><div className="range-picker">{['24H','7D','30D'].map(item => <button key={item} className={range === item ? 'active' : ''} onClick={() => setRange(item)}>{item}</button>)}</div></div>
        <div className="chart-summary"><strong>1,842</strong><span>missions completed</span><b>↗ 18.2%</b></div>
        <div className="line-chart">
          <div className="chart-grid-lines"><i/><i/><i/><i/></div>
          <svg viewBox="0 0 600 150" preserveAspectRatio="none" role="img" aria-label="Mission throughput increased over time">
            <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9b87f5" stopOpacity=".34"/><stop offset="1" stopColor="#9b87f5" stopOpacity="0"/></linearGradient></defs>
            <polygon points={`0,150 ${chart} 600,150`} fill="url(#chartFill)"/>
            <polyline points={chart} fill="none" stroke="#ad9bff" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
          </svg>
          <div className="chart-axis"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span></div>
        </div>
      </article>

      <article className="command-panel activity-panel">
        <div className="panel-heading"><div><span className="panel-label">SIGNAL STREAM</span><h2>Recent activity</h2></div><Link to="/tasks">View all ↗</Link></div>
        <div className="activity-list">{activity.map(item => <div className="activity-item" key={item.title}>
          <span className={`activity-icon ${item.tone}`}>{item.icon}</span><div><strong>{item.title}</strong><p>{item.meta}</p></div><span className={`state-pill ${item.tone}`}>{item.state}</span>
        </div>)}</div>
      </article>

      <article className="command-panel pipeline-panel">
        <div className="panel-heading"><div><span className="panel-label">LIVE PIPELINE</span><h2>Mission architecture</h2></div><span className={`connection-badge ${connection}`}><i />{connection === 'live' ? 'Connected' : connection === 'demo' ? 'Preview data' : 'Syncing'}</span></div>
        <div className="pipeline-flow">{pipeline.map((step, index) => <React.Fragment key={step.label}><div className="pipeline-step"><div className="pipeline-orbit" style={{ '--progress': `${step.value * 3.6}deg` }}><span>{index + 1}</span></div><strong>{step.label}</strong><small>{step.value}%</small></div>{index < pipeline.length - 1 && <div className="pipeline-line"><i style={{ width: `${Math.min(step.value, pipeline[index + 1].value)}%` }} /></div>}</React.Fragment>)}</div>
      </article>

      <aside className="command-panel focus-panel">
        <div className="focus-orb"><span>AI</span></div><span className="panel-label">OPERATOR INSIGHT</span><h2>Focus on the signal.</h2><p>3 high-confidence decisions are ready for your final review.</p><Link to="/council">Review decisions <span>→</span></Link>
      </aside>
    </section>
  </div>;
}

export default Dashboard;
