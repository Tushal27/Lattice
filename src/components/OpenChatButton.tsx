"use client";

// Opens the floating chat (optionally in a given mode) from anywhere.
export function OpenChatButton({
  mode = "wonder",
  className,
  children,
}: {
  mode?: "wonder" | "capture";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("lattice:open-chat", { detail: { mode } }))}
      className={className}
    >
      {children}
    </button>
  );
}
