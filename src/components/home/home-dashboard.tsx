"use client";

export function HomeDashboard() {
  return (
    <main className="relative h-screen overflow-hidden bg-white">
      <section
        className="absolute left-[423px] top-[44px] h-[calc(100vh-88px)] w-[calc(100vw-482px)] overflow-hidden rounded-[8px] border-2 border-[#2f2c29] bg-white"
        data-testid="home-canva-embed"
      >
        <iframe
          loading="lazy"
          src="https://www.canva.com/design/DAHLtmjETh8/0gA7bgACImzn_-degy5DIg/view?embed"
          allow="fullscreen"
          allowFullScreen
          title="Duodode Agency Canva embed"
          className="block h-full w-full border-0"
        />
      </section>
    </main>
  );
}
