import React, { useRef, useState } from 'react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    gradientColor?: string;
    className?: string;
}

export const AnimatedCard = ({
    children,
    className,
    gradientColor = '#007AFF', // Default to Apple Blue
    ...props
}: AnimatedCardProps) => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
        const { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);
    }

    return (
        <div
            className={cn(
                "group relative border border-white/20 dark:border-white/10 bg-white/50 dark:bg-black/40 overflow-hidden rounded-3xl backdrop-blur-xl transition-all duration-500 hover:shadow-xl hover:scale-[1.01]",
                className
            )}
            onMouseMove={handleMouseMove}
            {...props}
        >
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-500 group-hover:opacity-100"
                style={{
                    background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              ${gradientColor}15,
              transparent 80%
            )
          `,
                }}
            />
            <div className="relative h-full">
                {children}
            </div>
        </div>
    );
};

export const GlassCard = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    return (
        <div
            className={cn(
                "glass-card relative overflow-hidden rounded-3xl transition-all duration-500 hover:shadow-xl p-6",
                className
            )}
            {...props}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/10 to-transparent opacity-50 pointer-events-none" />
            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    );
};
