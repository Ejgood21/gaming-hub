import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  Compass,
  Copy,
  Eye,
  Flame,
  Heart,
  Info,
  Layers,
  LayoutGrid,
  Leaf,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Skull,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  Swords,
  Target,
  TriangleAlert,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { parse } from "yaml";
import prompt from "../per-patch-prompt.md?raw";
import tasteText from "../taste.yaml?raw";
import catalog from "../config/specs.json";
import {
  DIMENSION_LABELS,
  TAG_RULES,
  similarProfiles,
  tasteMatch,
} from "../pipeline/derive.mjs";

const datasets = Object.values(
  import.meta.glob("../data/*/profiles.json", {
    eager: true,
    import: "default",
  }),
);
const pointers = Object.values(
  import.meta.glob("../data/latest.json", { eager: true, import: "default" }),
);
const data = datasets.find((item) => item.patch === pointers[0]?.patch) ||
  datasets.sort(
    (a, b) => new Date(b.generated_at) - new Date(a.generated_at),
  )[0] || { patch: "Pending", season: {}, profiles: [] };
const defaults = parse(tasteText) || {};
const DEFAULT_MUST = defaults.must_haves ||
  defaults.must || ["stable-rotation", "always-send-cds", "no-ramp"];
const DEFAULT_AVOID = defaults.avoid || ["weak-on-pull"];
const LABELS = {
  "stable-rotation": "Stable rotation",
  "always-send-cds": "Always-send CDs",
  "no-ramp": "No ramp",
  "weak-on-pull": "Weak on pull",
  "no-aoe-setup": "No AoE setup",
  "direct-healing": "Direct healing",
  "high-movement": "High movement",
  "self-sufficient": "Self-sufficient",
  "sustained-damage": "Sustained damage",
  "low-complexity": "Low complexity",
  "proactive-mitigation": "Proactive mitigation",
};
const FEATURE_DIMS = {
  dps: ["rotation_stability", "cooldown_flexibility", "movement"],
  healer: ["ramp", "healing_model", "cooldown_style"],
  tank: ["pull_profile", "self_sustain", "mitigation_style"],
};
const ICONS = {
  "Death Knight": Skull,
  "Demon Hunter": Eye,
  Druid: Leaf,
  Evoker: Flame,
  Hunter: Target,
  Mage: Snowflake,
  Monk: Wind,
  Paladin: Shield,
  Priest: Sparkles,
  Rogue: Swords,
  Shaman: Zap,
  Warlock: Flame,
  Warrior: Swords,
};
const ROLE_ICONS = { dps: Swords, healer: Heart, tank: Shield };
const PRIMARY_TAGS = [
  "stable-rotation",
  "always-send-cds",
  "no-ramp",
  "no-aoe-setup",
  "high-movement",
];
const ALL_TAGS = [
  ...new Set([
    ...Object.keys(TAG_RULES),
    ...data.profiles.flatMap((p) => p.tags || []),
  ]),
];
const BY_SPEC = Object.fromEntries(
  catalog.map((spec) => [
    spec.id,
    {
      spec,
      raid: data.profiles.find(
        (p) => p.spec_id === spec.id && p.content_type === "raid",
      ),
      mythic_plus: data.profiles.find(
        (p) => p.spec_id === spec.id && p.content_type === "mythic_plus",
      ),
    },
  ]),
);
const contentLabel = (value) => (value === "raid" ? "Raid" : "Mythic+");
const title = (value) =>
  LABELS[value] ||
  String(value ?? "Unverified")
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/^./, (letter) => letter.toUpperCase());
const classSlug = (spec) =>
  `class-${spec.class.toLowerCase().replaceAll(" ", "-")}`;
const displayValue = (value, dimension) =>
  value == null
    ? "Not verified"
    : typeof value === "number"
      ? `${value}/5`
      : title(value);
const known = (dimension) =>
  dimension?.value != null && dimension?.sources?.length;
const formatDate = (value) =>
  value ? new Date(value).toISOString().slice(0, 10) : "Date unavailable";
const seasonFallback =
  /fallback|override|unverified/i.test(data.season.source || "") ||
  Boolean(data.season.coverage_gaps?.length);
