type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const frameParams = new URLSearchParams();

  for (const key of ["checkout", "session_id"]) {
    const value = params?.[key];
    if (typeof value === "string") frameParams.set(key, value);
  }

  const frameSrc =
    frameParams.size > 0
      ? `/demo/index.html?${frameParams.toString()}`
      : "/demo/index.html";

  return (
    <main className="store-shell">
      <iframe
        className="store-frame"
        src={frameSrc}
        title="BLADERS X Member Utility Store"
      />
    </main>
  );
}
