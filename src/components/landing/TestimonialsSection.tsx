import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Mitchell",
    role: "Owner, Aroma Café",
    location: "Brooklyn, NY",
    quote: "The change in atmosphere was instant. Our customers love it and keep coming back.",
    rating: 5,
  },
  {
    name: "James Chen",
    role: "Manager, Savour Restaurant",
    location: "San Francisco, CA",
    quote: "The automatic scheduling is incredible. Every time slot has the perfect soundtrack without me lifting a finger.",
    rating: 5,
  },
  {
    name: "Emily Rodriguez",
    role: "CEO, FitLife Studios",
    location: "Austin, TX",
    quote: "We use it across 15 gyms. Brand consistency through music has made all the difference.",
    rating: 5,
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
            Loved by businesses
          </motion.h2>
          <motion.p 
            className="text-lg text-muted-foreground max-w-2xl mx-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ delay: 0.2 }}
          >
            Thousands of venues have already transformed their music experience
          </motion.p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              className="p-6 rounded-2xl glass"
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.15, type: "spring", stiffness: 100, damping: 15 }}
              whileHover={{ y: -8, transition: { type: "spring", stiffness: 300 } }}
            >
              <motion.div 
                className="flex gap-1 mb-4"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 + 0.2 }}
              >
                {[...Array(testimonial.rating)].map((_, j) => (
                  <motion.div
                    key={j}
                    initial={{ opacity: 0, scale: 0 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.15 + 0.3 + j * 0.05 }}
                  >
                    <Star className="h-4 w-4 fill-primary text-primary" />
                  </motion.div>
                ))}
              </motion.div>

              <p className="text-foreground mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>

              <div className="flex items-center gap-3">
                <motion.div 
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                >
                  {testimonial.name.charAt(0)}
                </motion.div>
                <div>
                  <div className="font-medium text-foreground">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role} · {testimonial.location}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
