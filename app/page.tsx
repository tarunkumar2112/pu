import Image from "next/image";

const LOGO_URL = "https://cdn.prod.website-files.com/67ee6c6b271e5a2294abc43e/6814932c8fdab74d7cd6845d_Group%201577708998.webp";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 font-sans">
      <main className="flex flex-col items-center px-8">
        <Image
          src={LOGO_URL}
          alt="Perfect Union"
          width={180}
          height={50}
          className="h-14 w-auto object-contain"
          unoptimized
        />
      </main>
    </div>
  );
}
