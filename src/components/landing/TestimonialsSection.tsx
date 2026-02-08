import { motion } from "framer-motion";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Maria Santos",
    role: "Proprietária, Café Aroma",
    location: "São Paulo, SP",
    quote: "A mudança na atmosfera do café foi instantânea. Nossos clientes adoram e voltam mais vezes.",
    rating: 5,
  },
  {
    name: "Carlos Mendes",
    role: "Gerente, Restaurante Sabor",
    location: "Rio de Janeiro, RJ",
    quote: "A programação automática é incrível. Cada horário tem a trilha perfeita, sem eu precisar fazer nada.",
    rating: 5,
  },
  {
    name: "Ana Oliveira",
    role: "CEO, Rede Fitness Plus",
    location: "Belo Horizonte, MG",
    quote: "Usamos em 15 academias. A consistência da marca através da música fez toda diferença.",
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
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Amado por empresas
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Milhares de estabelecimentos já transformaram sua experiência musical
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={i}
              className="p-6 rounded-2xl glass"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>

              {/* Quote */}
              <p className="text-foreground mb-6 leading-relaxed">
                "{testimonial.quote}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold">
                  {testimonial.name.charAt(0)}
                </div>
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
