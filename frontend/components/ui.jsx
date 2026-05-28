export function EmptyState({ title, description }) {
  return (
    <div className="border border-dashed border-zinc-300 bg-white px-5 py-8 text-center">
      <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">{description}</p>
    </div>
  );
}

export function FieldLabel({ children }) {
  return <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">{children}</span>;
}

export function TextInput(props) {
  return (
    <input
      {...props}
      className="mt-2 w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
    />
  );
}

export function TextArea(props) {
  return (
    <textarea
      {...props}
      className="mt-2 min-h-28 w-full resize-y border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
    />
  );
}

export function SelectInput(props) {
  return (
    <select
      {...props}
      className="mt-2 w-full border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
    />
  );
}

export function PrimaryButton({ children, disabled, ...props }) {
  return (
    <button
      {...props}
      disabled={disabled}
      className="inline-flex items-center justify-center border border-emerald-700 bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-200 disabled:text-zinc-500"
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, disabled, ...props }) {
  return (
    <button
      {...props}
      disabled={disabled}
      className="inline-flex items-center justify-center border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
    >
      {children}
    </button>
  );
}

export function StatusBanner({ status }) {
  if (!status.message) {
    return null;
  }

  const tone =
    status.type === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className={`border px-4 py-3 text-sm ${tone}`}>
      {status.message}
    </div>
  );
}
