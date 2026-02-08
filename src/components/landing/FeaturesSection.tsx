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
    title: "IA Musical",
    description: "Playlists criadas por inteligência artificial que entendem o mood do seu negócio.",
  },
  {
    icon: Calendar,
    title: "Programação Inteligente",
    description: "Agende diferentes playlists para cada momento do dia automaticamente.",
  },
  {
    icon: Music2,
    title: "Biblioteca Curada",
    description: "Milhares de faixas licenciadas, perfeitas para ambientes comerciais.",
  },
  {
    icon: Shield,
    title: "100% Licenciado",
    description: "Sem preocupações com direitos autorais. Tudo regularizado.",
  },
  {
    icon: Zap,
    title: "Fácil de Usar",
    description: "Configure em minutos. Sem equipamentos complexos ou instalações.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "Entenda quais músicas funcionam melhor para seu público.",
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
      
      <div className="container mx-auto px-6 relative z-10">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Tudo que você precisa
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Uma plataforma completa para gerenciar a música do seu estabelecimento
          </p>
        </motion.div>

        <motion.div 
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="group p-6 rounded-2xl glass glass-hover cursor-default"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
