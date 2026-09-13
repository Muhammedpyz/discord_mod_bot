import { motion } from "framer-motion";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { siteConfig } from "@/config/site";

export const Faqs = () => {
  return (
    <section className="container max-w-3xl py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">SSS</span>
        <h2 className="mt-3 font-display font-bold text-4xl md:text-5xl tracking-tight">
          Sıkça Sorulan Sorular
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.15 }}
        className="mt-12 liquid-glass rounded-3xl p-3"
      >
        <Accordion type="single" collapsible className="w-full">
          {siteConfig.faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="border-border/40">
              <AccordionTrigger className="px-5 py-5 text-left font-display font-semibold text-base hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-5 text-muted-foreground leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </motion.div>
    </section>
  );
};
