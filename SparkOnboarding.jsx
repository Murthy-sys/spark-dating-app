import { useState, useCallback, useMemo } from "react";

/* ───────────────────────────── constants ───────────────────────────── */
const HOBBY_SUGGESTIONS = [
  "Music", "Travel", "Fitness", "Movies", "Reading", "Cooking",
  "Photography", "Gaming", "Hiking", "Dancing", "Yoga", "Art",
  "Sports", "Writing", "Gardening", "Tech", "Fashion", "Meditation",
];

const RELATIONSHIP_OPTIONS = [
  { id: "friendship", label: "Friendship", icon: "🤝", desc: "Looking for meaningful connections" },
  { id: "casual", label: "Casual Dating", icon: "☕", desc: "Fun, low-pressure meetups" },
  { id: "serious", label: "Serious Relationship", icon: "💜", desc: "Ready for something real" },
];

const TOTAL_STEPS = 7;
const ABOUT_MAX = 300;
const ABOUT_MIN = 10;

/* ───────────────────────────── tiny icons ──────────────────────────── */
const ChevronLeft = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
);
const ChevronRight = () => (
  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
);
const CheckIcon = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
);
const SparkIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#a855f7"/><stop offset="100%" stopColor="#ec4899"/></linearGradient></defs>
    <path d="M12 2L9 12l-7 0 5.5 4.5L5 22l7-5 7 5-2.5-5.5L22 12h-7L12 2z"/>
  </svg>
);

