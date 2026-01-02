import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  market: string;
  created_at: string;
}

interface StrategySettingsProps {
  strategy: Strategy;
}

const StrategySettings: React.FC<StrategySettingsProps> = ({ strategy }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: strategy.name,
    description: strategy.description || "",
  });

  const updateStrategy = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("strategies")
        .update({
          name: formData.name,
          description: formData.description || null,
        })
        .eq("id", strategy.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategy", strategy.id] });
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      toast.success("Strategy updated");
    },
    onError: () => {
      toast.error("Failed to update strategy");
    },
  });

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error("Strategy name is required");
      return;
    }
    updateStrategy.mutate();
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Strategy Details</h2>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-foreground">Strategy Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-background border-border focus:border-primary focus:ring-primary/20"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your strategy's core logic..."
              className="bg-background border-border focus:border-primary focus:ring-primary/20 min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Market</Label>
            <Input
              value={strategy.market}
              disabled
              className="bg-muted border-border text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">Market cannot be changed after creation</p>
          </div>
        </div>

        <div className="mt-6">
          <Button
            onClick={handleSave}
            disabled={updateStrategy.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-card border border-destructive/30 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-destructive mb-2">Danger Zone</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Deleting this strategy will permanently remove all associated trades and data.
          This action cannot be undone.
        </p>
        <Button
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive/10"
        >
          Delete Strategy
        </Button>
      </div>
    </div>
  );
};

export default StrategySettings;
