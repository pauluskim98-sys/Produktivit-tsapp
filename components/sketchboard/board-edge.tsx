"use client";
import { useLayoutEffect, useRef } from "react";
import {
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  type EdgeProps,
} from "@xyflow/react";
import type { LineLabel } from "@/lib/sketchboard";

export function BoardEdge(props: EdgeProps) {
  const { id, style, markerEnd, markerStart } = props;
  const data = props.data as
    | {
        route?: string;
        caption?: LineLabel;
        anchor?: (id: string, x: number, y: number) => void;
        connectTo?: (id: string) => void;
      }
    | undefined;
  const [path, x, y] =
    data?.route === "straight"
      ? getStraightPath(props)
      : data?.route === "step" || data?.route === "smoothstep"
        ? getSmoothStepPath({
            ...props,
            borderRadius: data.route === "step" ? 0 : 8,
          })
        : getBezierPath(props);
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
  const rotated = Boolean(caption?.text && angle);
  return (
    <>
      <defs>
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
        className="react-flow__edge-path"
        d={path}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
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
