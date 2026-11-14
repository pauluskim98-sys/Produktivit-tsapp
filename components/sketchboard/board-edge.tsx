"use client";
import { useLayoutEffect, useRef } from "react";
import {
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  Position,
  type EdgeProps,
} from "@xyflow/react";
import { connectionWeight, type LineLabel } from "@/lib/sketchboard";

type EdgePoints = Parameters<typeof getBezierPath>[0];

export function boardEdgePath(
  route: string | undefined,
  points: EdgePoints,
  options: {
    sourceRotation?: number;
    targetRotation?: number;
    size?: number;
  } = {},
) {
  const { sourceRotation, targetRotation, size = 0 } = options;
  const endpoint = (
    x: number,
    y: number,
    side: Position,
    rotation?: number,
  ) => {
    if (rotation === undefined) return { x, y, tipX: x, tipY: y };
    const angle =
      (({
        [Position.Right]: 0,
        [Position.Bottom]: 90,
        [Position.Left]: 180,
        [Position.Top]: 270,
      }[side] +
        rotation) *
        Math.PI) /
      180;
    const dx = Math.cos(angle),
      dy = Math.sin(angle);
    const tipGap = Math.max(1, size * 0.17);
    const stub = Math.max(12, size * 0.84);
    return {
      x: x + dx * (stub + tipGap),
      y: y + dy * (stub + tipGap),
      tipX: x + dx * tipGap,
      tipY: y + dy * tipGap,
    };
  };
  const source = endpoint(
    points.sourceX,
    points.sourceY,
    points.sourcePosition ?? Position.Right,
    sourceRotation,
  );
  const target = endpoint(
    points.targetX,
    points.targetY,
    points.targetPosition ?? Position.Left,
    targetRotation,
  );
  const inner = {
    ...points,
    sourceX: source.x,
    sourceY: source.y,
    targetX: target.x,
    targetY: target.y,
  };
  const result =
    route === "straight"
      ? getStraightPath(inner)
      : route === "step" || route === "smoothstep"
        ? getSmoothStepPath({
            ...inner,
            borderRadius: route === "step" ? 0 : 8,
          })
        : getBezierPath(inner);
  if (sourceRotation !== undefined)
    result[0] =
      `M${source.tipX},${source.tipY} L${source.x},${source.y} ` +
      result[0].replace(/^M\s*[-+\d.e]+[ ,]+[-+\d.e]+\s*/i, "");
  if (targetRotation !== undefined)
    result[0] += ` L${target.tipX},${target.tipY}`;
  return result;
}

