import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 text-primary text-2xl font-bold">
        404
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Halaman Tidak Ditemukan</h1>
      <p className="text-muted-foreground text-sm max-w-sm mb-6">
        Halaman yang Anda tuju tidak tersedia atau telah dipindahkan.
      </p>
      <Link href="/overview">
        <Button className="rounded-xl">Kembali ke Dashboard</Button>
      </Link>
    </div>
  );
}
