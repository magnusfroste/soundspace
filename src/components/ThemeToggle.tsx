import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useCallback } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleToggle = useCallback(() => {
    document.documentElement.classList.add("theme-transition");
    setTheme(theme === "dark" ? "light" : "dark");
    setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 350);
  }, [theme, setTheme]);

  if (!mounted) return <div className="h-7 w-7" />;

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 rounded-lg"
      onClick={handleToggle}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun className="h-3.5 w-3.5 text-muted-foreground" />
      ) : (
        <Moon className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </Button>
  );
}
