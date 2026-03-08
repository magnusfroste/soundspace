import { Bot, Target, Brain, Timer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentObjectives } from "@/components/agent/AgentObjectives";
import { AgentSkillsMemories } from "@/components/agent/AgentSkillsMemories";
import { AgentAutomation } from "@/components/agent/AgentAutomation";

export default function AdminAgent() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-bold">SoundAgent</h1>
          <p className="text-xs text-muted-foreground">Manage objectives, skills and automation</p>
        </div>
      </div>

      <Tabs defaultValue="objectives">
        <TabsList>
          <TabsTrigger value="objectives" className="gap-2">
            <Target className="h-4 w-4" /> Objectives
          </TabsTrigger>
          <TabsTrigger value="skills" className="gap-2">
            <Brain className="h-4 w-4" /> Skills & Memory
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2">
            <Timer className="h-4 w-4" /> Automation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="objectives" className="mt-4">
          <AgentObjectives />
        </TabsContent>
        <TabsContent value="skills" className="mt-4">
          <AgentSkillsMemories />
        </TabsContent>
        <TabsContent value="automation" className="mt-4">
          <AgentAutomation />
        </TabsContent>
      </Tabs>
    </div>
  );
}
