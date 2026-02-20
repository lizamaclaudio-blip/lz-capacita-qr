import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <header className="flex items-center justify-between">
          <div className="font-bold text-xl">Prevenidos · Registro QR</div>
          <div className="flex gap-3">
            <Link className="px-4 py-2 rounded border" href="/login">
              Entrar
            </Link>
            <Link className="px-4 py-2 rounded bg-black text-white" href="/signup">
              Crear cuenta
            </Link>
          </div>
        </header>

        <section className="mt-14 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Registra tus charlas con QR, firmas y PDF automático.
            </h1>
            <p className="mt-4 text-gray-600 text-lg">
              Crea empresas, sucursales y cursos. Al finalizar, firmas como relator y la app genera el
              registro listo en PDF.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="px-5 py-3 rounded bg-black text-white" href="/signup">
                Empezar ahora
              </Link>
              <Link className="px-5 py-3 rounded border" href="/login">
                Ya tengo cuenta
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div className="p-4 bg-white rounded border">
                <div className="font-semibold">QR al instante</div>
                <div className="text-gray-600 mt-1">Código único por charla</div>
              </div>
              <div className="p-4 bg-white rounded border">
                <div className="font-semibold">Firma en pantalla</div>
                <div className="text-gray-600 mt-1">Asistentes + relator</div>
              </div>
              <div className="p-4 bg-white rounded border">
                <div className="font-semibold">PDF Pro</div>
                <div className="text-gray-600 mt-1">Listo para enviar</div>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-6 shadow-sm">
            <div className="text-sm text-gray-500">Vista previa</div>
            <div className="mt-3 rounded-xl border p-4">
              <div className="font-semibold">Nueva charla</div>
              <div className="text-gray-600 text-sm mt-1">
                Empresa → QR → Registro → Firma → PDF
              </div>
              <div className="mt-4 h-40 rounded-lg bg-gray-50 border flex items-center justify-center text-gray-400">
                (Aquí después ponemos una imagen / mockup)
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              Funciona perfecto en PC y celular (responsive). Después la dejamos instalable (PWA).
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}