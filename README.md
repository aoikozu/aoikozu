<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;700&family=Syne:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #0a0a0f;
    --surface: #12121a;
    --surface2: #1a1a28;
    --accent: #7b6cff;
    --accent2: #ff6cb0;
    --accent3: #6cffda;
    --amber: #ffb347;
    --amber2: #ff8c42;
    --text: #e8e8f0;
    --muted: #6b6b8a;
    --border: rgba(123,108,255,0.18);
    --border-amber: rgba(255,179,71,0.22);
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'Noto Sans JP', sans-serif;
    min-height: 100vh;
    padding: 32px 20px;
    overflow-x: hidden;
  }
  body::before {
    content: '';
    position: fixed; inset: 0;
    background:
      radial-gradient(ellipse 60% 40% at 20% 10%, rgba(123,108,255,0.12) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 80% 80%, rgba(255,179,71,0.09) 0%, transparent 60%);
    pointer-events: none; z-index: 0;
  }
  .container {
    max-width: 780px;
    margin: 0 auto;
    position: relative; z-index: 1;
    display: flex; flex-direction: column; gap: 20px;
  }

  /* HEADER */
  .header {
    display: flex; align-items: center; gap: 24px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 28px 32px;
    position: relative; overflow: hidden;
    animation: fadeUp .6s ease both;
  }
  .header::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--accent), var(--accent2), var(--amber));
  }
  .avatar {
    width: 72px; height: 72px; border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), var(--accent2));
    display: flex; align-items: center; justify-content: center;
    font-family: 'Syne', sans-serif;
    font-size: 28px; font-weight: 800; color: #fff;
    flex-shrink: 0;
    box-shadow: 0 0 24px rgba(123,108,255,0.35);
  }
  .header-info { flex: 1; }
  .name {
    font-family: 'Syne', sans-serif;
    font-size: 26px; font-weight: 800;
    letter-spacing: 0.02em;
    background: linear-gradient(90deg, #fff 30%, var(--accent));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .username { font-size: 13px; color: var(--muted); margin-top: 2px; letter-spacing: 0.04em; }
  .bio { margin-top: 8px; font-size: 14px; color: #b0b0cc; line-height: 1.6; }

  /* BADGES */
  .badges {
    display: flex; gap: 10px; flex-wrap: wrap;
    animation: fadeUp .6s .1s ease both;
  }
  .badge {
    display: inline-flex; align-items: center; gap: 7px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 6px 14px;
    font-size: 12px; color: var(--text);
    text-decoration: none;
    transition: border-color .2s, box-shadow .2s, transform .2s;
  }
  .badge:hover {
    border-color: var(--accent);
    box-shadow: 0 0 12px rgba(123,108,255,0.25);
    transform: translateY(-2px);
  }
  .badge-dot { width: 7px; height: 7px; border-radius: 50%; }
  .badge-dot.twitter { background: #1d9bf0; }
  .badge-dot.github  { background: #c6c6e8; }
  .badge-dot.views   { background: var(--accent3); }

  /* SECTION TITLE */
  .section-title {
    font-family: 'Syne', sans-serif;
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 12px;
    display: flex; align-items: center; gap: 8px;
  }
  .section-title::after {
    content: ''; flex: 1; height: 1px;
    background: var(--border);
  }

  /* CARDS */
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 22px 26px;
    animation: fadeUp .6s ease both;
    transition: border-color .25s, box-shadow .25s;
  }
  .card:hover {
    border-color: rgba(123,108,255,0.4);
    box-shadow: 0 4px 32px rgba(123,108,255,0.1);
  }

  /* PROJECT GRID */
  .projects-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    animation: fadeUp .6s .2s ease both;
  }
  @media (max-width: 560px) { .projects-grid { grid-template-columns: 1fr; } }

  .project-card {
    border-radius: 16px;
    padding: 20px 22px;
    position: relative; overflow: hidden;
    text-decoration: none; color: inherit;
    display: flex; flex-direction: column; gap: 10px;
    transition: transform .22s, box-shadow .22s;
    border: 1px solid transparent;
  }
  .project-card:hover {
    transform: translateY(-3px);
  }
  .project-card::before {
    content: ''; position: absolute; inset: 0;
    border-radius: 16px; z-index: 0;
    opacity: .13; transition: opacity .22s;
  }
  .project-card:hover::before { opacity: .2; }
  .project-card > * { position: relative; z-index: 1; }

  /* Amber-Blossom card */
  .card-amber {
    background: linear-gradient(135deg, #1e1610 0%, #221a10 100%);
    border-color: var(--border-amber);
  }
  .card-amber::before {
    background: linear-gradient(135deg, var(--amber), var(--amber2));
    opacity: .08;
  }
  .card-amber:hover { box-shadow: 0 8px 36px rgba(255,179,71,0.18); border-color: rgba(255,179,71,0.45); }
  .card-amber .proj-icon {
    background: linear-gradient(135deg, var(--amber), var(--amber2));
    box-shadow: 0 0 16px rgba(255,179,71,0.35);
  }
  .card-amber .proj-tag { background: rgba(255,179,71,0.15); color: var(--amber); border-color: rgba(255,179,71,0.3); }
  .card-amber .proj-link { color: var(--amber); }
  .card-amber .new-badge { background: linear-gradient(90deg, var(--amber2), var(--amber)); }

  /* Tools card */
  .card-tools {
    background: linear-gradient(135deg, #101c1a 0%, #111f1d 100%);
    border-color: rgba(108,255,218,0.18);
  }
  .card-tools::before {
    background: linear-gradient(135deg, var(--accent3), #3fc9aa);
    opacity: .06;
  }
  .card-tools:hover { box-shadow: 0 8px 36px rgba(108,255,218,0.15); border-color: rgba(108,255,218,0.4); }
  .card-tools .proj-icon {
    background: linear-gradient(135deg, var(--accent3), #3fc9aa);
    box-shadow: 0 0 16px rgba(108,255,218,0.3);
  }
  .card-tools .proj-tag { background: rgba(108,255,218,0.12); color: var(--accent3); border-color: rgba(108,255,218,0.25); }
  .card-tools .proj-link { color: var(--accent3); }
  .card-tools .new-badge { background: linear-gradient(90deg, #3fc9aa, var(--accent3)); }

  .proj-header { display: flex; align-items: center; gap: 12px; }
  .proj-icon {
    width: 44px; height: 44px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; flex-shrink: 0;
  }
  .proj-name {
    font-family: 'Syne', sans-serif;
    font-size: 16px; font-weight: 700; line-height: 1.2;
  }
  .proj-sub { font-size: 11px; color: var(--muted); margin-top: 3px; }
  .new-badge {
    display: inline-block;
    border-radius: 999px;
    padding: 2px 9px;
    font-size: 10px; font-weight: 700;
    color: #fff; letter-spacing: 0.06em;
    margin-left: 6px; vertical-align: middle;
  }
  .proj-desc { font-size: 13px; color: #a0a0bc; line-height: 1.65; flex: 1; }

  .proj-tags { display: flex; gap: 6px; flex-wrap: wrap; }
  .proj-tag {
    font-size: 11px; border-radius: 999px;
    padding: 3px 10px; border: 1px solid;
    font-weight: 600;
  }

  .proj-link {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 12px; font-weight: 700;
    letter-spacing: 0.03em;
    opacity: .85; transition: opacity .18s;
  }
  .proj-link:hover { opacity: 1; }
  .proj-arrow { transition: transform .18s; }
  .project-card:hover .proj-arrow { transform: translateX(4px); }

  /* STATS */
  .stats-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    animation: fadeUp .6s .15s ease both;
  }
  .stats-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px 18px;
    transition: border-color .25s, box-shadow .25s;
  }
  .stats-card:hover {
    border-color: rgba(123,108,255,0.4);
    box-shadow: 0 4px 24px rgba(123,108,255,0.1);
  }
  .stats-card img { width: 100%; border-radius: 8px; display: block; }

  .lang-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px 18px;
    animation: fadeUp .6s .05s ease both;
    transition: border-color .25s;
  }
  .lang-card:hover { border-color: rgba(108,255,218,0.4); }
  .lang-card img { width: 100%; border-radius: 8px; }

  @keyframes fadeUp {
    from { opacity:0; transform: translateY(18px); }
    to   { opacity:1; transform: translateY(0); }
  }
</style>
</head>
<body>
<div class="container">

  <!-- HEADER -->
  <div class="header">
    <div class="avatar">葵</div>
    <div class="header-info">
      <div class="name">葵 <span style="font-size:16px;opacity:.5;">/ aoi</span></div>
      <div class="username">@aoikozu</div>
      <div class="bio">
        <strong style="color:#ffb347;">Amber-Blossom</strong> 開発者 &nbsp;·&nbsp; 多数鯖運営<br>
        <span style="font-size:13px;color:var(--muted);">茜-あかね- / 心春-こはる- の開発・運営</span>
      </div>
    </div>
  </div>

  <!-- BADGES -->
  <div class="badges">
    <a class="badge" href="http://twitter.com/aoi_tyandesu" target="_blank">
      <span class="badge-dot twitter"></span>Twitter / @aoi_tyandesu
    </a>
    <a class="badge" href="https://github.com/aoikozu" target="_blank">
      <span class="badge-dot github"></span>GitHub / aoikozu
    </a>
    <span class="badge">
      <span class="badge-dot views"></span>Profile Views カウント中
    </span>
  </div>

  <!-- LANGUAGES -->
  <div class="lang-card">
    <div class="section-title" style="width:100%">🖥️ 使用言語</div>
    <img
      src="https://github-readme-stats.vercel.app/api/top-langs/?username=aoikozu&theme=tokyonight&hide_border=true&bg_color=12121a&title_color=7b6cff&text_color=e8e8f0"
      alt="Top Languages" loading="lazy"
    />
  </div>

  <!-- STATS -->
  <div class="stats-grid">
    <div class="stats-card">
      <div class="section-title">📊 統計</div>
      <img
        src="https://github-readme-stats.vercel.app/api?username=aoikozu&theme=tokyonight&hide_border=true&bg_color=12121a&title_color=7b6cff&text_color=e8e8f0&icon_color=ff6cb0"
        alt="GitHub Stats" loading="lazy"
      />
    </div>
    <div class="stats-card">
      <div class="section-title">🏆 トロフィー</div>
      <img
        src="https://github-profile-trophy.vercel.app/?username=aoikozu&theme=tokyonight&no-frame=true&row=2&column=3&margin-w=4"
        alt="Trophy" loading="lazy"
      />
    </div>
  </div>

  <!-- PROJECTS -->
  <div>
    <div class="section-title" style="margin-bottom:14px;">🚀 プロジェクト</div>
    <div class="projects-grid">

      <!-- Amber-Blossom -->
      <a class="project-card card-amber" href="https://amber-blossom.github.io/index" target="_blank">
        <div class="proj-header">
          <div class="proj-icon">🌸</div>
          <div>
            <div class="proj-name">
              Amber-Blossom
              <span class="new-badge">MAIN</span>
            </div>
            <div class="proj-sub">Discord Bot チーム</div>
          </div>
        </div>
        <div class="proj-desc">
          茜-あかね- / 心春-こはる- を開発・運営する公式チームサイト。BOTステータスや利用規約もここから。
        </div>
        <div class="proj-tags">
          <span class="proj-tag">茜-あかね-</span>
          <span class="proj-tag">心春-こはる-</span>
        </div>
        <div class="proj-link">サイトを見る <span class="proj-arrow">→</span></div>
      </a>

      <!-- Tools -->
      <a class="project-card card-tools" href="https://aoikozu.github.io/index" target="_blank">
        <div class="proj-header">
          <div class="proj-icon">🛠️</div>
          <div>
            <div class="proj-name">
              Amber Blossom Tools
              <span class="new-badge">UTIL</span>
            </div>
            <div class="proj-sub">便利ツール集</div>
          </div>
        </div>
        <div class="proj-desc">
          電卓・ルーレット・メモ帳・タイマー・QR生成など、毎日使える高機能ウェブツール集。全てブラウザで動作。
        </div>
        <div class="proj-tags">
          <span class="proj-tag">電卓</span>
          <span class="proj-tag">QR生成</span>
          <span class="proj-tag">カラーピッカー</span>
        </div>
        <div class="proj-link">ツールを使う <span class="proj-arrow">→</span></div>
      </a>

    </div>
  </div>

</div>
</body>
</html>