/* ───────────────────────────── progress bar ────────────────────────── */
function ProgressBar({ step, total }) {
  const pct = Math.round((step / total) * 100);
  return (
    <div style={{ padding: "0 24px", marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#a1a1aa", fontWeight: 500 }}>Step {step} of {total}</span>
        <span style={{ fontSize: 12, color: "#a1a1aa", fontWeight: 500 }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#27272a", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3, width: `${pct}%`,
          background: "linear-gradient(90deg,#a855f7,#ec4899)",
          transition: "width 0.5s cubic-bezier(.4,0,.2,1)",
        }} />
      </div>
    </div>
  );
}

/* ───────────────────────────── step wrapper ─────────────────────────── */
function StepShell({ title, subtitle, children, onBack, onNext, nextLabel, nextDisabled, step }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", minHeight: "100%",
      animation: "fadeSlide .35s ease", position: "relative",
    }}>
      <div style={{ flex: 1, padding: "0 24px", paddingBottom: 100 }}>
        <h2 style={{
          fontSize: 26, fontWeight: 700, color: "#fafafa",
          marginBottom: 4, lineHeight: 1.25,
        }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 14, color: "#a1a1aa", marginBottom: 24, lineHeight: 1.5 }}>{subtitle}</p>}
        {children}
      </div>

      {/* fixed bottom nav */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: "16px 24px", display: "flex", gap: 12,
        background: "linear-gradient(transparent, #09090b 30%)",
        paddingTop: 40,
      }}>
        {step > 1 && (
          <button onClick={onBack} style={{
            height: 52, width: 52, borderRadius: 16, border: "1px solid #3f3f46",
            background: "#18181b", color: "#d4d4d8", display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
            flexShrink: 0, transition: "background .2s",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#27272a"}
            onMouseLeave={e => e.currentTarget.style.background = "#18181b"}
          ><ChevronLeft /></button>
        )}
        <button onClick={onNext} disabled={nextDisabled} style={{
          flex: 1, height: 52, borderRadius: 16, border: "none",
          background: nextDisabled ? "#27272a" : "linear-gradient(135deg,#a855f7,#ec4899)",
          color: nextDisabled ? "#52525b" : "#fff", fontSize: 16, fontWeight: 600,
          cursor: nextDisabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "all .3s", opacity: nextDisabled ? 0.6 : 1,
          boxShadow: nextDisabled ? "none" : "0 4px 20px rgba(168,85,247,.35)",
        }}>
          {nextLabel || "Continue"}{!nextDisabled && <ChevronRight />}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════ STEP COMPONENTS ════════════════════════════ */

/* ── Step 1 : Gender ──────────────────────────────────────────────── */
function GenderStep({ value, onChange, ...nav }) {
  const options = [
    { id: "male", label: "Male", icon: "👨" },
    { id: "female", label: "Female", icon: "👩" },
  ];
  return (
    <StepShell title="What's your gender?" subtitle="Select the option that best describes you." nextDisabled={!value} {...nav}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {options.map(o => {
          const active = value === o.id;
          return (
            <button key={o.id} onClick={() => onChange(o.id)} style={{
              display: "flex", alignItems: "center", gap: 16,
              padding: "18px 20px", borderRadius: 16, border: active ? "2px solid #a855f7" : "2px solid #27272a",
              background: active ? "rgba(168,85,247,.1)" : "#18181b",
              cursor: "pointer", transition: "all .25s", textAlign: "left",
            }}>
              <span style={{ fontSize: 32 }}>{o.icon}</span>
              <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: active ? "#e9d5ff" : "#d4d4d8" }}>{o.label}</span>
              {active && <span style={{ color: "#a855f7" }}><CheckIcon /></span>}
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}

/* ── Step 2 : About You ──────────────────────────────────────────── */
function AboutStep({ value, onChange, ...nav }) {
  const len = value.length;
  const overLimit = len > ABOUT_MAX;
  const tooShort = len > 0 && len < ABOUT_MIN;
  return (
    <StepShell title="About You" subtitle="Write a short bio so others can get to know you." nextDisabled={len < ABOUT_MIN || overLimit} {...nav}>
      <div style={{ position: "relative" }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="e.g. Coffee lover, weekend hiker, and huge fan of sci-fi movies…"
          rows={5}
          style={{
            width: "100%", boxSizing: "border-box", padding: "16px 18px",
            borderRadius: 16, border: overLimit ? "2px solid #ef4444" : "2px solid #27272a",
            background: "#18181b", color: "#fafafa", fontSize: 15, lineHeight: 1.6,
            resize: "none", outline: "none", fontFamily: "inherit",
            transition: "border .2s",
          }}
          onFocus={e => { if (!overLimit) e.target.style.border = "2px solid #a855f7"; }}
          onBlur={e => { if (!overLimit) e.target.style.border = "2px solid #27272a"; }}
        />
        <span style={{
          position: "absolute", bottom: 12, right: 16, fontSize: 12,
          color: overLimit ? "#ef4444" : len > ABOUT_MAX * 0.85 ? "#f59e0b" : "#71717a",
        }}>{len}/{ABOUT_MAX}</span>
      </div>
      {tooShort && <p style={{ color: "#f59e0b", fontSize: 12, marginTop: 8 }}>At least {ABOUT_MIN} characters please.</p>}
      {overLimit && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>Exceeds the {ABOUT_MAX}-character limit.</p>}
    </StepShell>
  );
}

/* ── Step 3 : Hobbies ─────────────────────────────────────────────── */
function HobbiesStep({ value, onChange, ...nav }) {
  const [custom, setCustom] = useState("");

  const toggle = h => {
    onChange(value.includes(h) ? value.filter(x => x !== h) : [...value, h]);
  };
  const addCustom = () => {
    const t = custom.trim();
    if (t && !value.includes(t)) { onChange([...value, t]); setCustom(""); }
  };

  return (
    <StepShell title="Your Hobbies" subtitle="Pick things you enjoy — they help us find your people." nextDisabled={value.length === 0} {...nav}>
      {/* selected chips */}
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {value.map(h => (
            <span key={h} onClick={() => toggle(h)} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 20,
              background: "linear-gradient(135deg,#a855f7,#ec4899)", color: "#fff",
              fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "transform .15s",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >{h} ✕</span>
          ))}
        </div>
      )}

      {/* custom input */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addCustom()}
          placeholder="Add your own…"
          style={{
            flex: 1, height: 46, borderRadius: 14, padding: "0 16px",
            border: "2px solid #27272a", background: "#18181b",
            color: "#fafafa", fontSize: 14, outline: "none", fontFamily: "inherit",
          }}
          onFocus={e => e.target.style.border = "2px solid #a855f7"}
          onBlur={e => e.target.style.border = "2px solid #27272a"}
        />
        <button onClick={addCustom} disabled={!custom.trim()} style={{
          height: 46, padding: "0 18px", borderRadius: 14, border: "none",
          background: custom.trim() ? "#a855f7" : "#27272a",
          color: custom.trim() ? "#fff" : "#52525b", fontWeight: 600,
          cursor: custom.trim() ? "pointer" : "default", fontSize: 14,
          transition: "all .2s",
        }}>Add</button>
      </div>

      {/* suggestions */}
      <p style={{ fontSize: 12, color: "#71717a", marginBottom: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Suggestions</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {HOBBY_SUGGESTIONS.filter(h => !value.includes(h)).map(h => (
          <span key={h} onClick={() => toggle(h)} style={{
            padding: "8px 16px", borderRadius: 20, border: "1.5px solid #3f3f46",
            background: "#18181b", color: "#a1a1aa", fontSize: 13, fontWeight: 500,
            cursor: "pointer", transition: "all .2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#a855f7"; e.currentTarget.style.color = "#e9d5ff"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#3f3f46"; e.currentTarget.style.color = "#a1a1aa"; }}
          >{h}</span>
        ))}
      </div>
    </StepShell>
  );
}

/* ── Step 4 : Relationship Preferences ────────────────────────────── */
function RelationshipStep({ value, onChange, ...nav }) {
  const toggle = id => {
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  };
  return (
    <StepShell title="What are you looking for?" subtitle="You can pick more than one — no judgement here." nextDisabled={value.length === 0} {...nav}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {RELATIONSHIP_OPTIONS.map(o => {
          const active = value.includes(o.id);
          return (
            <button key={o.id} onClick={() => toggle(o.id)} style={{
              display: "flex", alignItems: "center", gap: 16,
              padding: "18px 20px", borderRadius: 16,
              border: active ? "2px solid #a855f7" : "2px solid #27272a",
              background: active ? "rgba(168,85,247,.1)" : "#18181b",
              cursor: "pointer", transition: "all .25s", textAlign: "left",
            }}>
              <span style={{ fontSize: 28 }}>{o.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: active ? "#e9d5ff" : "#d4d4d8" }}>{o.label}</div>
                <div style={{ fontSize: 13, color: "#71717a", marginTop: 2 }}>{o.desc}</div>
              </div>
              {active && <span style={{ color: "#a855f7" }}><CheckIcon /></span>}
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}

/* ── Step 5 : Conduct ─────────────────────────────────────────────── */
function ConductStep({ value, onChange, ...nav }) {
  return (
    <StepShell title="Community Guidelines" subtitle="We're building a safe space for everyone." nextDisabled={!value} {...nav}>
      <div style={{
        padding: 20, borderRadius: 16, background: "#18181b",
        border: "1.5px solid #27272a", marginBottom: 24,
      }}>
        <p style={{ fontSize: 15, color: "#d4d4d8", lineHeight: 1.7 }}>
          I agree to behave respectfully with other users. Any inappropriate behaviour may lead to <span style={{ color: "#f87171", fontWeight: 600 }}>legal consequences</span>.
        </p>
      </div>
      <label onClick={() => onChange(!value)} style={{
        display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
        padding: "14px 18px", borderRadius: 14,
        background: value ? "rgba(168,85,247,.08)" : "transparent",
        border: value ? "1.5px solid #a855f7" : "1.5px solid #3f3f46",
        transition: "all .25s",
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 8, flexShrink: 0,
          border: value ? "none" : "2px solid #52525b",
          background: value ? "linear-gradient(135deg,#a855f7,#ec4899)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all .25s",
        }}>{value && <CheckIcon />}</span>
        <span style={{ fontSize: 15, color: value ? "#e9d5ff" : "#a1a1aa", fontWeight: 500 }}>I agree to the community guidelines</span>
      </label>
    </StepShell>
  );
}

/* ── Step 6 : Terms ───────────────────────────────────────────────── */
function TermsStep({ value, onChange, ...nav }) {
  return (
    <StepShell title="Terms & Conditions" subtitle="Almost there — one last thing." nextDisabled={!value} {...nav}>
      <div style={{
        padding: 20, borderRadius: 16, background: "#18181b",
        border: "1.5px solid #27272a", marginBottom: 24, maxHeight: 180,
        overflowY: "auto",
      }}>
        <p style={{ fontSize: 14, color: "#a1a1aa", lineHeight: 1.7 }}>
          <strong style={{ color: "#d4d4d8" }}>Spark</strong> is a platform for users to meet and connect. The app is not responsible for user interactions or outcomes arising from those interactions.
          {"\n\n"}By using this app, you acknowledge that all conversations and meetups happen at your own discretion and risk. Spark reserves the right to suspend or terminate accounts that violate community standards.
        </p>
      </div>
      <label onClick={() => onChange(!value)} style={{
        display: "flex", alignItems: "center", gap: 14, cursor: "pointer",
        padding: "14px 18px", borderRadius: 14,
        background: value ? "rgba(168,85,247,.08)" : "transparent",
        border: value ? "1.5px solid #a855f7" : "1.5px solid #3f3f46",
        transition: "all .25s",
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 8, flexShrink: 0,
          border: value ? "none" : "2px solid #52525b",
          background: value ? "linear-gradient(135deg,#a855f7,#ec4899)" : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all .25s",
        }}>{value && <CheckIcon />}</span>
        <span style={{ fontSize: 15, color: value ? "#e9d5ff" : "#a1a1aa", fontWeight: 500 }}>I accept the Terms & Conditions</span>
      </label>
    </StepShell>
  );
}

/* ── Step 7 : Review & Complete ───────────────────────────────────── */
function ReviewStep({ data, onBack, onComplete, step }) {
  const allValid =
    data.gender && data.about.length >= ABOUT_MIN && data.about.length <= ABOUT_MAX &&
    data.hobbies.length > 0 && data.relationship.length > 0 &&
    data.conduct && data.terms;

  const Row = ({ label, val }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 0", borderBottom: "1px solid #1e1e22" }}>
      <span style={{ fontSize: 13, color: "#71717a", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 14, color: "#d4d4d8", fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{val}</span>
    </div>
  );

  return (
    <StepShell title="Review Your Profile" subtitle="Everything looks good? Let's go!" nextLabel="Complete Profile ✨" nextDisabled={!allValid} onNext={onComplete} onBack={onBack} step={step}>
      <div style={{ borderRadius: 16, background: "#18181b", border: "1.5px solid #27272a", padding: "4px 20px", marginBottom: 16 }}>
        <Row label="Gender" val={data.gender === "male" ? "Male" : "Female"} />
        <Row label="About" val={data.about.length > 60 ? data.about.slice(0, 60) + "…" : data.about} />
        <Row label="Hobbies" val={data.hobbies.join(", ")} />
        <Row label="Looking for" val={data.relationship.map(r => RELATIONSHIP_OPTIONS.find(o => o.id === r)?.label).join(", ")} />
        <Row label="Conduct" val={data.conduct ? "Accepted ✓" : "—"} />
        <Row label="Terms" val={data.terms ? "Accepted ✓" : "—"} />
      </div>
    </StepShell>
  );
}

/* ── Success Screen ───────────────────────────────────────────────── */
function SuccessScreen() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100%", textAlign: "center",
      padding: "0 32px", animation: "fadeSlide .5s ease",
    }}>
      <div style={{
        width: 96, height: 96, borderRadius: "50%",
        background: "linear-gradient(135deg,#a855f7,#ec4899)",
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 28, boxShadow: "0 0 60px rgba(168,85,247,.4)",
      }}>
        <svg width="44" height="44" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
      <h2 style={{ fontSize: 28, fontWeight: 700, color: "#fafafa", marginBottom: 8 }}>You're all set!</h2>
      <p style={{ fontSize: 15, color: "#a1a1aa", lineHeight: 1.6, maxWidth: 280 }}>
        Your profile is complete. Start exploring Spark and find your people.
      </p>
    </div>
  );
}

/* ════════════════════════ MAIN COMPONENT ═════════════════════════════ */
export default function SparkOnboarding() {
  const [step, setStep] = useState(1);
  const [complete, setComplete] = useState(false);
  const [data, setData] = useState({
    gender: "",
    about: "",
    hobbies: [],
    relationship: [],
    conduct: false,
    terms: false,
  });

  const set = useCallback((key) => (val) => setData(prev => ({ ...prev, [key]: val })), []);
  const next = useCallback(() => setStep(s => Math.min(s + 1, TOTAL_STEPS)), []);
  const back = useCallback(() => setStep(s => Math.max(s - 1, 1)), []);
  const finish = useCallback(() => setComplete(true), []);

  const stepProps = useMemo(() => ({ onNext: next, onBack: back, step }), [next, back, step]);

  return (
    <div style={{
      maxWidth: 430, margin: "0 auto", minHeight: "100vh",
      background: "#09090b", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      display: "flex", flexDirection: "column", position: "relative",
      overflow: "hidden",
    }}>
      {/* keyframes */}
      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 4px; }
      `}</style>

      {!complete ? (
        <>
          {/* header */}
          <div style={{ padding: "20px 24px 12px", display: "flex", alignItems: "center", gap: 10 }}>
            <SparkIcon />
            <span style={{
              fontSize: 20, fontWeight: 700,
              background: "linear-gradient(135deg,#a855f7,#ec4899)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Spark</span>
          </div>

          <ProgressBar step={step} total={TOTAL_STEPS} />

          {/* step content */}
          <div key={step} style={{ flex: 1, display: "flex", flexDirection: "column", paddingTop: 16 }}>
            {step === 1 && <GenderStep value={data.gender} onChange={set("gender")} {...stepProps} />}
            {step === 2 && <AboutStep value={data.about} onChange={set("about")} {...stepProps} />}
            {step === 3 && <HobbiesStep value={data.hobbies} onChange={set("hobbies")} {...stepProps} />}
            {step === 4 && <RelationshipStep value={data.relationship} onChange={set("relationship")} {...stepProps} />}
            {step === 5 && <ConductStep value={data.conduct} onChange={set("conduct")} {...stepProps} />}
            {step === 6 && <TermsStep value={data.terms} onChange={set("terms")} {...stepProps} />}
            {step === 7 && <ReviewStep data={data} onBack={back} onComplete={finish} step={step} />}
          </div>
        </>
      ) : (
        <SuccessScreen />
      )}
    </div>
  );
}