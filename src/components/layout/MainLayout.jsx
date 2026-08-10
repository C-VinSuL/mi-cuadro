import { useState } from "react";

import Sidebar from "./Sidebar/Sidebar";
import Navbar from "./Navbar/Navbar";

const MainLayout = ({ children }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F4F7F5]">

      {/* SIDEBAR DESKTOP */}
      <div className="hidden xl:block">
        <Sidebar />
      </div>

      {/* SIDEBAR MOBILE / TABLET */}
      {menuOpen && (
        <>
          <div
            className="
              fixed
              inset-0
              z-40
              bg-black/40
              xl:hidden
            "
            onClick={() => setMenuOpen(false)}
          />

          <div
            className="
              fixed
              inset-y-0
              left-0
              z-50
              w-[290px]
              max-w-[85vw]
              xl:hidden
            "
          >
            <Sidebar
              mobile
              onClose={() => setMenuOpen(false)}
            />
          </div>
        </>
      )}

      {/* CONTENIDO */}
      <div
        className="
          min-h-screen
          w-full
          xl:pl-[290px]
        "
      >
        <Navbar
          onMenuClick={() => setMenuOpen(true)}
        />

        <main
          className="
            w-full
            px-4
            py-6
            sm:px-6
            md:px-8
            xl:px-10
            2xl:px-12
          "
        >
          <div
            className="
              mx-auto
              w-full
              max-w-[1440px]
            "
          >
            {children}
          </div>
        </main>
      </div>

    </div>
  );
};

export default MainLayout;