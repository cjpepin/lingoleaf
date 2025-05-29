
import LinguaLeafLogo from "./LinguaLeafLogo";
import { Button } from "@/components/ui/button";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const routes = [
  { name: "Library", path: "/library" },
  { name: "Upload", path: "/upload" },
  { name: "Vocab", path: "/vocab" },
  { name: "Study", path: "/study" },
];

const Navbar = ({ authenticated }: { authenticated: boolean }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="w-full px-3 md:px-8 py-3 bg-white shadow z-30">
      <nav className="flex flex-row items-center gap-5 max-w-5xl mx-auto">
        <button
          className="mr-4"
          onClick={() => navigate("/")}
          aria-label="Home"
          tabIndex={0}
        >
          <LinguaLeafLogo size={40} />
        </button>
        <div className="flex-grow flex gap-2">
          {routes.map((r) => (
            <NavLink
              to={r.path}
              className={({ isActive }) =>
                `px-3 py-2 rounded text-base font-medium transition hover:bg-green-50 hover:text-green-700 ${
                  isActive ? "bg-green-100 text-green-900" : "text-gray-700"
                }`
              }
              key={r.path}
            >
              {r.name}
            </NavLink>
          ))}
        </div>
        <div>
          <Button
            variant="secondary"
            onClick={() => navigate(user ? "/account" : "/account")}
            className="ml-2"
          >
            {user ? "Account" : "Sign In"}
          </Button>
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
