export default function GreenBackground() {
  return (
    <div className="fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-900 to-black" />
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="absolute top-32 -right-24 h-72 w-72 rounded-full bg-lime-300/15 blur-3xl" />
      <div className="absolute bottom-[-120px] left-1/3 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
    </div>
  );
}