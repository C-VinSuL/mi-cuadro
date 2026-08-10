import Sidebar from "./Sidebar/Sidebar";
import Navbar from "./Navbar/Navbar";

const MainLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-slate-50">

      <Sidebar />

      <div className="flex-1 min-w-0">

        <Navbar />

        <main className="p-6 md:p-8 lg:p-10">
          {children}
        </main>

      </div>

    </div>
  );
};

export default MainLayout;