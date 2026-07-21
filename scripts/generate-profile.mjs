import { mkdir, writeFile } from "node:fs/promises";

const username = process.env.PROFILE_USERNAME || "mxrcochxvez";
const token = process.env.GITHUB_TOKEN;
const outputPath = new URL("../assets/github-signal.svg", import.meta.url);

const query = `
  query ProfileSignal($login: String!) {
    user(login: $login) {
      followers { totalCount }
      repositories(
        first: 100
        ownerAffiliations: [OWNER]
        privacy: PUBLIC
        isFork: false
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        totalCount
        nodes { stargazerCount }
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
              weekday
            }
          }
        }
      }
    }
  }
`;

const escapeXml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

function compactNumber(value) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function contributionColor(count, maxCount) {
  if (count === 0) return "#102838";
  const ratio = maxCount <= 1 ? 1 : count / maxCount;
  if (ratio < 0.2) return "#174F62";
  if (ratio < 0.45) return "#1A7890";
  if (ratio < 0.7) return "#32A7BE";
  return "#F58025";
}

function metricCard({ x, label, value, detail, accent = "cyan" }) {
  const stroke = accent === "orange" ? "#F58025" : "#52C8EC";
  const valueColor = accent === "orange" ? "#FFB361" : "#B8EDFF";
  return `
    <g transform="translate(${x} 88)">
      <rect width="252" height="86" rx="18" fill="#FFFFFF" fill-opacity=".045" stroke="${stroke}" stroke-opacity=".38"/>
      <text x="20" y="26" fill="#84AFC2" font-size="12" font-weight="750" letter-spacing="1.8">${escapeXml(label)}</text>
      <text x="20" y="58" fill="${valueColor}" font-size="28" font-weight="850">${escapeXml(value)}</text>
      <text x="232" y="58" text-anchor="end" fill="#7495A3" font-size="11">${escapeXml(detail)}</text>
    </g>`;
}

function generateSvg(data) {
  const calendar = data.contributionsCollection.contributionCalendar;
  const weeks = calendar.weeks.slice(-53);
  const days = weeks.flatMap((week) => week.contributionDays);
  const maxCount = Math.max(1, ...days.map((day) => day.contributionCount));
  const stars = data.repositories.nodes.reduce(
    (total, repo) => total + repo.stargazerCount,
    0,
  );

  const cell = 13;
  const gap = 4;
  const startX = 168;
  const startY = 225;

  const cells = weeks
    .map((week, weekIndex) =>
      week.contributionDays
        .map((day) => {
          const x = startX + weekIndex * (cell + gap);
          const y = startY + day.weekday * (cell + gap);
          const fill = contributionColor(day.contributionCount, maxCount);
          const delay = ((weekIndex * 7 + day.weekday) % 31) * 0.035;
          return `<rect class="cell" x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="${fill}" style="animation-delay:${delay}s"><title>${escapeXml(day.date)}: ${day.contributionCount} contribution${day.contributionCount === 1 ? "" : "s"}</title></rect>`;
        })
        .join(""),
    )
    .join("");

  const refreshed = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date());

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="405" viewBox="0 0 1200 405" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} live GitHub activity signal</title>
  <desc id="desc">${data.repositories.totalCount} public repositories, ${data.followers.totalCount} followers, ${calendar.totalContributions} contributions in the last year, and ${stars} stars earned across public repositories.</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#06121C"/><stop offset="100%" stop-color="#0C2A3D"/></linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#F58025"/><stop offset="100%" stop-color="#FFBD72"/></linearGradient>
    <pattern id="hex" width="54" height="46.8" patternUnits="userSpaceOnUse"><path d="M13.5 1H40.5L53 23.4 40.5 45.8H13.5L1 23.4Z" fill="none" stroke="#8DD8F5" stroke-opacity=".055"/></pattern>
    <path id="beePath" d="M0 0 C171 -43 315 27 482 -16 S783 -33 926 -4" fill="none"/>
  </defs>
  <style>
    .cell { animation:rise 4.5s ease-in-out infinite; transform-box:fill-box; transform-origin:center; }
    .dash { stroke-dasharray:8 11; animation:flow 10s linear infinite; }
    @keyframes rise { 0%,100% { opacity:.72; transform:scale(.94) } 45% { opacity:1; transform:scale(1) } }
    @keyframes flow { to { stroke-dashoffset:-152 } }
    @media (prefers-reduced-motion: reduce) { .cell,.dash { animation:none!important } }
  </style>

  <rect x="8" y="8" width="1184" height="389" rx="28" fill="url(#bg)"/>
  <rect x="8" y="8" width="1184" height="389" rx="28" fill="url(#hex)"/>
  <rect x="8" y="8" width="1184" height="389" rx="28" fill="none" stroke="#5EBDE5" stroke-opacity=".18" stroke-width="2"/>

  <g font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif">
    <text x="54" y="53" fill="#A9E1F6" font-size="17" font-weight="800" letter-spacing="3">LIVE GITHUB SIGNAL</text>
    <text x="1146" y="53" text-anchor="end" fill="#789CAB" font-size="12">self-generated • no third-party stats service</text>

    ${metricCard({ x: 54, label: "PUBLIC BUILDS", value: compactNumber(data.repositories.totalCount), detail: "owner repos" })}
    ${metricCard({ x: 326, label: "FOLLOWERS", value: compactNumber(data.followers.totalCount), detail: "community" })}
    ${metricCard({ x: 598, label: "YEARLY SIGNAL", value: compactNumber(calendar.totalContributions), detail: "contributions", accent: "orange" })}
    ${metricCard({ x: 870, label: "STARS EARNED", value: compactNumber(stars), detail: "public repos", accent: "orange" })}

    <text x="54" y="228" fill="#7EA7B9" font-size="12" font-weight="750" letter-spacing="1.5">LAST 12 MONTHS</text>
    <text x="54" y="257" fill="#789CAB" font-size="12">Mon</text>
    <text x="54" y="291" fill="#789CAB" font-size="12">Wed</text>
    <text x="54" y="325" fill="#789CAB" font-size="12">Fri</text>
    <g>${cells}</g>

    <path class="dash" d="M164 354 C335 311 479 381 646 338 S947 321 1092 350" fill="none" stroke="url(#accent)" stroke-opacity=".48" stroke-width="2"/>
    <g transform="translate(164 354)">
      <ellipse cx="0" cy="0" rx="8" ry="5" fill="#F58025"/>
      <circle cx="-7" cy="0" r="4.5" fill="#FFD16F"/>
      <path d="M-1-3L4-9M-1 3L4 9" stroke="#BCEEFF" stroke-width="2" stroke-linecap="round"/>
      <animateMotion dur="9s" repeatCount="indefinite" rotate="auto"><mpath href="#beePath"/></animateMotion>
    </g>

    <text x="54" y="377" fill="#668A9A" font-size="11">Generated from GitHub GraphQL</text>
    <text x="1146" y="377" text-anchor="end" fill="#668A9A" font-size="11">Refreshed ${escapeXml(refreshed)}</text>
  </g>
</svg>`;
}

async function loadProfileData() {
  if (!token) throw new Error("GITHUB_TOKEN is required to generate the live profile signal.");

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": `${username}-profile-readme`,
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join("; "));
  if (!payload.data?.user) throw new Error(`GitHub user "${username}" was not found.`);
  return payload.data.user;
}

try {
  const data = await loadProfileData();
  const svg = generateSvg(data);
  await mkdir(new URL("../assets/", import.meta.url), { recursive: true });
  await writeFile(outputPath, svg, "utf8");
  console.log(`Updated ${outputPath.pathname}`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
