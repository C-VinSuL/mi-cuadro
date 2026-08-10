import { Bell, UserCircle2 } from "lucide-react";

const Navbar = () => {

    return (

        <header className="bg-white h-20 shadow-sm flex justify-between items-center px-8">

            <div>

                <h1 className="text-3xl font-bold">

                    Buenos días 👋

                </h1>

                <p className="text-gray-500">

                    Bienvenido a tu caja comunal.

                </p>

            </div>

            <div className="flex items-center gap-6">

                <Bell className="cursor-pointer" />

                <UserCircle2 size={38} />

            </div>

        </header>

    )

}

export default Navbar