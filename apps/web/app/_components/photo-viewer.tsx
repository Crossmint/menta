"use client";

import { useEffect, useRef, useState } from "react";
import { Chevron, Close } from "./icons";

/** Which photos to show full size, and which one first. */
export type Viewing = { urls: readonly string[]; index: number };

const control =
  "tap inline-flex size-11 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/15 backdrop-blur-md transition-colors hover:bg-white/22 disabled:pointer-events-none disabled:opacity-0";

/**
 * Photos at full size over a blurred page, one at a time. Arrows (or the
 * arrow keys) move between photos sent together; Escape, the close button or
 * a click anywhere but the photo closes it.
 */
export function PhotoViewer({
  viewing,
  onClose,
}: {
  viewing: Viewing;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(viewing.index);
  const { urls } = viewing;
  const many = urls.length > 1;
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const go = (step: number) =>
    setIndex((current) =>
      Math.min(urls.length - 1, Math.max(0, current + step)),
    );

  return (
    <dialog
      ref={ref}
      aria-label={many ? `Photo ${index + 1} of ${urls.length}` : "Photo"}
      onClose={onClose}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (!target.closest("img, [data-nav]")) {
          ref.current?.close();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          go(-1);
        } else if (event.key === "ArrowRight") {
          go(1);
        }
      }}
      className="m-0 h-dvh max-h-none w-dvw max-w-none overflow-hidden bg-transparent p-0 text-white outline-none backdrop:animate-[fade-in_200ms_ease-out] backdrop:bg-neutral-950/75 backdrop:backdrop-blur-xl"
    >
      <div className="flex size-full items-center justify-center px-4 pt-20 pb-24 sm:px-24 sm:py-16">
        {/* biome-ignore lint/performance/noImgElement: a data: URL from the message */}
        <img
          key={index}
          src={urls[index]}
          alt=""
          className="max-h-full max-w-full animate-[photo-in_220ms_cubic-bezier(0.2,0.8,0.2,1)] rounded-2xl object-contain shadow-[0_24px_80px_-12px_rgb(0_0_0/0.6)] ring-1 ring-white/10 motion-reduce:animate-none"
        />
      </div>
      <button
        type="button"
        aria-label="Close photo"
        className={`${control} absolute top-4 right-4`}
      >
        <Close width={18} height={18} />
      </button>
      {many ? (
        <>
          <button
            type="button"
            data-nav
            aria-label="Previous photo"
            disabled={index === 0}
            onClick={() => go(-1)}
            className={`${control} absolute bottom-6 left-4 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2`}
          >
            <Chevron width={18} height={18} className="rotate-180" />
          </button>
          <button
            type="button"
            data-nav
            aria-label="Next photo"
            disabled={index === urls.length - 1}
            onClick={() => go(1)}
            className={`${control} absolute right-4 bottom-6 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2`}
          >
            <Chevron width={18} height={18} />
          </button>
          <div
            aria-hidden="true"
            data-nav
            className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/12 px-3 py-2 ring-1 ring-white/15 backdrop-blur-md"
          >
            {urls.map((_, dot) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: one dot per position
                key={dot}
                className={`size-1.5 rounded-full transition-all duration-200 ${dot === index ? "w-4 bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </dialog>
  );
}
