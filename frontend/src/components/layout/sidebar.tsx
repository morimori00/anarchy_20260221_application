import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Map, Upload, MessageSquare, Zap, Sun, Moon, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", label: "Map Overview", icon: Map },
  { path: "/upload", label: "Upload Data", icon: Upload },
  { path: "/chat", label: "Chatbot", icon: MessageSquare },
];

interface SidebarProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

export function Sidebar({ theme, onToggleTheme }: SidebarProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/" || location.pathname.startsWith("/buildings");
    return location.pathname.startsWith(path);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 h-14 border-b">
        <Zap className="size-5 text-primary shrink-0" />
        <span className="text-sm font-semibold md:hidden lg:inline">Energy Monitor</span>
      </div>

      <nav className="flex-1 py-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
              isActive(item.path)
                ? "font-semibold text-foreground border-l-2 border-primary"
                : "text-muted-foreground hover:text-foreground border-l-2 border-transparent"
            )}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="md:hidden lg:inline">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t">
        <Button variant="ghost" size="icon" onClick={onToggleTheme} className="w-full md:w-8 lg:w-full justify-center">
          {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          <span className="ml-2 md:hidden lg:inline text-sm">
            {theme === "light" ? "Dark mode" : "Light mode"}
          </span>
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full bg-background border-r z-40 transition-transform",
          "w-60 lg:w-60 md:w-14 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
