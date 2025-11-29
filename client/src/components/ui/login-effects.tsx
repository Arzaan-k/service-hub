import React from "react";
import { motion } from "framer-motion";

// --- Professional Background ---
// A subtle, professional gradient background with a very faint pattern
export const ProfessionalBackground = () => {
    return (
        <div className="absolute inset-0 z-0 h-full w-full bg-background">
            {/* Subtle gradient mesh */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-background to-background opacity-50"></div>

            {/* Very subtle grid pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        </div>
    );
};

// --- Hero Section Background (for split layout) ---
export const HeroBackground = () => {
    return (
        <div className="absolute inset-0 z-0 h-full w-full bg-slate-900 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-slate-900 opacity-90"></div>

            {/* Abstract geometric shapes for professional look */}
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-30"></div>
            <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/50 to-transparent"></div>
        </div>
    );
};

// --- Fade In Animation Wrapper ---
export const FadeIn = ({
    children,
    delay = 0,
    className = ""
}: {
    children: React.ReactNode;
    delay?: number;
    className?: string;
}) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay, ease: "easeOut" }}
            className={className}
        >
            {children}
        </motion.div>
    );
};
