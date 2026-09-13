import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AuroraBackground } from "./AuroraBackground";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export const Layout = () => {
  const location = useLocation();
  return (
    <div className="relative min-h-screen flex flex-col">
      <AuroraBackground />
      <Navbar />
      <main className="flex-1 pt-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  );
};
