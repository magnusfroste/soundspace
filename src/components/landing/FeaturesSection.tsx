import { motion } from "framer-motion";
import { 
  Sparkles, 
  Calendar, 
  Music2, 
  Shield, 
  Zap, 
  BarChart3 
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "AI Music Curation",
    description: "Playlists created by AI that understands the mood of your business.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description: "Schedule different playlists for each moment of the day automatically.",
  },
  {
    icon: Music2,
    title: "Curated Library",
    description: "Thousands of licensed tracks, perfect for commercial environments.",
  },
  {
    icon: Shield,
    title: "100% Licensed",
    description: "No copyright worries. Everything fully cleared and legal.",
  },
  {
    icon: Zap,
    title: "Easy to Use",
    description: "Set up in minutes. No complex equipment or installations needed.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Understand which music works best for your audience.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { 
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="container mx-auto px-6 relative z-10">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        >
          <motion.h2 
            className="text-4xl md:text-5xl font-bold mb-4"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.1 }}
          >
            Everything you need
          </motion.h2>
          <motion.p 
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.2 }}
          >
            A complete platform to manage the music in your venue
          </motion.p>
        </motion.div>

        <motion.div 
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="group p-6 rounded-2xl glass glass-hover cursor-default"
              whileHover={{ y: -8, transition: { type: "spring", stiffness: 300 } }}
            >
              <motion.div 
                className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors"
                whileHover={{ rotate: 5, scale: 1.1 }}
              >
                <feature.icon className="h-6 w-6 text-primary" />
              </motion.div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
