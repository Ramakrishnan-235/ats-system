export function RequestError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{message}</p> : null;
}
