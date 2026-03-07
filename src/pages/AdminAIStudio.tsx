import { Sparkles } from "lucide-react";
import { useAIStudio } from "@/hooks/useAIStudio";
import {
  ProviderTabs,
  StudioPromptPanel,
  OutputPreview,
  BatchOutputPreview,
  GenerationHistory,
} from "@/components/admin/studio";

export default function AdminAIStudio() {
  const {
    providers,
    activeProvider,
    activeProviderId,
    setActiveProviderId,
    generate,
    isGenerating,
    currentGeneration,
    batchVariations,
    selectedVariationIndex,
    setSelectedVariationIndex,
    confirmVariation,
    isConfirmingVariation,
    history,
    playItem,
    deleteFromHistory,
    playlists,
    save,
    isSaving,
  } = useAIStudio();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Music Studio
        </h1>
        <p className="text-muted-foreground mt-1">
          Generate original music tracks using AI providers
        </p>
      </div>

      {/* Provider Tabs */}
      <ProviderTabs
        providers={providers}
        activeProviderId={activeProviderId}
        onSelect={setActiveProviderId}
      />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generation Panel */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <StudioPromptPanel
              providerName={activeProvider.name}
              providerId={activeProvider.id}
              isGenerating={isGenerating}
              onGenerate={generate}
            />
          </div>

          {/* Batch Output Preview */}
          {batchVariations && batchVariations.length > 1 && (
            <BatchOutputPreview
              variations={batchVariations}
              selectedIndex={selectedVariationIndex}
              onSelectVariation={setSelectedVariationIndex}
              onConfirmSelection={confirmVariation}
              savedItem={currentGeneration}
              playlists={playlists}
              isSaving={isSaving}
              onSave={save}
            />
          )}

          {/* Single Output Preview */}
          {currentGeneration && !batchVariations && (
            <OutputPreview
              item={currentGeneration}
              playlists={playlists}
              isSaving={isSaving}
              onSave={save}
            />
          )}
        </div>

        {/* History Panel */}
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h3 className="font-medium">Generation History</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {history.length} track{history.length !== 1 ? "s" : ""} generated
            </p>
          </div>
          <div className="h-[400px] lg:h-[500px]">
            <GenerationHistory
              history={history}
              currentId={currentGeneration?.id}
              onPlay={playItem}
              onDelete={deleteFromHistory}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
