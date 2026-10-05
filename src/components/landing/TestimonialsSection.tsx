import { motion } from "framer-motion";
import { Coffee, Dumbbell, UtensilsCrossed } from "lucide-react";

const useCases = [
  {
    icon: Coffee,
    title: "Cafés",
    description: "Calm acoustic mornings, upbeat afternoons — the playlist follows the rhythm of your day.",
  },
  {
    icon: UtensilsCrossed,
    title: "Restaurants",
    description: "Set a mood for lunch, dinner and late evening once, and let the schedule switch automatically.",
  },
  {
    icon: Dumbbell,
    title: "Gyms & studios",
    description: "High-energy music for classes and open hours, with the same sound across every location.",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent" />
      
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
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.1 }}
          >
            Built for spaces like yours
          </motion.h2>
          <motion.p 
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.2 }}
          >
            From the morning coffee rush to happy hour — music that fits every moment
          </motion.p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {useCases.map((useCase, i) => (
            <motion.div
              key={useCase.title}
              className="p-6 rounded-2xl glass"
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.15, type: "spring", stiffness: 100, damping: 15 }}
              whileHover={{ y: -8, transition: { type: "spring", stiffness: 300 } }}
            >
              <motion.div 
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground mb-5"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <useCase.icon className="h-6 w-6" />
              </motion.div>
              <div className="font-semibold text-lg text-foreground mb-2">{useCase.title}</div>
              <p className="text-muted-foreground leading-relaxed">{useCase.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