const readLocal = (key, fallback) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) &&
      value.every((item) => typeof item === "string")
      ? value
      : fallback;
  } catch {
    return fallback;
  }
};
function sourceLink(source) {
  if (source.timestamp_seconds == null) return source.url;
  const url = new URL(source.url);
  url.searchParams.set("t", `${source.timestamp_seconds}s`);
  return url.href;
}
function Src({ sources = [] }) {
  return (
    <span className="sources">
      {sources.map((source, index) => (
        <a
          key={`${source.source_id}-${index}`}
          href={sourceLink(source)}
          target="_blank"
          rel="noreferrer"
        >
          {title(
            source.source_id
              .replace("-web", "")
              .replace("icy-veins", "Icy Veins"),
          )}
          {source.timestamp_seconds != null
            ? ` · ${Math.floor(source.timestamp_seconds / 60)}:${String(Math.floor(source.timestamp_seconds % 60)).padStart(2, "0")}`
            : ""}
          <ArrowUpRight size={11} />
        </a>
      ))}
    </span>
  );
}
function Coverage({ profile }) {
  return (
    <span
      className={`coverage ${profile?.confidence?.level || "low"}`}
      title={profile?.confidence?.reasons?.join(" ")}
    >
      <i />
      {title(profile?.confidence?.level || "low")} coverage
    </span>
  );
}
function Dimension({ dimension, name, compact = false, changed = false }) {
  return (
    <details className={`dimension ${compact ? "compact" : ""}`}>
      <summary>
        <span className="dimension-heading">
          <span>
            {DIMENSION_LABELS[name] || title(name)}
            {changed && <b className="changed-badge">Changed</b>}
          </span>
          <strong>{displayValue(dimension?.value, name)}</strong>
          <Plus size={13} />
        </span>
        {compact && (
          <span className="dimension-preview">
            {dimension?.explanation || "Current-patch evidence is unavailable."}
          </span>
        )}
      </summary>
      <div className="dimension-body">
        <p>
          {dimension?.explanation || "Current-patch evidence is unavailable."}
        </p>
        {dimension?.key_abilities?.length > 0 && (
          <div className="ability-list">
            {dimension.key_abilities.map((ability) => (
              <span key={ability}>{ability}</span>
            ))}
          </div>
        )}
        {dimension?.cooldowns?.map((cooldown) => (
          <p key={cooldown.name}>
            {cooldown.name} · {cooldown.duration_seconds}s
            {cooldown.charges ? ` · ${cooldown.charges} charges` : ""}
            {cooldown.explanation ? ` — ${cooldown.explanation}` : ""}
          </p>
        ))}
        <Src sources={dimension?.sources} />
      </div>
    </details>
  );
}
function TagEvidence({ profile, tag }) {
  const evidence = profile.tag_evidence?.[tag] || [];
  return (
    <details className="evidence-tag">
      <summary>
        <Check size={11} />
        {title(tag)}
      </summary>
      <div>
        {evidence.map((name) => (
          <div key={name}>
            <p>{profile.dimensions[name]?.explanation}</p>
            <Src sources={profile.dimensions[name]?.sources} />
          </div>
        ))}
      </div>
    </details>
  );
}
function ChangeNotes({ profile }) {
  return (
    profile.changes?.length > 0 && (
      <div className="change-notes">
        <h3>What changed this patch</h3>
        {profile.changes.map((change, index) => (
          <p key={index}>
            <strong>
              {DIMENSION_LABELS[change.dimension] || title(change.dimension)}
              {change.kind === "coverage" ? " · Coverage changed" : ""}
            </strong>
            {change.kind !== "evidence" && (
              <span>
                {displayValue(change.previous)} → {displayValue(change.current)}
              </span>
            )}
            {change.explanation}
          </p>
        ))}
      </div>
    )
  );
}
function ProfileDetail({
  profile,
  taste,
  onSelectSpec,
  includeSimilar = false,
}) {
  if (!profile) return <p>Current-patch profile unavailable.</p>;
  const match = tasteMatch(profile, taste),
    similar = includeSimilar ? similarProfiles(profile, data.profiles) : [];
  return (
    <section className="profile-detail">
      <div className="detail-content-label">
        <span>{contentLabel(profile.content_type)}</span>
        <Coverage profile={profile} />
      </div>
      <p className="detail-feel">{profile.feel_summary}</p>
      <div className="fit-reason">
        <Sparkles size={17} />
        <div>
          <strong>
            {match.total
              ? `Matches ${match.matched}/${match.total} applicable must-haves`
              : "Your must-haves apply to other roles"}
          </strong>
          {match.details
            .filter((item) => item.matched)
            .map((item) => (
              <div key={item.tag}>
                <TagEvidence profile={profile} tag={item.tag} />
              </div>
            ))}
          {match.details.some((item) => item.applicable && !item.matched) && (
            <p>
              Not established:{" "}
              {match.details
                .filter((item) => item.applicable && !item.matched)
                .map((item) => title(item.tag))
                .join(", ")}
              .
            </p>
          )}
          {match.non_applicable?.length > 0 && (
            <p className="taste-applicability">
              {match.non_applicable.map(title).join(", ")}{" "}
              {match.non_applicable.length === 1 ? "does" : "do"} not apply to
              this role.
            </p>
          )}
          {match.warnings.map((tag) => (
            <p className="warning-text" key={tag}>
              Heads up: {title(tag)}. This is a warning, so it never hides this
              spec.
            </p>
          ))}
        </div>
      </div>
      <div className="play-avoid">
        <div>
          <Check size={15} />
          <p>
            <strong>Play this if</strong>
            {profile.play_this_if}
          </p>
        </div>
        <div>
          <Minus size={15} />
          <p>
            <strong>Avoid if</strong>
            {profile.avoid_if}
          </p>
        </div>
      </div>
      <h3>The way it plays</h3>
      {Object.entries(profile.dimensions).map(([name, dimension]) => (
        <Dimension
          key={name}
          name={name}
          dimension={dimension}
          changed={profile.changes?.some((change) => change.dimension === name)}
        />
      ))}
      <h3>Hero talents</h3>
      <div className="hero-talents">
        {profile.hero_talents.map((option) => (
          <div key={option.name}>
            <div>
              <strong>{option.name}</strong>
              <span>
                {option.pick_rate == null
                  ? "Pick rate unavailable"
                  : `${option.pick_rate}%`}
                {option.popular ? " · Popular choice" : ""}
              </span>
            </div>
            <p>{option.playstyle_delta.explanation}</p>
            <Src sources={option.playstyle_delta.sources} />
            {option.pick_rate_sources?.length > 0 && (
              <Src sources={option.pick_rate_sources} />
            )}
          </div>
        ))}
      </div>
      <ChangeNotes profile={profile} />
      <h3>Evidence & coverage</h3>
      <p className="extraction-note">{profile.confidence.reasons.join(" ")}</p>
      <div className="source-audit">
        {profile.provenance.sources.map((source) => (
          <div key={source.id}>
            <span className={`status-dot ${source.status}`} />
            {source.url ? (
              <a href={source.url} target="_blank" rel="noreferrer">
                {title(source.id)}
                <ArrowUpRight size={12} />
              </a>
            ) : (
              <span>{title(source.id)}</span>
            )}
            <span>{title(source.status)}</span>
          </div>
        ))}
      </div>
      <ul className="gap-list">
        {profile.provenance.coverage_gaps.map((gap, index) => (
          <li key={index}>{gap}</li>
        ))}
      </ul>
      {includeSimilar && (
        <div className="similar-specs">
          <h3>If you like this, try…</h3>
          <p>
            Shared playstyle tags and matching rotation, cooldown, or ramp
            dimensions in {contentLabel(profile.content_type)}.
          </p>
          {similar.length ? (
            similar.map(
              ({ profile: other, shared_tags, matching_dimensions }) => (
                <button
                  key={other.id}
                  onClick={() => onSelectSpec(other.spec_id)}
                >
                  <span>
                    {other.spec_name} {other.class_name}
                    <small>
                      {[
                        ...shared_tags.map(title),
                        ...matching_dimensions.map(
                          (name) => DIMENSION_LABELS[name],
                        ),
                      ].join(" · ")}
                    </small>
                  </span>
                  <ArrowRight size={15} />
                </button>
              ),
            )
          ) : (
            <p>More verified evidence is needed to make a useful comparison.</p>
          )}
        </div>
      )}
    </section>
  );
}
function Modal({ title: modalTitle, eyebrow, onClose, children }) {
  const ref = useRef(null),
    previousFocus = useRef(null);
  useEffect(() => {
    previousFocus.current = document.activeElement;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previousFocus.current?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="detail-modal"
      aria-label={modalTitle}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal-header">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{modalTitle}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close detail view"
          onClick={onClose}
        >
          <X size={23} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Processing() {
  const evidenced = data.profiles.filter((profile) =>
    Object.values(profile.dimensions).some(known),
  ).length;
  const successful = data.profiles.filter(
    (profile) =>
      profile.provenance.sources.some(
        (source) => source.id === "wowhead" && source.status === "success",
      ) &&
      profile.provenance.sources.some(
        (source) =>
          source.kind === "quantitative" && source.status === "success",
      ),
  ).length;
  const hasGaps = data.profiles.some(
    (profile) => profile.provenance.coverage_gaps.length > 0,
  );
  return (
    <section className="secondary-page processing-page">
      <div className="eyebrow">TRUST, WITH A PAPER TRAIL.</div>
      <h1>
        Behind the <em>profiles.</em>
      </h1>
      <p className="page-description">
        See what was collected, what is missing, and where every playstyle
        observation comes from.
      </p>
      <div className="audit-metrics">
        <div>
          <strong>{catalog.length}</strong>
          <span>Specializations</span>
        </div>
        <div>
          <strong>{data.profiles.length}</strong>
          <span>Separate content profiles</span>
        </div>
        <div>
          <strong>{evidenced}</strong>
          <span>With guide observations</span>
        </div>
        <div>
          <strong>{successful}</strong>
          <span>Wowhead + quantitative</span>
        </div>
      </div>
      {hasGaps && (
        <div className="audit-notice">
          <TriangleAlert size={18} />
          <p>
            <strong>Source coverage has gaps</strong>
            {successful}/{data.profiles.length} profiles meet the Wowhead plus
            quantitative source target. Missing or stale evidence stays visible
            below; unknown pick rates and labels are never filled by guesswork.
          </p>
        </div>
      )}
      <div className="processing-list">
        {catalog.map((spec) => {
          const profiles = [
            BY_SPEC[spec.id].raid,
            BY_SPEC[spec.id].mythic_plus,
          ].filter(Boolean);
          return (
            <details
              key={spec.id}
              className={`processing-row ${classSlug(spec)}`}
            >
              <summary>
                <span className="small-class-dot" />
                <span>
                  <strong>{spec.name}</strong>
                  <small>{spec.class}</small>
                </span>
                <span className="processing-role">{title(spec.role)}</span>
                <div className="source-pills">
                  {["wowhead", "archon", "raiderio", "youtube"].map((id) => (
                    <span
                      key={id}
                      className={
                        profiles.length &&
                        profiles.every((profile) =>
                          profile.provenance.sources.some(
                            (source) =>
                              source.id === id && source.status === "success",
                          ),
                        )
                          ? "good"
                          : ""
                      }
                    >
                      {id}
                      <span>
                        {profiles.some((profile) =>
                          profile.provenance.sources.some(
                            (source) =>
                              source.id === id && source.status === "success",
                          ),
                        )
                          ? "✓"
                          : "—"}
                      </span>
                    </span>
                  ))}
                </div>
                <Coverage profile={profiles[0]} />
                <ChevronDown size={14} />
              </summary>
              <div className="processing-expanded">
                {profiles.map((profile) => (
                  <div key={profile.id}>
                    <h3>{contentLabel(profile.content_type)}</h3>
                    <p>
                      Last attempted:{" "}
                      <time dateTime={profile.provenance.scraped_at}>
                        {formatDate(profile.provenance.scraped_at)}
                      </time>
                    </p>
                    {profile.provenance.sources.map((source) => (
                      <div className="source-log" key={source.id}>
                        <div>
                          <span className={`status-dot ${source.status}`} />
                          {source.url ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {title(source.id)}
                              <ArrowUpRight size={11} />
                            </a>
                          ) : (
                            <span>{title(source.id)}</span>
                          )}
                          <b>{title(source.status)}</b>
                        </div>
                        <p>
                          Collected: {formatDate(source.scraped_at)} · Updated:{" "}
                          {formatDate(source.updated_at)}
                        </p>
                        <p>
                          {source.reason ||
                            "Source retrieved successfully; read the linked evidence to audit extraction."}
                        </p>
                        {source.video && (
                          <p>
                            {source.video.title} · {source.video.channel} ·{" "}
                            {source.video.view_count.toLocaleString("en-US")}{" "}
                            views · {formatDate(source.video.uploaded_at)}
                          </p>
                        )}
                      </div>
                    ))}
                    <ul>
                      {profile.provenance.coverage_gaps.map((gap, index) => (
                        <li key={index}>{gap}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
export default function App() {
  const [enhanced, setEnhanced] = useState(false),
    [view, setView] = useState("explore"),
    [content, setContent] = useState("mythic_plus"),
    [role, setRole] = useState("all"),
    [query, setQuery] = useState(""),
    [tags, setTags] = useState([]),
    [sort, setSort] = useState("taste");
  const [must, setMust] = useState(DEFAULT_MUST),
    [avoid, setAvoid] = useState(DEFAULT_AVOID),
    [saved, setSaved] = useState([]),
    [detail, setDetail] = useState(null),
    [compare, setCompare] = useState([]),
    [compareOpen, setCompareOpen] = useState(false),
    [copyState, setCopyState] = useState(""),
    [showFilters, setShowFilters] = useState(false);
  const promptRef = useRef(null);
  useEffect(() => {
    setMust(readLocal("wow-taste-must", DEFAULT_MUST));
    setAvoid(readLocal("wow-taste-avoid", DEFAULT_AVOID));
    setSaved(readLocal("wow-saved", []));
    setEnhanced(true);
    const readHash = () => {
      const hash = location.hash.slice(1);
      if (
        ["explore", "taste", "changes", "processing", "prompt"].includes(hash)
      )
        setView(hash);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);
  useEffect(() => {
    if (!enhanced) return;
    try {
      localStorage.setItem("wow-taste-must", JSON.stringify(must));
      localStorage.setItem("wow-taste-avoid", JSON.stringify(avoid));
      localStorage.setItem("wow-saved", JSON.stringify(saved));
    } catch {}
  }, [enhanced, must, avoid, saved]);
  const taste = useMemo(() => ({ must, avoid }), [must, avoid]);
  const current = (id) =>
    BY_SPEC[id]?.[content === "compare" ? "mythic_plus" : content];
  const filtered = catalog
    .filter((spec) => {
      const profiles =
        content === "compare"
          ? [BY_SPEC[spec.id].raid, BY_SPEC[spec.id].mythic_plus]
          : [current(spec.id)];
      return (
        (role === "all" || spec.role === role) &&
        `${spec.name} ${spec.class}`
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        profiles.some(
          (profile) =>
            profile && tags.every((tag) => profile.tags.includes(tag)),
        )
      );
    })
    .sort((a, b) => {
      if (sort === "name")
        return `${a.class} ${a.name}`.localeCompare(
          `${b.class} ${b.name}`,
          "en",
        );
      if (sort === "saved")
        return Number(saved.includes(b.id)) - Number(saved.includes(a.id));
      return (
        tasteMatch(current(b.id), taste).score -
        tasteMatch(current(a.id), taste).score
      );
    });
  const evidenced = data.profiles.filter((profile) =>
      Object.values(profile.dimensions).some(known),
    ).length,
    changedProfiles = data.profiles.filter(
      (profile) => profile.changes?.length,
    );
  const sourceTarget = data.profiles.filter(
    (profile) =>
      profile.provenance.sources.some(
        (source) => source.id === "wowhead" && source.status === "success",
      ) &&
      profile.provenance.sources.some(
        (source) =>
          source.kind === "quantitative" && source.status === "success",
      ),
  ).length;
  const toggle = (values, setter, value) =>
    setter(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  function navigate(next) {
    setView(next);
    setDetail(null);
    setCompareOpen(false);
    history.replaceState(null, "", `#${next}`);
    document.getElementById("main")?.scrollIntoView({ behavior: "smooth" });
  }
  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyState("Copied to clipboard");
    } catch {
      promptRef.current?.focus();
      promptRef.current?.select();
      promptRef.current?.setSelectionRange(0, prompt.length);
      setCopyState("Text selected — use your device’s Copy action.");
    }
  }
  function tagChip(tag) {
    return (
      <button
        key={tag}
        className={`filter-chip ${tags.includes(tag) ? "active" : ""}`}
        aria-pressed={tags.includes(tag)}
        onClick={() => toggle(tags, setTags, tag)}
      >
        {tags.includes(tag) ? <Check size={12} /> : <Plus size={12} />}{" "}
        {title(tag)}
      </button>
    );
  }
  function card(spec) {
    const profile = current(spec.id);
    if (!profile) return null;
    const match = tasteMatch(profile, taste),
      Icon = ICONS[spec.class] || Swords,
      RoleIcon = ROLE_ICONS[spec.role];
    return (
      <article className={`spec-card ${classSlug(spec)}`} key={spec.id}>
        <div className="card-top">
          <div className="spec-icon">
            <Icon size={24} strokeWidth={1.5} />
          </div>
          <span className="spec-role">
            <RoleIcon size={12} />
            {spec.role === "dps" ? "DPS" : title(spec.role)}
          </span>
          <span className="card-content-label">
            {content === "compare" ? "Raid & Mythic+" : contentLabel(content)}
          </span>
          <button
            className={`icon-button bookmark requires-js ${saved.includes(spec.id) ? "saved" : ""}`}
            onClick={() => toggle(saved, setSaved, spec.id)}
            aria-pressed={saved.includes(spec.id)}
            aria-label={`${saved.includes(spec.id) ? "Unsave" : "Save"} ${spec.name} ${spec.class}`}
          >
            <Bookmark
              size={17}
              fill={saved.includes(spec.id) ? "currentColor" : "none"}
            />
          </button>
        </div>
        <div className="spec-heading">
          <span className="class-name">{spec.class}</span>
          <h3>
            <button className="requires-js" onClick={() => setDetail(spec.id)}>
              {spec.name}
              <ArrowUpRight size={18} />
            </button>
            <span className="no-js-name">{spec.name}</span>
          </h3>
        </div>
        {content !== "compare" ? (
          <>
            <p className="feel-summary">{profile.feel_summary}</p>
            <div className="card-tags">
              {profile.tags.slice(0, 3).map((tag) => (
                <TagEvidence key={tag} profile={profile} tag={tag} />
              ))}
              {!profile.tags.length && (
                <span className="muted-tag">
                  <Info size={11} />
                  Playstyle evidence pending
                </span>
              )}
            </div>
            <div className="card-dimensions">
              {FEATURE_DIMS[spec.role].map((name) => (
                <Dimension
                  key={name}
                  name={name}
                  dimension={profile.dimensions[name]}
                  compact
                  changed={profile.changes?.some(
                    (change) => change.dimension === name,
                  )}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="content-compare">
            {["raid", "mythic_plus"].map((type) => {
              const item = BY_SPEC[spec.id][type],
                fit = tasteMatch(item, taste);
              return (
                <section key={type}>
                  <div className="compare-profile-label">
                    <strong>{contentLabel(type)}</strong>
                    <span>
                      {fit.total
                        ? `${fit.matched}/${fit.total} match`
                        : "Taste not set for role"}
                    </span>
                  </div>
                  <p>{item.feel_summary}</p>
                  {FEATURE_DIMS[spec.role].map((name) => (
                    <Dimension
                      key={name}
                      name={name}
                      dimension={item.dimensions[name]}
                      compact
                      changed={item.changes?.some(
                        (change) => change.dimension === name,
                      )}
                    />
                  ))}
                  <Coverage profile={item} />
                </section>
              );
            })}
          </div>
        )}
        <div className="card-footer">
          <button
            className="match-score requires-js"
            onClick={() => setDetail(spec.id)}
          >
            <span className="match-dots">
              {match.details
                .filter((item) => item.applicable)
                .map((item) => (
                  <i className={item.matched ? "filled" : ""} key={item.tag} />
                ))}
            </span>
            <strong>
              {match.total ? `${match.matched}/${match.total}` : "—"}
            </strong>{" "}
            {match.total
              ? content === "compare"
                ? "M+ taste match"
                : "taste match"
              : "no applicable taste"}
          </button>
          <Coverage profile={profile} />
        </div>
        {match.warnings.length > 0 && (
          <p className="card-warning">
            <TriangleAlert size={12} />
            {content === "compare" ? "Mythic+: " : ""}
            {match.warnings.map(title).join(" · ")} · a warning, never a ban
          </p>
        )}
        <div className="card-actions requires-js">
          <button className="text-button" onClick={() => setDetail(spec.id)}>
            Explore playstyle
            <ArrowRight size={13} />
          </button>
          <button
            className={`compare-pick ${compare.includes(spec.id) ? "selected" : ""}`}
            onClick={() => toggle(compare, setCompare, spec.id)}
            aria-pressed={compare.includes(spec.id)}
            aria-label={`Compare ${spec.name} ${spec.class}`}
          >
            {compare.includes(spec.id) ? (
              <Check size={12} />
            ) : (
              <Plus size={12} />
            )}
            Compare
          </button>
        </div>
      </article>
    );
  }
  return (
    <div className={`wow-app ${enhanced ? "is-enhanced" : ""}`}>
      <div className="app-identity">
        <div className="identity-title">
          <Compass size={20} />
          <span>Spec Playstyle Compass</span>
          <span className="retail-label">RETAIL</span>
        </div>
        <button
          className="refresh-button requires-js"
          onClick={() => navigate("prompt")}
        >
          <RefreshCw size={14} />
          New patch? Refresh data
        </button>
      </div>
      <nav className="page-nav requires-js" aria-label="WoW dashboard">
        {[
          ["explore", "Explore specs", Compass],
          ["taste", "My taste", SlidersHorizontal],
          ["changes", "Patch notes", Sparkles],
          ["processing", "Processing", Activity],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            className={view === key ? "active" : ""}
            aria-current={view === key ? "page" : undefined}
            onClick={() => navigate(key)}
          >
            <Icon size={15} />
            {label}
            {key === "taste" && (
              <span className="nav-count">{must.length}</span>
            )}
            {key === "changes" && changedProfiles.length > 0 && (
              <span className="nav-count">{changedProfiles.length}</span>
            )}
          </button>
        ))}
      </nav>
      {view === "explore" && (
        <>
          <section className="intro">
            <div>
              <div className="eyebrow">
                <span />
                LESS RESEARCH. MORE PLAYING.
              </div>
              <h1>
                Find your next <em>main.</em>
              </h1>
              <p>
                Strong is a stat. <strong>Fun is personal.</strong>
                <br className="mobile-break" /> Find the spec that plays the way
                you like.
              </p>
              <div className="season-label">
                <span className="live-dot" />
                {data.season.expansion || "Retail WoW"} <span>/</span>{" "}
                {data.season.name || "Season unverified"}
                <span className="patch-label">Patch {data.patch}</span>
                {seasonFallback && (
                  <span
                    className="season-fallback"
                    title={(data.season.coverage_gaps || []).join(" ")}
                  >
                    Season auto-detection pending
                  </span>
                )}
              </div>
            </div>
            <div className="compass-art" aria-hidden="true">
              <div className="compass-ring ring-one" />
              <div className="compass-ring ring-two" />
              <span className="north">N</span>
              <span className="east">E</span>
              <span className="south">S</span>
              <span className="west">W</span>
              <Compass strokeWidth={0.6} />
              <div className="compass-coordinate">YOUR PLAYSTYLE, MAPPED</div>
            </div>
          </section>
          <section className="taste-strip">
            <div className="taste-strip-icon">
              <Sparkles size={18} />
            </div>
            <div className="taste-strip-heading">
              <strong>Built around your taste</strong>
              <span>Your must-haves, front and center.</span>
            </div>
            <div className="taste-strip-tags">
              {must.map((tag) => (
                <span key={tag}>
                  <Check size={11} />
                  {title(tag)}
                </span>
              ))}
            </div>
            <button className="requires-js" onClick={() => navigate("taste")}>
              Edit my taste
              <ArrowUpRight size={13} />
            </button>
          </section>
          <section className="explore-toolbar requires-js">
            <div className="toolbar-heading">
              <h2>
                Explore specializations<span>{catalog.length}</span>
              </h2>
              <div className="content-toggle" aria-label="Content type">
                {[
                  ["mythic_plus", "Mythic+", Swords],
                  ["raid", "Raid", Shield],
                  ["compare", "Side by side", Layers],
                ].map(([key, label, Icon]) => (
                  <button
                    key={key}
                    className={content === key ? "active" : ""}
                    aria-pressed={content === key}
                    onClick={() => setContent(key)}
                  >
                    <Icon size={13} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-main">
              <div className="role-tabs" aria-label="Role filter">
                {["all", "dps", "healer", "tank"].map((key) => {
                  const Icon = ROLE_ICONS[key] || LayoutGrid;
                  return (
                    <button
                      key={key}
                      className={role === key ? "active" : ""}
                      aria-pressed={role === key}
                      onClick={() => setRole(key)}
                    >
                      <Icon size={13} />
                      {key === "all"
                        ? "All roles"
                        : key === "dps"
                          ? "DPS"
                          : title(key)}
                    </button>
                  );
                })}
              </div>
              <div className="search-box">
                <Search size={15} />
                <input
                  aria-label="Search specs or classes"
                  placeholder="Find a spec or class…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
            <div className="feel-filters">
              <span>
                <SlidersHorizontal size={13} />
                Filter by feel
              </span>
              {PRIMARY_TAGS.map(tagChip)}
              <button
                className={`more-filter ${showFilters ? "active" : ""}`}
                aria-expanded={showFilters}
                onClick={() => setShowFilters(!showFilters)}
              >
                More
                <ChevronDown size={12} />
              </button>
              {tags.length > 0 && (
                <button className="clear-button" onClick={() => setTags([])}>
                  Clear
                </button>
              )}
            </div>
            {showFilters && (
              <div className="extra-filters">
                {ALL_TAGS.filter((tag) => !PRIMARY_TAGS.includes(tag)).map(
                  tagChip,
                )}
              </div>
            )}
          </section>
          <div className="results-heading">
            <p role="status">
              Showing <strong>{filtered.length}</strong> specs<span>·</span>
              {content === "compare" ? "Raid & Mythic+" : contentLabel(content)}
              <span>·</span>
              <span className="coverage-note">
                {sourceTarget === data.profiles.length && sourceTarget
                  ? "Source target met"
                  : "Provisional coverage"}
              </span>
            </p>
            <label className="requires-js">
              Sort by
              <select
                aria-label="Sort specs"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="taste">
                  {content === "compare" ? "Taste match (M+)" : "Taste match"}
                </option>
                <option value="name">Class & name</option>
                <option value="saved">Saved first</option>
              </select>
            </label>
          </div>
          <div
            className={`spec-grid ${content === "compare" ? "content-side-by-side" : ""}`}
          >
            {filtered.map(card)}
          </div>
          {!filtered.length && (
            <div className="empty-state">
              <Compass size={32} />
              <h3>No verified matches yet</h3>
              <p>
                Try fewer feel filters. Missing evidence never counts as a
                match.
              </p>
              <button
                onClick={() => {
                  setTags([]);
                  setQuery("");
                  setRole("all");
                }}
              >
                Reset filters
                <ArrowRight size={14} />
              </button>
            </div>
          )}
          <div className="evidence-footer">
            <BookOpen size={15} />
            <p>
              Feel comes first. Evidence stays close.
              <span>
                {evidenced} of {data.profiles.length} profiles have guide
                observations. {sourceTarget}/{data.profiles.length} meet the
                Wowhead plus quantitative coverage target.
              </span>
            </p>
            <button
              className="requires-js"
              onClick={() => navigate("processing")}
            >
              Inspect coverage
              <ArrowUpRight size={13} />
            </button>
          </div>
          <noscript>
            <section className="no-script-reading">
              <p>
                These cards and their expandable evidence work without
                JavaScript. Enable JavaScript to filter, save taste preferences,
                and compare. Full raid and Mythic+ profiles are available below.
              </p>
              <details>
                <summary>
                  Read all content profiles, sources, and coverage notes
                </summary>
                {data.profiles.map((profile) => (
                  <details className="static-profile" key={profile.id}>
                    <summary>
                      {contentLabel(profile.content_type)} {profile.spec_name}{" "}
                      {profile.class_name}
                    </summary>
                    <ProfileDetail
                      profile={profile}
                      taste={{ must: DEFAULT_MUST, avoid: DEFAULT_AVOID }}
                    />
                  </details>
                ))}
              </details>
              <details>
                <summary>Per-patch refresh prompt</summary>
                <pre>{prompt}</pre>
              </details>
            </section>
          </noscript>
        </>
      )}
      {view === "taste" && (
        <section className="secondary-page">
          <div className="eyebrow">YOUR GAME. YOUR RULES.</div>
          <h1>
            What feels <em>right?</em>
          </h1>
          <p className="page-description">
            Choose the things that make a spec click. Your preferences stay on
            this device.
          </p>
          <div className="settings-panel">
            <h2>Your must-haves</h2>
            <p>
              Cards rank by evidence-backed matches. Unknown dimensions never
              count.
            </p>
            <div className="taste-options">
              {ALL_TAGS.filter((tag) => tag !== "weak-on-pull").map((tag) => (
                <button
                  className={must.includes(tag) ? "active" : ""}
                  aria-pressed={must.includes(tag)}
                  key={tag}
                  onClick={() => toggle(must, setMust, tag)}
                >
                  {must.includes(tag) ? (
                    <Check size={15} />
                  ) : (
                    <Plus size={15} />
                  )}
                  <span>{title(tag)}</span>
                </button>
              ))}
            </div>
            <h2>Things to watch out for</h2>
            <p>These add a warning; they never hide a spec.</p>
            <div className="taste-options">
              {[
                "weak-on-pull",
                "high-complexity",
                "hard-ramp",
                "committed-cooldowns",
              ].map((tag) => (
                <button
                  className={`warning-option ${avoid.includes(tag) ? "active" : ""}`}
                  aria-pressed={avoid.includes(tag)}
                  key={tag}
                  onClick={() => toggle(avoid, setAvoid, tag)}
                >
                  <TriangleAlert size={15} />
                  {title(tag)}
                </button>
              ))}
            </div>
            <div className="settings-actions">
              <button
                className="primary-button"
                onClick={() => navigate("explore")}
              >
                Find my specs
                <ArrowRight size={15} />
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setMust(DEFAULT_MUST);
                  setAvoid(DEFAULT_AVOID);
                }}
              >
                Reset to taste.yaml
              </button>
            </div>
          </div>
          <div className="small-note">
            <Info size={15} />
            Preferences are saved in this browser. Edit taste.yaml in the
            repository to change defaults across devices.
          </div>
        </section>
      )}
      {view === "prompt" && (
        <section className="secondary-page prompt-page">
          <div className="eyebrow">A FRESH PATCH. A FRESH PERSPECTIVE.</div>
          <h1>
            Keep your compass <em>current.</em>
          </h1>
          <p className="page-description">
            One reusable prompt. New sources, new profiles, and a clear view of
            what changed.
          </p>
          <div className="prompt-panel">
            <div className="prompt-heading">
              <div>
                <BookOpen size={18} />
                <h2>Per-patch prompt</h2>
                <span>per-patch-prompt.md</span>
              </div>
              <button className="primary-button" onClick={copyPrompt}>
                {copyState.startsWith("Copied") ? (
                  <CheckCheck size={16} />
                ) : (
                  <Copy size={16} />
                )}
                Copy prompt
              </button>
            </div>
            <textarea
              ref={promptRef}
              aria-label="Per-patch prompt, select and copy"
              readOnly
              value={prompt}
            />
            <p role="status" className="copy-status">
              {copyState ||
                "Loaded from the same prompt file used by the pipeline."}
            </p>
          </div>
          <div className="prompt-instructions">
            <span>01</span>
            <p>
              Paste this into a new Codex task in the gaming-hub environment, on
              Extra High.
              <br />
              Codex will detect the patch, re-scrape, extract, diff, and open a
              PR into main.
            </p>
          </div>
        </section>
      )}
      {view === "processing" && <Processing />}
      {view === "changes" && (
        <section className="secondary-page">
          <div className="eyebrow">BACK AFTER A BREAK?</div>
          <h1>
            Catch up. <em>Log in.</em>
          </h1>
          <p className="page-description">
            Playstyle changes between patches, linked to the abilities that
            caused them.
          </p>
          {changedProfiles.length ? (
            <div className="change-list">
              {changedProfiles.map((profile) => (
                <article key={profile.id}>
                  <h3>
                    {profile.spec_name} {profile.class_name}
                    <span>{contentLabel(profile.content_type)}</span>
                  </h3>
                  <ChangeNotes profile={profile} />
                  <button
                    className="text-button"
                    onClick={() => setDetail(profile.spec_id)}
                  >
                    See evidence
                    <ArrowRight size={14} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state patch-empty">
              <Layers size={34} />
              <h3>Your first snapshot is the starting point</h3>
              <p>
                There is no previous patch to compare yet. The next refresh
                preserves this snapshot and highlights changed dimensions here.
              </p>
              <button onClick={() => navigate("prompt")}>
                Get the refresh prompt
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>
      )}
      {compare.length > 0 && !detail && !compareOpen && (
        <div className="compare-tray">
          <Layers size={17} />
          <span>{compare.length} specs selected</span>
          <button
            className="primary-button"
            onClick={() => setCompareOpen(true)}
          >
            Compare playstyles
            <ArrowRight size={14} />
          </button>
          <button
            className="icon-button"
            aria-label="Clear comparison"
            onClick={() => setCompare([])}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {detail && BY_SPEC[detail] && (
        <Modal
          key="spec-detail"
          title={BY_SPEC[detail].spec.name}
          eyebrow={BY_SPEC[detail].spec.class}
          onClose={() => setDetail(null)}
        >
          <div className="detail-profiles">
            {["mythic_plus", "raid"].map((type) => (
              <ProfileDetail
                key={`${detail}-${type}`}
                profile={BY_SPEC[detail][type]}
                taste={taste}
                includeSimilar
                onSelectSpec={(id) => {
                  setDetail(id);
                  document.querySelector(".wow-app .detail-modal")?.scrollTo({top: 0});
                }}
              />
            ))}
          </div>
        </Modal>
      )}
      {compareOpen && (
        <Modal
          title="Compare playstyles"
          eyebrow="YOUR SHORTLIST"
          onClose={() => setCompareOpen(false)}
        >
          <div className="compare-content-picker">
            <button
              className={content !== "raid" ? "active" : ""}
              onClick={() => setContent("mythic_plus")}
            >
              Mythic+
            </button>
            <button
              className={content === "raid" ? "active" : ""}
              onClick={() => setContent("raid")}
            >
              Raid
            </button>
          </div>
          <div className="compare-columns">
            {compare.map((id) => (
              <div key={id}>
                <h2>
                  {BY_SPEC[id].spec.name}
                  <small>{BY_SPEC[id].spec.class}</small>
                </h2>
                <ProfileDetail profile={current(id)} taste={taste} />
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
export { data, catalog };
