import React from "react";
import { Layers, Construction } from "lucide-react";

const Canvas: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Canvas</h1>
        <p className="text-muted-foreground mt-1">Visual strategy building and pattern recognition</p>
      </div>

      {/* Coming Soon State */}
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <Layers className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">Canvas Coming Soon</h2>
        <p className="text-muted-foreground text-center max-w-md">
          The visual strategy builder is under development. Soon you'll be able to create and visualize
          trading patterns, draw support/resistance levels, and annotate your chart setups.
        </p>
        <div className="flex items-center gap-2 mt-6 text-sm text-muted-foreground">
          <Construction className="w-4 h-4" />
          <span>Under Construction</span>
        </div>
      </div>
    </div>
  );
};

export default Canvas;
