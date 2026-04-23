import type { CSSProperties, ReactNode } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type DeploymentModel = "local" | "selfHosted" | "managed" | "hybrid";

type DeploymentModelDiagramProps = {
  model: DeploymentModel;
};

const colors = {
  bg: "#070A12",
  panel: "#0E1422",
  panel2: "#111827",
  border: "rgba(148, 163, 184, 0.28)",
  borderStrong: "rgba(74, 222, 128, 0.72)",
  text: "#E5E7EB",
  muted: "#94A3B8",
  green: "#4ADE80",
  blue: "#38BDF8",
  cyan: "#22D3EE",
  amber: "#FBBF24",
  violet: "#A78BFA",
  red: "#FB7185",
};

const copy = {
  local: {
    eyebrow: "Local single server",
    title: "One Dagu process on one machine",
    description:
      "Web UI, scheduler, execution, and file-backed state stay on the same host.",
  },
  selfHosted: {
    eyebrow: "Self-hosted",
    title: "Server components share one Dagu persistent volume",
    description:
      "Coordinator, scheduler, queue, logs, and run state use the same Dagu storage.",
  },
  managed: {
    eyebrow: "Dagu Cloud managed server",
    title: "A full managed Dagu server, not only a coordinator",
    description:
      "Managed server, runtime, and storage run in an isolated gVisor instance on GKE.",
  },
  hybrid: {
    eyebrow: "Hybrid execution",
    title: "Managed server, hybrid workers in your infrastructure",
    description:
      "Dagu Cloud operates the server; hybrid workers run Docker and private-network steps.",
  },
} satisfies Record<DeploymentModel, { eyebrow: string; title: string; description: string }>;

const baseStyle: CSSProperties = {
  background: colors.bg,
  color: colors.text,
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  overflow: "hidden",
};

const gridStyle: CSSProperties = {
  backgroundImage:
    "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
  backgroundSize: "32px 32px",
  opacity: 0.7,
};

const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

const useLoop = (offset = 0) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return ((frame + offset) % (3 * fps)) / (3 * fps);
};

const Header = ({ model }: { model: DeploymentModel }) => {
  const c = copy[model];
  return (
    <div style={{ position: "absolute", left: 48, top: 34, right: 48 }}>
      <div
        style={{
          color: colors.green,
          fontSize: 17,
          fontWeight: 900,
          letterSpacing: 1.8,
          textTransform: "uppercase",
        }}
      >
        {c.eyebrow}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 36,
          lineHeight: 1.08,
          fontWeight: 900,
          letterSpacing: 0,
        }}
      >
        {c.title}
      </div>
      <div
        style={{
          marginTop: 12,
          maxWidth: 780,
          color: colors.muted,
          fontSize: 19,
          lineHeight: 1.35,
          fontWeight: 600,
        }}
      >
        {c.description}
      </div>
    </div>
  );
};