export function BoardEdge(props: EdgeProps) {
  const { id, style, markerEnd, markerStart } = props;
  const data = props.data as
    | {
        route?: string;
        sourceRotation?: number;
        targetRotation?: number;
        sourcePoint?: { x: number; y: number };
        targetPoint?: { x: number; y: number };
        thread?: boolean;
        caption?: LineLabel;
        anchor?: (id: string, x: number, y: number) => void;
        connectTo?: (id: string) => void;
        startLink?: (id: string) => void;
      }
    | undefined;
  const weight = Number(style?.strokeWidth ?? 9) * connectionWeight;
  const [path, x, y] = boardEdgePath(
    data?.route,
    {
      ...props,
      ...(data?.sourcePoint
        ? { sourceX: data.sourcePoint.x, sourceY: data.sourcePoint.y }
        : {}),
      ...(data?.targetPoint
        ? { targetX: data.targetPoint.x, targetY: data.targetPoint.y }
        : {}),
    },
    {
      sourceRotation: data?.sourceRotation,
      targetRotation: data?.targetRotation,
      size: weight,
    },
  );
  const line = useRef<SVGPathElement>(null);
  useLayoutEffect(() => {
    const middle = line.current?.getPointAtLength(
      line.current.getTotalLength() / 2,
    );
    data?.anchor?.(id, middle?.x ?? x, middle?.y ?? y);
  }, [path, id, x, y, data?.anchor]);
  const caption = data?.caption;
  const size = caption?.size ?? 12;
  const angle = caption?.angle ?? 0;
  const width = (caption?.text.length ?? 0) * size * 0.62 + 10;
  const route = "lm-route-" + id;
  const mask = "lm-mask-" + id;
  const arrow = "lm-arrow-" + id;
  const rotated = Boolean(caption?.text && angle);
  return (
    <>
      <defs>
        {(markerStart || markerEnd) && (
          <marker
            id={arrow}
            viewBox="-10 -10 20 20"
            markerWidth={Math.max(26, weight * 2.15)}
            markerHeight={Math.max(26, weight * 2.15)}
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path
              d="M-7 -5L0 0 -7 5Z"
              fill={String(style?.stroke ?? "#8b8797")}
            />
          </marker>
        )}
        <path id={route} ref={line} d={path} />
        {rotated && (
          <mask
            id={mask}
            maskUnits="userSpaceOnUse"
            x="-10000000"
            y="-10000000"
            width="20000000"
            height="20000000"
          >
            <rect
              x="-10000000"
              y="-10000000"
              width="20000000"
              height="20000000"
              fill="white"
            />
            <rect
              x={x - width / 2}
              y={y - size / 2 - 3}
              width={width}
              height={size + 6}
              rx={2}
              transform={`rotate(${angle} ${x} ${y})`}
              fill="black"
            />
          </mask>
        )}
      </defs>
      <path
        className={"react-flow__edge-path" + (data?.thread ? " lm-thread" : "")}
        d={path}
        style={
          {
            ...style,
            strokeWidth: weight,
            "--lm-edge-width": weight + "px",
            ...(data?.thread ? { strokeLinecap: "round" } : {}),
          } as React.CSSProperties
        }
        markerEnd={markerEnd ? "url(#" + arrow + ")" : undefined}
        markerStart={markerStart ? "url(#" + arrow + ")" : undefined}
        mask={rotated ? `url(#${mask})` : undefined}
      />
      <path
        className="react-flow__edge-interaction"
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        pointerEvents="stroke"
        onClick={
          data?.connectTo
            ? (event) => {
                event.stopPropagation();
                data.connectTo!("line:" + id);
              }
            : undefined
        }
      />
      {data?.startLink && (
        <g
          className="lm-edge-link"
          transform={`translate(${x} ${y - 13})`}
          role="button"
          aria-label="Verbindung an Linie beginnen"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            data.startLink!("line:" + id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              data.startLink!("line:" + id);
            }
          }}
        >
          <rect x="-11" y="-9" width="22" height="18" rx="6" />
          <path
            d="M-5 3L0 -3L5 3M-6 3h2M-1-3h2M4 3h2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
          />
        </g>
      )}
      {caption?.text && (
        <g
          className="lm-edge-caption"
          onClick={
            data?.connectTo
              ? (event) => {
                  event.stopPropagation();
                  data.connectTo!("line:" + id);
                }
              : undefined
          }
          opacity={style?.opacity}
          transform={angle ? `rotate(${angle} ${x} ${y})` : undefined}
        >
          {angle !== 0 && caption.background !== "transparent" && (
            <rect
              x={x - width / 2}
              y={y - size / 2 - 3}
              width={width}
              height={size + 6}
              rx={3}
              fill={caption.background}
            />
          )}
          <text
            fill={caption.color}
            fontSize={size}
            fontFamily={caption.font === "System" ? undefined : caption.font}
            fontWeight={caption.bold ? "bold" : "normal"}
            fontStyle={caption.italic ? "italic" : "normal"}
            style={{
              textDecorationLine: caption.underlineStyle
                ? "underline"
                : undefined,
              textDecorationStyle: caption.underlineStyle,
            }}
            textAnchor="middle"
            x={angle ? x : undefined}
            y={angle ? y : undefined}
            dominantBaseline={angle ? "central" : undefined}
            dy={angle ? undefined : -4}
            stroke={angle ? undefined : caption.background}
            strokeWidth={angle ? undefined : 4}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {angle ? (
              caption.text
            ) : (
              <textPath href={"#" + route} startOffset="50%">
                {caption.text}
              </textPath>
            )}
          </text>
        </g>
      )}
    </>
  );
}
