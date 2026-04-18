import Image from "next/image";
import Link from "next/link";

const BRAND_BLUE = "#1F2B44";
const LOGO_URL = "https://cdn.prod.website-files.com/67ee6c6b271e5a2294abc43e/6814932c8fdab74d7cd6845d_Group%201577708998.webp";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans">
      <main className="flex max-w-2xl flex-col items-center gap-8 px-8 text-center">
        <Image
          src={LOGO_URL}
          alt="Perfect Union"
          width={180}
          height={50}
          className="h-14 w-auto object-contain"
          unoptimized
        />
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Product Sync Admin
        </h1>
        <p className="text-lg text-zinc-600">
          Sync products from Treez to Opticon ESL labels. Manage inventory and product data.
        </p>
        <div className="flex gap-4">
          <Link
            href="/admin/middleware"
            className="rounded-lg px-6 py-3 text-base font-medium text-white transition hover:opacity-90"
            style={{ backgroundColor: BRAND_BLUE }}
          >
            Open Dashboard
          </Link>
          <Link
            href="/knowledge-base"
            className="rounded-lg px-6 py-3 text-base font-medium border-2 transition hover:bg-zinc-100"
            style={{ borderColor: BRAND_BLUE, color: BRAND_BLUE }}
          >
            How it Works?
          </Link>
        </div>
      </main>
    </div>
  );
}