const Panel = ({
  x,
  y,
  w,
  h,
  title,
  children,
  accent = colors.blue,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  children: ReactNode;
  accent?: string;
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      borderRadius: 8,
      border: `1px solid ${colors.border}`,
      background:
        "linear-gradient(180deg, rgba(17,24,39,0.95), rgba(7,10,18,0.98))",
      boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        height: 48,
        borderBottom: `1px solid ${colors.border}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 18px",
        color: colors.text,
        fontSize: 15,
        fontWeight: 900,
        letterSpacing: 1,
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 10,
          background: accent,
          boxShadow: `0 0 20px ${accent}`,
        }}
      />
      {title}
    </div>
    {children}
  </div>
);

const Node = ({
  x,
  y,
  w,
  h,
  title,
  detail,
  color = colors.green,
  icon,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  detail?: string;
  color?: string;
  icon?: ReactNode;
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      borderRadius: 8,
      border: `1.5px solid ${color}`,
      background: `linear-gradient(180deg, ${color}22, rgba(15,23,42,0.96))`,
      boxShadow: `0 0 34px ${color}20`,
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "0 18px",
    }}
  >
    {icon ? <div style={{ color, flex: "0 0 auto" }}>{icon}</div> : null}
    <div>
      <div style={{ fontSize: 18, fontWeight: 900, color: colors.text }}>{title}</div>
      {detail ? (
        <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: colors.muted, lineHeight: 1.25 }}>
          {detail}
        </div>
      ) : null}
    </div>
  </div>
);

const Mini = ({
  x,
  y,
  text,
  color = colors.muted,
}: {
  x: number;
  y: number;
  text: string;
  color?: string;
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      padding: "8px 12px",
      borderRadius: 8,
      border: `1px solid ${colors.border}`,
      background: "rgba(15,23,42,0.86)",
      color,
      fontSize: 13,
      fontWeight: 850,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

const Flow = ({
  from,
  to,
  color = colors.green,
  label,
  labelX,
  labelY,
  offset = 0,
}: {
  from: [number, number];
  to: [number, number];
  color?: string;
  label?: string;
  labelX?: number;
  labelY?: number;
  offset?: number;
}) => {
  const p = useLoop(offset);
  const eased = interpolate(p, [0, 0.88, 1], [0, 1, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const x = from[0] + (to[0] - from[0]) * eased;
  const y = from[1] + (to[1] - from[1]) * eased;

  return (
    <>
      <svg width="960" height="540" viewBox="0 0 960 540" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker
            id={`arrow-${color.replace("#", "")}-${offset}`}
            markerWidth="10"
            markerHeight="10"
            refX="7"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L8,3 z" fill={color} />
          </marker>
        </defs>
        <line
          x1={from[0]}
          y1={from[1]}
          x2={to[0]}
          y2={to[1]}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray="8 10"
          opacity={0.58}
          markerEnd={`url(#arrow-${color.replace("#", "")}-${offset})`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: x - 8,
          top: y - 8,
          width: 16,
          height: 16,
          borderRadius: 16,
          background: color,
          boxShadow: `0 0 24px ${color}`,
          opacity: p > 0.9 ? interpolate(p, [0.9, 1], [1, 0], clamp) : 1,
        }}
      />
      {label ? (
        <div
          style={{
            position: "absolute",
            left: labelX ?? (from[0] + to[0]) / 2 - 50,
            top: labelY ?? (from[1] + to[1]) / 2 - 18,
            padding: "7px 10px",
            borderRadius: 10,
            background: "rgba(7,10,18,0.82)",
            border: `1px solid ${colors.border}`,
            color: colors.text,
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          {label}
        </div>
      ) : null}
    </>
  );
};

const StorageIcon = () => (
  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
    <ellipse cx="19" cy="9" rx="12" ry="5" stroke="currentColor" strokeWidth="2.4" />
    <path d="M7 9v20c0 2.8 5.4 5 12 5s12-2.2 12-5V9" stroke="currentColor" strokeWidth="2.4" />
    <path d="M7 19c0 2.8 5.4 5 12 5s12-2.2 12-5" stroke="currentColor" strokeWidth="2.4" />
  </svg>
);

const ServerIcon = () => (
  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
    <rect x="6" y="8" width="26" height="8" rx="2" stroke="currentColor" strokeWidth="2.4" />
    <rect x="6" y="22" width="26" height="8" rx="2" stroke="currentColor" strokeWidth="2.4" />
    <circle cx="11" cy="12" r="1.5" fill="currentColor" />
    <circle cx="11" cy="26" r="1.5" fill="currentColor" />
    <path d="M17 12h9M17 26h9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const WorkerIcon = () => (
  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
    <rect x="12" y="12" width="14" height="14" rx="4" stroke="currentColor" strokeWidth="2.4" />
    <path d="M19 5v7M19 26v7M5 19h7M26 19h7M16 19h6M19 16v6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const CloudIcon = () => (
  <svg width="42" height="38" viewBox="0 0 42 38" fill="none">
    <path d="M15 29h15a8 8 0 0 0 0-16 12 12 0 0 0-23 5 6 6 0 0 0 8 11z" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Local = () => (
  <>
    <Panel x={48} y={202} w={864} h={260} title="Single host" accent={colors.green}>
      <Node x={46} y={92} w={250} h={86} title="Dagu server" detail="UI / API, scheduler, executor" color={colors.green} icon={<ServerIcon />} />
      <Node x={560} y={92} w={234} h={86} title="Persistent volume" detail="Local files: state, logs, queue" color={colors.blue} icon={<StorageIcon />} />
      <Node x={304} y={160} w={250} h={70} title="Workflow steps" detail="Commands, scripts, containers" color={colors.amber} icon={<WorkerIcon />} />
    </Panel>
    <Flow from={[344, 337]} to={[608, 337]} color={colors.green} label="state + logs" labelX={430} labelY={312} />
    <Flow from={[300, 380]} to={[352, 397]} color={colors.amber} offset={18} />
  </>
);

const SelfHosted = () => (
  <>
    <Panel x={48} y={190} w={864} h={292} title="Your infrastructure" accent={colors.blue}>
      <Node x={42} y={82} w={244} h={72} title="Web UI / API" detail="Users and automation" color={colors.green} icon={<ServerIcon />} />
      <Node x={42} y={166} w={244} h={72} title="Scheduler / queue" detail="Run selection and limits" color={colors.cyan} icon={<ServerIcon />} />
      <Node x={342} y={124} w={220} h={72} title="Coordinator" detail="Worker dispatch" color={colors.violet} icon={<ServerIcon />} />
      <Node x={610} y={124} w={210} h={72} title="Persistent volume" detail="Same Dagu storage" color={colors.blue} icon={<StorageIcon />} />
      <Node x={342} y={224} w={202} h={52} title="Worker A" color={colors.amber} icon={<WorkerIcon />} />
      <Node x={568} y={224} w={202} h={52} title="Worker B" color={colors.amber} icon={<WorkerIcon />} />
    </Panel>
    <Flow from={[332, 310]} to={[662, 310]} color={colors.green} label="same persistent volume" labelX={440} labelY={280} />
    <Flow from={[330, 394]} to={[392, 394]} color={colors.cyan} offset={12} />
    <Flow from={[608, 394]} to={[662, 394]} color={colors.violet} offset={24} />
    <Flow from={[480, 386]} to={[448, 440]} color={colors.amber} offset={30} />
    <Flow from={[520, 386]} to={[670, 440]} color={colors.amber} offset={42} />
  </>
);

const Managed = () => (
  <>
    <Panel x={48} y={190} w={864} h={292} title="Dagu Cloud managed server" accent={colors.green}>
      <Node x={42} y={86} w={262} h={78} title="Managed Dagu server" detail="UI / API, scheduler, coordinator" color={colors.green} icon={<CloudIcon />} />
      <Node x={610} y={86} w={210} h={78} title="Managed storage" detail="Dagu persistent volume" color={colors.blue} icon={<StorageIcon />} />
      <Node x={338} y={176} w={258} h={78} title="Managed runtime" detail="Dedicated GKE + gVisor instance" color={colors.violet} icon={<ServerIcon />} />
      <Mini x={102} y={228} text="Managed license included" color={colors.green} />
      <Mini x={620} y={228} text="No Docker socket exposed" color={colors.red} />
    </Panel>
    <Flow from={[352, 316]} to={[658, 316]} color={colors.green} label="state + run history" labelX={450} labelY={288} />
    <Flow from={[305, 366]} to={[390, 404]} color={colors.violet} offset={18} />
    <Flow from={[596, 404]} to={[664, 360]} color={colors.blue} offset={36} />
  </>
);

const Hybrid = () => (
  <>
    <Panel x={48} y={190} w={864} h={292} title="Managed server + hybrid execution" accent={colors.violet}>
      <Node x={42} y={96} w={270} h={86} title="Dagu Cloud server" detail="UI / API, scheduler, coordinator" color={colors.green} icon={<CloudIcon />} />
      <Node x={42} y={200} w={270} h={58} title="Managed storage" detail="Run history and state" color={colors.blue} icon={<StorageIcon />} />
      <Node x={568} y={96} w={254} h={86} title="Hybrid worker" detail="Runs in your infrastructure" color={colors.violet} icon={<WorkerIcon />} />
      <Mini x={578} y={204} text="Docker steps" color={colors.amber} />
      <Mini x={578} y={246} text="Private APIs" color={colors.cyan} />
      <Mini x={716} y={246} text="Data-local work" color={colors.green} />
    </Panel>
    <Flow from={[356, 330]} to={[612, 330]} color={colors.violet} label="mTLS worker connection" labelX={414} labelY={296} />
    <Flow from={[180, 372]} to={[180, 398]} color={colors.blue} offset={14} />
    <Flow from={[700, 378]} to={[700, 428]} color={colors.amber} offset={32} />
  </>
);

export const DeploymentModelDiagram = ({ model }: DeploymentModelDiagramProps) => {
  return (
    <AbsoluteFill style={baseStyle}>
      <AbsoluteFill style={gridStyle} />
      <Header model={model} />
      {model === "local" ? <Local /> : null}
      {model === "selfHosted" ? <SelfHosted /> : null}
      {model === "managed" ? <Managed /> : null}
      {model === "hybrid" ? <Hybrid /> : null}
    </AbsoluteFill>
  );
};
