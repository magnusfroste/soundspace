import { motion } from "framer-motion";
import { Music2, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <motion.nav 
      className="fixed top-0 left-0 right-0 z-50 glass"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Music2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">SoundSpace</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </a>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <Button 
              variant="ghost" 
              className="text-sm"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
            <Button 
              className="rounded-full bg-primary hover:bg-primary/90"
              onClick={() => navigate("/auth")}
            >
              Get Started Free
            </Button>
          </div>

          <button 
            className="md:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {isOpen && (
          <motion.div 
            className="md:hidden py-4 border-t border-border/50"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
          >
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pricing
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                About
              </a>
              <Button 
                className="w-full rounded-full bg-primary hover:bg-primary/90 mt-2"
                onClick={() => navigate("/auth")}
              >
                Get Started Free
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
}
