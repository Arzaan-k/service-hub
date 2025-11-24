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
    gradientColor = '#EA580C',
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
                "group relative border border-border bg-card/50 overflow-hidden rounded-[2rem] backdrop-blur-xl transition-all duration-500 hover:border-primary/50 hover:shadow-lg",
                className
            )}
            onMouseMove={handleMouseMove}
            {...props}
        >
            <motion.div
                className="pointer-events-none absolute -inset-px rounded-[2rem] opacity-0 transition duration-500 group-hover:opacity-100"
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
                "relative overflow-hidden rounded-[2rem] border border-border bg-card/40 backdrop-blur-2xl shadow-sm transition-all duration-500 hover:shadow-md hover:bg-card/60 p-6",
                className
            )}
            {...props}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent opacity-40 pointer-events-none" />
            <div className="relative z-10 h-full">
                {children}
            </div>
        </div>
    );
};
