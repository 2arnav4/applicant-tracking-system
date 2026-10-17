import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-2 py-24 text-center">
      <p className="text-sm font-medium">Page not found</p>
      <Link href="/" className="text-sm text-primary hover:underline">Back to dashboard</Link>
    </div>
  );
}
